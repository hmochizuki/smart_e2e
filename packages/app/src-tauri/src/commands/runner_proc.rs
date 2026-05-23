use std::path::{Path, PathBuf};
use std::process::Command;

use serde_json::Value;

use super::error::CommandError;
use crate::RunnerContext;

/// Node サブプロセスに渡す引数列を組み立てる純粋関数。
/// テスト可能にするため Command 生成からは分離している。
pub fn build_subprocess_args(script_path: &str, cmd: &str, json_payload: &str) -> Vec<String> {
    vec![
        script_path.to_string(),
        cmd.to_string(),
        json_payload.to_string(),
    ]
}

/// `cmd.mjs` を node で起動し、stdout を JSON として返す。
/// 同期 I/O は spawn_blocking で別スレッドに逃がし、UI スレッドをブロックしない。
pub async fn invoke_node(
    ctx: &RunnerContext,
    cmd: &str,
    payload: &Value,
) -> Result<Value, CommandError> {
    let json_payload = payload.to_string();
    let script_path: PathBuf = ctx.script_path.clone();
    let db_path: PathBuf = ctx.db_path.clone();
    let migrations_folder: PathBuf = ctx.migrations_folder.clone();
    let cmd_string = cmd.to_string();

    tokio::task::spawn_blocking(move || {
        let script_path_str = script_path.to_string_lossy().to_string();
        let args = build_subprocess_args(&script_path_str, &cmd_string, &json_payload);

        let output = Command::new("node")
            .args(&args)
            .env("SMART_E2E_DB_PATH", path_to_string(&db_path))
            .env(
                "SMART_E2E_MIGRATIONS_FOLDER",
                path_to_string(&migrations_folder),
            )
            .output()
            .map_err(|e| CommandError::SpawnFailed(e.to_string()))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            return Err(CommandError::SubprocessFailed {
                status: output.status.code().unwrap_or(-1),
                stderr,
            });
        }

        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let trimmed = stdout.trim();
        if trimmed.is_empty() {
            return Ok(Value::Null);
        }
        serde_json::from_str(trimmed).map_err(|e| CommandError::InvalidOutput(e.to_string()))
    })
    .await
    .map_err(|e| CommandError::SpawnFailed(format!("join error: {}", e)))?
}

fn path_to_string(p: &Path) -> String {
    p.to_string_lossy().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_subprocess_args_returns_three_elements() {
        let args = build_subprocess_args("/path/cmd.mjs", "list_suites", "{}");
        assert_eq!(args.len(), 3);
        assert_eq!(args[0], "/path/cmd.mjs");
        assert_eq!(args[1], "list_suites");
        assert_eq!(args[2], "{}");
    }

    #[test]
    fn build_subprocess_args_passes_json_payload_verbatim() {
        let payload = r#"{"id":"abc","patch":{"name":"x"}}"#;
        let args = build_subprocess_args("script.mjs", "update_suite", payload);
        assert_eq!(args[2], payload);
    }
}
