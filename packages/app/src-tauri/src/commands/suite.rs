use serde::Deserialize;
use serde_json::{json, Value};
use tauri::State;

use super::error::CommandError;
use super::runner_proc::invoke_node;
use crate::RunnerContext;

#[derive(Debug, Deserialize)]
pub struct NewSuiteInput {
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SuitePatch {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct NewStepInput {
    #[serde(rename = "suiteId")]
    pub suite_id: String,
    pub order: i64,
    pub name: String,
    pub script: String,
}

#[derive(Debug, Deserialize)]
pub struct StepPatch {
    #[serde(rename = "suiteId", default)]
    pub suite_id: Option<String>,
    #[serde(default)]
    pub order: Option<i64>,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub script: Option<String>,
}

#[tauri::command]
pub fn list_suites(ctx: State<'_, RunnerContext>) -> Result<Value, CommandError> {
    invoke_node(&ctx, "list_suites", &json!({}))
}

#[tauri::command]
pub fn create_suite(
    ctx: State<'_, RunnerContext>,
    input: NewSuiteInput,
) -> Result<Value, CommandError> {
    let payload = json!({
        "input": {
            "name": input.name,
            "description": input.description,
        }
    });
    invoke_node(&ctx, "create_suite", &payload)
}

#[tauri::command]
pub fn get_suite(ctx: State<'_, RunnerContext>, id: String) -> Result<Value, CommandError> {
    invoke_node(&ctx, "get_suite", &json!({ "id": id }))
}

#[tauri::command]
pub fn update_suite(
    ctx: State<'_, RunnerContext>,
    id: String,
    patch: SuitePatch,
) -> Result<Value, CommandError> {
    let payload = json!({
        "id": id,
        "patch": {
            "name": patch.name,
            "description": patch.description,
        }
    });
    invoke_node(&ctx, "update_suite", &payload)
}

#[tauri::command]
pub fn delete_suite(ctx: State<'_, RunnerContext>, id: String) -> Result<Value, CommandError> {
    invoke_node(&ctx, "delete_suite", &json!({ "id": id }))
}

#[tauri::command]
pub fn list_steps(ctx: State<'_, RunnerContext>, suite_id: String) -> Result<Value, CommandError> {
    invoke_node(&ctx, "list_steps", &json!({ "suiteId": suite_id }))
}

#[tauri::command]
pub fn create_step(
    ctx: State<'_, RunnerContext>,
    input: NewStepInput,
) -> Result<Value, CommandError> {
    let payload = json!({
        "input": {
            "suiteId": input.suite_id,
            "order": input.order,
            "name": input.name,
            "script": input.script,
        }
    });
    invoke_node(&ctx, "create_step", &payload)
}

#[tauri::command]
pub fn update_step(
    ctx: State<'_, RunnerContext>,
    id: String,
    patch: StepPatch,
) -> Result<Value, CommandError> {
    let payload = json!({
        "id": id,
        "patch": {
            "suiteId": patch.suite_id,
            "order": patch.order,
            "name": patch.name,
            "script": patch.script,
        }
    });
    invoke_node(&ctx, "update_step", &payload)
}

#[tauri::command]
pub fn delete_step(ctx: State<'_, RunnerContext>, id: String) -> Result<Value, CommandError> {
    invoke_node(&ctx, "delete_step", &json!({ "id": id }))
}
