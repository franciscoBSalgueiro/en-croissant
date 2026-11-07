use super::{get_engine_config, EngineConfig, Error};
use std::{os::unix::fs::PermissionsExt, path::Path, time::Duration};

// Disposable builtin-only UCI children. Every read has a finite watchdog;
// no user engine, application profile, networking or descendant process is used.
fn write_engine(path: &Path, option: &str, complete: bool) {
    let ending = if complete {
        "printf 'uciok\\n'\nIFS= read -r -t 2 request\n"
    } else {
        // Close only output: accepting quit must not turn incomplete UCI into success.
        "exec 1>&-\nIFS= read -r -t 2 request\n"
    };
    let script = format!(
        "#!/bin/bash\nIFS= read -r -t 2 request || exit 1\n[ \"$request\" = uci ] || exit 2\nprintf 'id name Fixture\\noption name {option} type string default value\\n'\n{ending}"
    );
    let next = path.with_extension("next");
    std::fs::write(&next, script).unwrap();
    std::fs::set_permissions(&next, std::fs::Permissions::from_mode(0o700)).unwrap();
    std::fs::rename(next, path).unwrap();
}

async fn probe(path: &Path) -> Result<EngineConfig, Error> {
    tokio::time::timeout(
        Duration::from_secs(3),
        get_engine_config(path.to_path_buf()),
    )
    .await
    .expect("disposable UCI probe exceeded watchdog")
}

#[tokio::test]
async fn engine_config_reprobes_replaced_executable_at_same_path() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("engine");
    write_engine(&path, "First", true);
    let first = probe(&path).await.unwrap();
    assert_eq!(first.name, "Fixture");
    assert_eq!(first.options.len(), 1);
    assert_eq!(first.options[0].get_name(), "First");

    write_engine(&path, "Second", true);
    let second = probe(&path).await.unwrap();
    assert_eq!(second.options.len(), 1);
    assert_eq!(second.options[0].get_name(), "Second");
}

#[tokio::test]
async fn engine_config_rejects_eof_before_uciok_instead_of_partial_options() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("engine");
    write_engine(&path, "Partial", false);
    let result = probe(&path).await;
    assert!(
        matches!(result, Err(Error::EngineDisconnected)),
        "{result:?}"
    );
}
