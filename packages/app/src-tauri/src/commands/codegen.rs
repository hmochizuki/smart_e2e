use std::path::Path;

use serde::Serialize;
use tempfile::{Builder, TempPath};
use tokio::process::Command;

use super::error::CommandError;

const DEFAULT_TARGET: &str = "playwright-test";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodegenResult {
    pub script: String,
    pub target_url: String,
}

pub fn build_codegen_args(
    url: &str,
    target: &str,
    output_path: &Path,
) -> Result<Vec<String>, CommandError> {
    if url.trim().is_empty() {
        return Err(CommandError::InvalidInput("url must not be empty".into()));
    }
    if target.trim().is_empty() {
        return Err(CommandError::InvalidInput(
            "target must not be empty".into(),
        ));
    }

    Ok(vec![
        "playwright".to_string(),
        "codegen".to_string(),
        format!("--target={}", target),
        "-o".to_string(),
        output_path.to_string_lossy().to_string(),
        url.to_string(),
    ])
}

pub fn resolve_target(target: Option<String>) -> String {
    match target {
        Some(t) if !t.trim().is_empty() => t,
        _ => DEFAULT_TARGET.to_string(),
    }
}

fn create_temp_output_path() -> Result<TempPath, CommandError> {
    let temp = Builder::new()
        .prefix("smart-e2e-codegen-")
        .suffix(".ts")
        .tempfile()
        .map_err(|e| CommandError::SpawnFailed(format!("failed to create temp file: {}", e)))?;

    Ok(temp.into_temp_path())
}

#[tauri::command]
pub async fn start_codegen(
    url: String,
    target: Option<String>,
) -> Result<CodegenResult, CommandError> {
    if url.trim().is_empty() {
        return Err(CommandError::InvalidInput("url must not be empty".into()));
    }

    let resolved_target = resolve_target(target);
    let temp_path = create_temp_output_path()?;

    run_codegen(&url, &resolved_target, &temp_path).await
}

async fn run_codegen(
    url: &str,
    target: &str,
    output_path: &Path,
) -> Result<CodegenResult, CommandError> {
    let args = build_codegen_args(url, target, output_path)?;

    let output = Command::new("npx")
        .args(&args)
        .output()
        .await
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                CommandError::NotFound("npx".into())
            } else {
                CommandError::SpawnFailed(e.to_string())
            }
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        return Err(CommandError::SubprocessFailed {
            status: output.status.code().unwrap_or(-1),
            stderr,
        });
    }

    let script = tokio::fs::read_to_string(output_path).await.map_err(|e| {
        CommandError::InvalidOutput(format!("failed to read codegen output: {}", e))
    })?;

    if script.trim().is_empty() {
        return Err(CommandError::CodegenEmpty);
    }

    Ok(CodegenResult {
        script,
        target_url: url.to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn build_codegen_args_rejects_empty_url() {
        let path = PathBuf::from("/tmp/out.ts");
        let err = build_codegen_args("", "playwright-test", &path).unwrap_err();
        assert!(matches!(err, CommandError::InvalidInput(_)));
    }

    #[test]
    fn build_codegen_args_rejects_whitespace_url() {
        let path = PathBuf::from("/tmp/out.ts");
        let err = build_codegen_args("   ", "playwright-test", &path).unwrap_err();
        assert!(matches!(err, CommandError::InvalidInput(_)));
    }

    #[test]
    fn build_codegen_args_rejects_empty_target() {
        let path = PathBuf::from("/tmp/out.ts");
        let err = build_codegen_args("https://example.com", "", &path).unwrap_err();
        assert!(matches!(err, CommandError::InvalidInput(_)));
    }

    #[test]
    fn build_codegen_args_includes_url_target_and_output() {
        let path = PathBuf::from("/tmp/out.ts");
        let args = build_codegen_args("https://example.com", "playwright-test", &path).unwrap();
        assert_eq!(args[0], "playwright");
        assert_eq!(args[1], "codegen");
        assert_eq!(args[2], "--target=playwright-test");
        assert_eq!(args[3], "-o");
        assert_eq!(args[4], "/tmp/out.ts");
        assert_eq!(args[5], "https://example.com");
    }

    #[test]
    fn build_codegen_args_supports_alternative_target() {
        let path = PathBuf::from("/tmp/out.ts");
        let args = build_codegen_args("https://example.com", "javascript", &path).unwrap();
        assert_eq!(args[2], "--target=javascript");
    }

    #[test]
    fn resolve_target_defaults_when_none() {
        assert_eq!(resolve_target(None), "playwright-test");
    }

    #[test]
    fn resolve_target_defaults_when_empty_string() {
        assert_eq!(resolve_target(Some(String::new())), "playwright-test");
    }

    #[test]
    fn resolve_target_defaults_when_whitespace() {
        assert_eq!(resolve_target(Some("  ".to_string())), "playwright-test");
    }

    #[test]
    fn resolve_target_keeps_explicit_value() {
        assert_eq!(resolve_target(Some("javascript".to_string())), "javascript");
    }

    #[test]
    fn create_temp_output_path_returns_path_with_ts_suffix() {
        let path = create_temp_output_path().unwrap();
        let s = path.to_string_lossy();
        assert!(s.ends_with(".ts"));
    }

    #[test]
    fn create_temp_output_path_removes_file_on_drop() {
        let path_buf;
        {
            let temp_path = create_temp_output_path().unwrap();
            path_buf = temp_path.to_path_buf();
            assert!(path_buf.exists());
        }
        assert!(!path_buf.exists());
    }
}
