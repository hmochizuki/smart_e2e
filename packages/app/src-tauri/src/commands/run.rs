use std::collections::HashMap;
use std::process::Stdio;
use std::sync::{Arc, Mutex};

use serde::Serialize;
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, State};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::Command as TokioCommand;
use uuid::Uuid;

use super::error::CommandError;
use super::runner_proc::invoke_node;
use crate::RunnerContext;

/// 実行中の Run プロセスを管理する State。
/// AppHandle に `manage` されてグローバル共有される。
#[derive(Default)]
pub struct RunState {
    inner: Arc<Mutex<HashMap<String, Arc<Mutex<Option<tokio::process::Child>>>>>>,
}

impl RunState {
    pub fn new() -> Self {
        Self::default()
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StartRunResponse {
    pub run_id: String,
}

/// Suite の Step 配列を JSON Value から取り出して、stepRunId を割当てた配列を組み立てる。
/// 純粋関数化してテストできるようにしている。
pub fn build_steps_payload(
    steps: &Value,
) -> Result<(Vec<Value>, HashMap<String, String>), CommandError> {
    let arr = steps
        .as_array()
        .ok_or_else(|| CommandError::InvalidOutput("list_steps did not return an array".into()))?;
    let mut out = Vec::with_capacity(arr.len());
    let mut id_map = HashMap::new();
    for step in arr {
        let step_id = step
            .get("id")
            .and_then(|v| v.as_str())
            .ok_or_else(|| CommandError::InvalidOutput("step has no id".into()))?
            .to_string();
        let step_run_id = Uuid::new_v4().to_string();
        id_map.insert(step_id.clone(), step_run_id.clone());
        out.push(json!({
            "stepRunId": step_run_id,
            "step": step,
        }));
    }
    Ok((out, id_map))
}

#[tauri::command]
pub async fn list_suite_runs(
    ctx: State<'_, RunnerContext>,
    suite_id: String,
) -> Result<Value, CommandError> {
    invoke_node(&ctx, "list_suite_runs", &json!({ "suiteId": suite_id })).await
}

#[tauri::command]
pub async fn start_run(
    app: AppHandle,
    state: State<'_, RunState>,
    ctx: State<'_, RunnerContext>,
    suite_id: String,
) -> Result<StartRunResponse, CommandError> {
    let suite = invoke_node(&ctx, "get_suite", &json!({ "id": &suite_id })).await?;
    let steps = invoke_node(&ctx, "list_steps", &json!({ "suiteId": &suite_id })).await?;
    let (steps_payload, _id_map) = build_steps_payload(&steps)?;

    let suite_run_id = Uuid::new_v4().to_string();

    let use_fake_llm = std::env::var("RUNNER_USE_FAKE_LLM")
        .map(|v| v == "true" || v == "1")
        .unwrap_or(false);

    let input_json = json!({
        "suiteRunId": &suite_run_id,
        "suite": suite,
        "steps": steps_payload,
        "dbPath": path_to_string(&ctx.db_path),
        "migrationsFolder": path_to_string(&ctx.migrations_folder),
        "useFakeLLM": use_fake_llm,
    });

    let script_path = ctx.run_script_path.clone();
    let anthropic_api_key = std::env::var("ANTHROPIC_API_KEY").unwrap_or_default();
    let fake_llm_env = std::env::var("RUNNER_USE_FAKE_LLM").unwrap_or_default();

    let mut child = TokioCommand::new("node")
        .arg(&script_path)
        .env("ANTHROPIC_API_KEY", anthropic_api_key)
        .env("RUNNER_USE_FAKE_LLM", fake_llm_env)
        .env("SMART_E2E_DB_PATH", path_to_string(&ctx.db_path))
        .env(
            "SMART_E2E_MIGRATIONS_FOLDER",
            path_to_string(&ctx.migrations_folder),
        )
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| CommandError::SpawnFailed(format!("failed to spawn run.mjs: {}", e)))?;

    if let Some(mut stdin) = child.stdin.take() {
        let bytes = input_json.to_string();
        stdin
            .write_all(bytes.as_bytes())
            .await
            .map_err(|e| CommandError::SpawnFailed(format!("write stdin failed: {}", e)))?;
        stdin
            .shutdown()
            .await
            .map_err(|e| CommandError::SpawnFailed(format!("shutdown stdin failed: {}", e)))?;
    }

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| CommandError::SpawnFailed("failed to capture run.mjs stdout".into()))?;
    let stderr = child.stderr.take();

    let child_slot: Arc<Mutex<Option<tokio::process::Child>>> = Arc::new(Mutex::new(Some(child)));
    {
        let mut map = state
            .inner
            .lock()
            .map_err(|e| CommandError::SpawnFailed(format!("state lock poisoned: {}", e)))?;
        map.insert(suite_run_id.clone(), child_slot.clone());
    }

