use std::path::PathBuf;

use serde::Serialize;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

use super::error::CommandError;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaywrightStatus {
    pub ready: bool,
    pub missing_paths: Vec<String>,
    pub all_paths: Vec<String>,
}

// `npx playwright install --dry-run` の出力から
// 「Install location: <path>」の行を抽出してパス一覧を返す。
pub fn parse_install_locations(stdout: &str) -> Vec<String> {
    let mut out = Vec::new();
    for line in stdout.lines() {
        let trimmed = line.trim();
        if let Some(rest) = trimmed.strip_prefix("Install location:") {
            let path = rest.trim().to_string();
            if !path.is_empty() {
                out.push(path);
            }
        }
    }
    out
}

#[tauri::command]
pub async fn check_playwright() -> Result<PlaywrightStatus, CommandError> {
    let output = Command::new("npx")
        .args(["playwright", "install", "--dry-run"])
        .output()
        .await
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                CommandError::NotFound("npx".into())
            } else {
                CommandError::SpawnFailed(e.to_string())
            }
        })?;

    // dry-run は常に exit 0 で返る (失敗しても情報出力するだけ)。
    // ただし npx 自体の失敗時は非0なのでエラー扱い。
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        return Err(CommandError::SubprocessFailed {
            status: output.status.code().unwrap_or(-1),
            stderr,
        });
    }

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let all_paths = parse_install_locations(&stdout);

    let missing_paths: Vec<String> = all_paths
        .iter()
        .filter(|p| !PathBuf::from(p).exists())
        .cloned()
        .collect();

    Ok(PlaywrightStatus {
        ready: missing_paths.is_empty() && !all_paths.is_empty(),
        missing_paths,
        all_paths,
    })
}

// インストール実行。stdout/stderr 各行を `playwright:install:line` event として発火し、
// 完了時に `playwright:install:done` を発火。
#[tauri::command]
pub async fn install_playwright(app: AppHandle) -> Result<(), CommandError> {
    let mut child = Command::new("npx")
        .args(["playwright", "install"])
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                CommandError::NotFound("npx".into())
            } else {
                CommandError::SpawnFailed(e.to_string())
            }
        })?;

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    let app_for_stdout = app.clone();
    if let Some(stdout) = stdout {
        tokio::spawn(async move {
            let mut reader = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                let _ = app_for_stdout.emit(
                    "playwright:install:line",
                    serde_json::json!({ "stream": "stdout", "line": line }),
                );
            }
        });
    }

    let app_for_stderr = app.clone();
    if let Some(stderr) = stderr {
        tokio::spawn(async move {
            let mut reader = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                let _ = app_for_stderr.emit(
                    "playwright:install:line",
                    serde_json::json!({ "stream": "stderr", "line": line }),
                );
            }
        });
    }

    let status = child
        .wait()
        .await
        .map_err(|e| CommandError::SpawnFailed(e.to_string()))?;

    let _ = app.emit(
        "playwright:install:done",
        serde_json::json!({ "exitCode": status.code() }),
    );

    if !status.success() {
        return Err(CommandError::SubprocessFailed {
            status: status.code().unwrap_or(-1),
            stderr: String::new(),
        });
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_install_locations_extracts_paths() {
        let stdout = "Some banner\nInstall location:    /Users/x/.cache/ms-playwright/chromium-1223\nInstall location:    /Users/x/.cache/ms-playwright/firefox-1522\nfooter";
        let paths = parse_install_locations(stdout);
        assert_eq!(paths.len(), 2);
        assert_eq!(paths[0], "/Users/x/.cache/ms-playwright/chromium-1223");
        assert_eq!(paths[1], "/Users/x/.cache/ms-playwright/firefox-1522");
    }

    #[test]
    fn parse_install_locations_ignores_empty_lines() {
        let stdout = "\nInstall location:   \n\n";
        let paths = parse_install_locations(stdout);
        assert!(paths.is_empty());
    }

    #[test]
    fn parse_install_locations_returns_empty_when_no_match() {
        let paths = parse_install_locations("nothing here");
        assert!(paths.is_empty());
    }

    #[test]
    fn parse_install_locations_handles_no_trailing_newline() {
        let stdout = "Install location: /a\nInstall location: /b";
        let paths = parse_install_locations(stdout);
        assert_eq!(paths, vec!["/a".to_string(), "/b".to_string()]);
    }
}
