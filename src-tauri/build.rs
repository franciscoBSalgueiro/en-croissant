fn main() {
    tauri_build::build();

    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("linux") {
        // Linux packaging uses bundle-specific file paths. Stage a copy next to
        // the executable for Cargo, Tauri dev, and builds without an installer.
        let source = "../aixchess.duckdb_extension";
        println!("cargo:rerun-if-changed={source}");
        let out_dir =
            std::path::PathBuf::from(std::env::var_os("OUT_DIR").expect("missing OUT_DIR"));
        let executable_dir = out_dir
            .ancestors()
            .find(|path| path.file_name().is_some_and(|name| name == "build"))
            .and_then(|path| path.parent())
            .expect("failed to locate Cargo executable directory");
        std::fs::copy(source, executable_dir.join("aixchess.duckdb_extension"))
            .expect("failed to stage aixchess extension");
    }
}
