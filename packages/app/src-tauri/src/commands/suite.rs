use serde::{Deserialize, Serialize};
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

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SuitePatch {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
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

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StepPatch {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub suite_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub order: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub script: Option<String>,
}

#[tauri::command]
pub async fn list_suites(ctx: State<'_, RunnerContext>) -> Result<Value, CommandError> {
    invoke_node(&ctx, "list_suites", &json!({})).await
}

#[tauri::command]
pub async fn create_suite(
    ctx: State<'_, RunnerContext>,
    input: NewSuiteInput,
) -> Result<Value, CommandError> {
    let payload = json!({
        "input": {
            "name": input.name,
            "description": input.description,
        }
    });
    invoke_node(&ctx, "create_suite", &payload).await
}

#[tauri::command]
pub async fn get_suite(ctx: State<'_, RunnerContext>, id: String) -> Result<Value, CommandError> {
    invoke_node(&ctx, "get_suite", &json!({ "id": id })).await
}

#[tauri::command]
pub async fn update_suite(
    ctx: State<'_, RunnerContext>,
    id: String,
    patch: SuitePatch,
) -> Result<Value, CommandError> {
    let patch_value =
        serde_json::to_value(&patch).map_err(|e| CommandError::InvalidInput(e.to_string()))?;
    let payload = json!({
        "id": id,
        "patch": patch_value,
    });
    invoke_node(&ctx, "update_suite", &payload).await
}

#[tauri::command]
pub async fn delete_suite(
    ctx: State<'_, RunnerContext>,
    id: String,
) -> Result<Value, CommandError> {
    invoke_node(&ctx, "delete_suite", &json!({ "id": id })).await
}

#[tauri::command]
pub async fn list_steps(
    ctx: State<'_, RunnerContext>,
    suite_id: String,
) -> Result<Value, CommandError> {
    invoke_node(&ctx, "list_steps", &json!({ "suiteId": suite_id })).await
}

#[tauri::command]
pub async fn create_step(
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
    invoke_node(&ctx, "create_step", &payload).await
}

#[tauri::command]
pub async fn update_step(
    ctx: State<'_, RunnerContext>,
    id: String,
    patch: StepPatch,
) -> Result<Value, CommandError> {
    let patch_value =
        serde_json::to_value(&patch).map_err(|e| CommandError::InvalidInput(e.to_string()))?;
    let payload = json!({
        "id": id,
        "patch": patch_value,
    });
    invoke_node(&ctx, "update_step", &payload).await
}

#[tauri::command]
pub async fn delete_step(ctx: State<'_, RunnerContext>, id: String) -> Result<Value, CommandError> {
    invoke_node(&ctx, "delete_step", &json!({ "id": id })).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn suite_patch_skips_none_fields() {
        let patch = SuitePatch {
            name: Some("renamed".to_string()),
            description: None,
        };
        let value = serde_json::to_value(&patch).unwrap();
        assert_eq!(value, json!({ "name": "renamed" }));
        let obj = value.as_object().unwrap();
        assert!(!obj.contains_key("description"));
    }

    #[test]
    fn suite_patch_serializes_empty_when_all_none() {
        let patch = SuitePatch {
            name: None,
            description: None,
        };
        let value = serde_json::to_value(&patch).unwrap();
        assert_eq!(value, json!({}));
    }

    #[test]
    fn step_patch_skips_none_fields_and_uses_camel_case() {
        let patch = StepPatch {
            suite_id: Some("suite-1".to_string()),
            order: None,
            name: Some("click".to_string()),
            script: None,
        };
        let value = serde_json::to_value(&patch).unwrap();
        assert_eq!(value, json!({ "suiteId": "suite-1", "name": "click" }));
        let obj = value.as_object().unwrap();
        assert!(!obj.contains_key("order"));
        assert!(!obj.contains_key("script"));
        assert!(!obj.contains_key("suite_id"));
    }

    #[test]
    fn step_patch_deserializes_camel_case_suite_id() {
        let json = serde_json::json!({ "suiteId": "suite-1", "order": 3 });
        let patch: StepPatch = serde_json::from_value(json).unwrap();
        assert_eq!(patch.suite_id.as_deref(), Some("suite-1"));
        assert_eq!(patch.order, Some(3));
        assert_eq!(patch.name, None);
        assert_eq!(patch.script, None);
    }
}
