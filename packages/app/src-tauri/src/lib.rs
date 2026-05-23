use std::path::PathBuf;
use tauri::Manager;

pub mod commands;

#[derive(Clone)]
pub struct RunnerContext {
    pub script_path: PathBuf,
    pub db_path: PathBuf,
    pub migrations_folder: PathBuf,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data dir");
            std::fs::create_dir_all(&app_data_dir).expect("failed to create app data dir");

            let db_path = app_data_dir.join("smart-e2e.db");

            let resource_dir = app
                .path()
                .resource_dir()
                .expect("failed to resolve resource dir");

            // dev / build どちらでもスクリプトと migrations を解決できるようにする。
            let script_path = resolve_script_path(&resource_dir);
            let migrations_folder = resolve_migrations_folder(&resource_dir);

            app.manage(RunnerContext {
                script_path,
                db_path,
                migrations_folder,
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::suite::list_suites,
            commands::suite::create_suite,
            commands::suite::get_suite,
            commands::suite::update_suite,
            commands::suite::delete_suite,
            commands::suite::list_steps,
            commands::suite::create_step,
            commands::suite::update_step,
            commands::suite::delete_step,
            commands::run::list_suite_runs,
            commands::codegen::start_codegen,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn resolve_script_path(resource_dir: &std::path::Path) -> PathBuf {
    let bundled = resource_dir.join("scripts").join("cmd.mjs");
    if bundled.exists() {
        return bundled;
    }
    // dev: packages/app/scripts/cmd.mjs (src-tauri からの相対)
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    manifest_dir
        .parent()
        .map(|p| p.join("scripts").join("cmd.mjs"))
        .unwrap_or_else(|| bundled)
}

fn resolve_migrations_folder(resource_dir: &std::path::Path) -> PathBuf {
    let bundled = resource_dir.join("drizzle");
    if bundled.exists() {
        return bundled;
    }
    // dev: packages/persistence/drizzle
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    manifest_dir
        .parent()
        .and_then(|app_dir| app_dir.parent())
        .map(|packages_dir| packages_dir.join("persistence").join("drizzle"))
        .unwrap_or_else(|| bundled)
}
