use serde_json::{json, Value};
use tauri::State;

use super::error::CommandError;
use super::runner_proc::invoke_node;
use crate::RunnerContext;

#[tauri::command]
pub fn list_suite_runs(
    ctx: State<'_, RunnerContext>,
    suite_id: String,
) -> Result<Value, CommandError> {
    invoke_node(&ctx, "list_suite_runs", &json!({ "suiteId": suite_id }))
}