    let app_for_stdout = app.clone();
    let suite_run_id_for_stdout = suite_run_id.clone();
    tokio::spawn(async move {
        let mut reader = BufReader::new(stdout).lines();
        loop {
            match reader.next_line().await {
                Ok(Some(line)) => {
                    let trimmed = line.trim();
                    if trimmed.is_empty() {
                        continue;
                    }
                    match serde_json::from_str::<Value>(trimmed) {
                        Ok(ev) => {
                            let _ = app_for_stdout.emit("runner:event", &ev);
                        }
                        Err(e) => {
                            eprintln!(
                                "[start_run:{}] failed to parse event line: {} -- raw: {}",
                                suite_run_id_for_stdout, e, trimmed
                            );
                        }
                    }
                }
                Ok(None) => break,
                Err(e) => {
                    eprintln!(
                        "[start_run:{}] stdout read error: {}",
                        suite_run_id_for_stdout, e
                    );
                    break;
                }
            }
        }
    });

    if let Some(stderr) = stderr {
        let suite_run_id_for_err = suite_run_id.clone();
        tokio::spawn(async move {
            let mut reader = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                eprintln!("[run.mjs:{}] {}", suite_run_id_for_err, line);
            }
        });
    }

    let state_inner = state.inner.clone();
    let child_slot_for_wait = child_slot.clone();
    let suite_run_id_for_wait = suite_run_id.clone();
    tokio::spawn(async move {
        let mut maybe_child = {
            match child_slot_for_wait.lock() {
                Ok(mut g) => g.take(),
                Err(_) => None,
            }
        };
        if let Some(child) = maybe_child.as_mut() {
            let _ = child.wait().await;
        }
        if let Ok(mut map) = state_inner.lock() {
            map.remove(&suite_run_id_for_wait);
        }
    });

    Ok(StartRunResponse {
        run_id: suite_run_id,
    })
}

#[tauri::command]
pub async fn cancel_run(
    ctx: State<'_, RunnerContext>,
    state: State<'_, RunState>,
    run_id: String,
) -> Result<(), CommandError> {
    let slot = {
        let mut map = state
            .inner
            .lock()
            .map_err(|e| CommandError::SpawnFailed(format!("state lock poisoned: {}", e)))?;
        map.remove(&run_id)
    };

    if let Some(slot) = slot {
        let maybe_child = match slot.lock() {
            Ok(mut g) => g.take(),
            Err(_) => None,
        };
        if let Some(mut child) = maybe_child {
            let _ = child.start_kill();
            let _ = child.wait().await;
        }
    }

    // best-effort: DB の suite_runs.status を 'aborted' に更新する。
    let _ = invoke_node(
        &ctx,
        "update_suite_run",
        &json!({
            "id": &run_id,
            "patch": {
                "status": "aborted",
                "finishedAt": chrono::Utc::now().to_rfc3339(),
            }
        }),
    )
    .await;

    Ok(())
}

fn path_to_string(p: &std::path::Path) -> String {
    p.to_string_lossy().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn build_steps_payload_assigns_uuids_and_keeps_step_ids() {
        let steps = json!([
            { "id": "step-a", "name": "a", "order": 0, "suiteId": "s", "script": "..." },
            { "id": "step-b", "name": "b", "order": 1, "suiteId": "s", "script": "..." },
        ]);
        let (payload, map) = build_steps_payload(&steps).unwrap();
        assert_eq!(payload.len(), 2);
        for entry in &payload {
            assert!(entry.get("stepRunId").is_some());
            assert!(entry.get("step").is_some());
        }
        assert_eq!(map.len(), 2);
        assert!(map.contains_key("step-a"));
        assert!(map.contains_key("step-b"));
    }

    #[test]
    fn build_steps_payload_rejects_non_array() {
        let err = build_steps_payload(&json!({ "x": 1 })).unwrap_err();
        assert!(matches!(err, CommandError::InvalidOutput(_)));
    }

    #[test]
    fn build_steps_payload_rejects_step_without_id() {
        let steps = json!([{ "name": "no-id" }]);
        let err = build_steps_payload(&steps).unwrap_err();
        assert!(matches!(err, CommandError::InvalidOutput(_)));
    }

    #[test]
    fn build_steps_payload_assigns_unique_step_run_ids() {
        let steps = json!([
            { "id": "s1", "name": "a", "order": 0, "suiteId": "x", "script": "..." },
            { "id": "s2", "name": "b", "order": 1, "suiteId": "x", "script": "..." },
        ]);
        let (payload, _) = build_steps_payload(&steps).unwrap();
        let id1 = payload[0]
            .get("stepRunId")
            .and_then(|v| v.as_str())
            .unwrap();
        let id2 = payload[1]
            .get("stepRunId")
            .and_then(|v| v.as_str())
            .unwrap();
        assert_ne!(id1, id2);
    }
}
