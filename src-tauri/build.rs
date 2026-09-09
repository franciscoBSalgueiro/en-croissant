fn main() {
    // Cargo exposes enabled features to build scripts as CARGO_FEATURE_<NAME>.
    if std::env::var_os("CARGO_FEATURE_TAURI").is_some() {
        tauri_build::build()
    }
}
