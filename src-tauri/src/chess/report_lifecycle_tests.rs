use super::*;
use std::{os::unix::fs::PermissionsExt, time::Duration};
use tauri::{
    test::{mock_builder, mock_context, noop_assets, MockRuntime},
    Listener, Manager,
};
use tokio::time::{sleep, timeout};

const ID: &str = "report-lifecycle";
const FEN: &str = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const CANCEL_DEADLINE: Duration = Duration::from_secs(1);
const WATCHDOG: Duration = Duration::from_secs(12);

// These calls only inspect/wait for the exact child recorded by our disposable fixture.
// No signals, global process enumeration, or descendant processes are involved.
unsafe extern "C" {
    fn waitpid(pid: i32, status: *mut i32, options: i32) -> i32;
}

struct Fixture {
    directory: tempfile::TempDir,
    path: PathBuf,
}

impl Fixture {
    fn new(mode: &str) -> Self {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("engine");
        let script = format!(
            r#"#!/bin/bash
printf '%s' "$$" > child.pid
mode='{mode}'
count=0
# Builtins only, with an independent finite lifetime even on test assertion failure.
stall() {{
    printf '%s' "$1" > phase
    while (( SECONDS < 8 )); do :; done
    exit 91
}}
while IFS= read -r -t 8 line; do
    case "$line" in
        uci)
            [ "$mode" = uci ] && stall uci
            [ "$mode" = init_eof ] && exit 0
            printf 'uciok\n'
            ;;
        isready)
            [ "$mode" = ready ] && stall ready
            [ "$mode" = write_error ] && exec 0<&-
            printf 'readyok\n'
            [ "$mode" = write_error ] && stall write_error
            [ "$mode" = write ] && stall write
            ;;
        go*)
            count=$((count + 1))
            [ "$mode" = bestmove ] && stall bestmove
            [ "$mode" = final ] && [ "$count" = 2 ] && stall final
            [ "$mode" = eof ] && exit 0
            if [ "$mode" = read_error ]; then
                printf '\377\n'
                stall read_error
            fi
            printf 'bestmove e2e4\n'
            ;;
        quit) : ;; # Deliberately ignore graceful shutdown.
    esac
done
"#
        );
        std::fs::write(&path, script).unwrap();
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o700)).unwrap();
        Self { directory, path }
    }

    fn pid(&self) -> Option<i32> {
        std::fs::read_to_string(self.directory.path().join("child.pid"))
            .ok()?
            .parse()
            .ok()
    }

    async fn phase(&self, expected: &str) {
        timeout(WATCHDOG, async {
            loop {
                if std::fs::read_to_string(self.directory.path().join("phase"))
                    .is_ok_and(|phase| phase == expected)
                {
                    break;
                }
                sleep(Duration::from_millis(5)).await;
            }
        })
        .await
        .expect("fixture never reached expected phase");
    }

    fn assert_reaped(&self) {
        let pid = self.pid().expect("fixture must have started");
        let mut status = 0;
        // WNOHANG=1, ECHILD=10 on the supported macOS/Linux Unix test hosts.
        let result = unsafe { waitpid(pid, &mut status, 1) };
        let errno = std::io::Error::last_os_error().raw_os_error();
        assert_eq!(
            result, -1,
            "report returned without reaping child {pid}, status={status}"
        );
        assert_eq!(
            errno,
            Some(10),
            "waitpid must prove ECHILD, not merely a missing PID"
        );
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        if let Some(pid) = self.pid() {
            // On assertion failure the report future drops first (BaseEngine kills).
            // The shell also has an independent 8-second watchdog. Reap any remainder.
            let mut status = 0;
            loop {
                let result = unsafe { waitpid(pid, &mut status, 0) };
                if result >= 0
                    || std::io::Error::last_os_error().kind() != std::io::ErrorKind::Interrupted
                {
                    break;
                }
            }
        }
    }
}

fn app() -> tauri::App<MockRuntime> {
    let app = mock_builder()
        .manage(AppState::default())
        .build(mock_context(noop_assets()))
        .unwrap();
    tauri_specta::Builder::<MockRuntime>::new()
        .events(tauri_specta::collect_events![
            crate::progress::ProgressEvent
        ])
        .mount_events(&app);
    app
}

fn options() -> AnalysisOptions {
    AnalysisOptions {
        fen: FEN.into(),
        ..Default::default()
    }
}

async fn run(
    app: &tauri::App<MockRuntime>,
    path: &std::path::Path,
    options: AnalysisOptions,
    uci_options: Vec<EngineOption>,
) -> Result<Vec<MoveAnalysis>, Error> {
    analyze_game_inner(
        ID.into(),
        path.to_string_lossy().into_owned(),
        GoMode::Depth(1),
        options,
        uci_options,
        app.state(),
        app.handle().clone(),
    )
    .await
}

async fn cancelled_at(mode: &str) {
    let app = app();
    let fixture = Fixture::new(mode);
    let mut options = options();
    if mode == "final" {
        options.moves = vec!["e2e4".into()];
    }
    let uci_options = if mode == "write" {
        vec![EngineOption {
            name: "LargeOption".into(),
            value: "x".repeat(2 * 1024 * 1024),
        }]
    } else {
        vec![]
    };
    let report = run(&app, &fixture.path, options, uci_options);
    tokio::pin!(report);
    let result = timeout(WATCHDOG, async {
        tokio::select! {
            result = &mut report => panic!("report finished before cancellation: {result:?}"),
            () = fixture.phase(mode) => {}
        }
        cancel_analysis(ID.into(), app.state()).await.unwrap();
        cancel_analysis(ID.into(), app.state()).await.unwrap();
        timeout(CANCEL_DEADLINE, &mut report)
            .await
            .expect("cancel did not wake stalled report")
    })
    .await
    .expect("outer lifecycle watchdog expired");
    assert!(
        matches!(result, Err(Error::AnalysisCancelled)),
        "{result:?}"
    );
    assert!(app.state::<AppState>().analysis_cancel_flags.is_empty());
    fixture.assert_reaped();
}

#[tokio::test]
async fn report_lifecycle_cancel_stalled_uci() {
    cancelled_at("uci").await;
}
#[tokio::test]
async fn report_lifecycle_cancel_stalled_ready() {
    cancelled_at("ready").await;
}
#[tokio::test]
async fn report_lifecycle_cancel_stalled_bestmove() {
    cancelled_at("bestmove").await;
}
#[tokio::test]
async fn report_lifecycle_cancel_final_position() {
    cancelled_at("final").await;
}
#[tokio::test]
async fn report_lifecycle_cancel_blocked_option_write() {
    cancelled_at("write").await;
}

#[tokio::test]
async fn report_lifecycle_success_reaps_engine_ignoring_quit() {
    let app = app();
    let fixture = Fixture::new("success");
    let result = timeout(WATCHDOG, run(&app, &fixture.path, options(), vec![]))
        .await
        .unwrap()
        .unwrap();
    assert_eq!(result.len(), 1);
    assert!(app.state::<AppState>().analysis_cancel_flags.is_empty());
    fixture.assert_reaped();
}

#[tokio::test]
async fn report_lifecycle_eof_is_error_and_reaped() {
    let app = app();
    let fixture = Fixture::new("eof");
    let result = timeout(WATCHDOG, run(&app, &fixture.path, options(), vec![]))
        .await
        .unwrap();
    assert!(
        matches!(result, Err(Error::EngineDisconnected)),
        "{result:?}"
    );
    assert!(app.state::<AppState>().analysis_cancel_flags.is_empty());
    fixture.assert_reaped();
}

#[tokio::test]
async fn report_lifecycle_read_error_is_not_success() {
    let app = app();
    let fixture = Fixture::new("read_error");
    let result = timeout(WATCHDOG, run(&app, &fixture.path, options(), vec![]))
        .await
        .unwrap();
    assert!(matches!(result, Err(Error::Io(_))), "{result:?}");
    assert!(app.state::<AppState>().analysis_cancel_flags.is_empty());
    fixture.assert_reaped();
}

#[tokio::test]
async fn report_lifecycle_init_eof_cleans_registration() {
    let app = app();
    let fixture = Fixture::new("init_eof");
    let result = timeout(WATCHDOG, run(&app, &fixture.path, options(), vec![]))
        .await
        .unwrap();
    assert!(
        matches!(result, Err(Error::EngineDisconnected)),
        "{result:?}"
    );
    assert!(app.state::<AppState>().analysis_cancel_flags.is_empty());
    fixture.assert_reaped();
}

#[tokio::test]
async fn report_lifecycle_invalid_input_cleans_registration() {
    let app = app();
    let fixture = Fixture::new("success");
    let mut invalid = options();
    invalid.fen = "not a fen".into();
    let result = timeout(WATCHDOG, run(&app, &fixture.path, invalid, vec![]))
        .await
        .unwrap();
    assert!(matches!(result, Err(Error::Fen(_))), "{result:?}");
    assert!(app.state::<AppState>().analysis_cancel_flags.is_empty());
    fixture.assert_reaped();
}

#[tokio::test]
async fn report_lifecycle_spawn_error_and_missing_cancel_are_clean() {
    let app = app();
    let directory = tempfile::tempdir().unwrap();
    cancel_analysis(ID.into(), app.state()).await.unwrap();
    let result = run(
        &app,
        &directory.path().join("missing-engine"),
        options(),
        vec![],
    )
    .await;
    assert!(matches!(result, Err(Error::Io(_))), "{result:?}");
    assert!(app.state::<AppState>().analysis_cancel_flags.is_empty());
    cancel_analysis(ID.into(), app.state()).await.unwrap();
    assert!(app.state::<AppState>().analysis_cancel_flags.is_empty());
}

#[tokio::test]
async fn report_lifecycle_annotation_error_after_reap() {
    let app = app();
    let fixture = Fixture::new("success");
    let mut options = options();
    options.annotate_novelties = true;
    let result = timeout(WATCHDOG, run(&app, &fixture.path, options, vec![]))
        .await
        .unwrap();
    assert!(
        matches!(result, Err(Error::MissingReferenceDatabase)),
        "{result:?}"
    );
    assert!(app.state::<AppState>().analysis_cancel_flags.is_empty());
    fixture.assert_reaped();
}

#[tokio::test]
async fn report_lifecycle_same_id_cancels_old_and_preserves_new_registration() {
    let app = app();
    let old_fixture = Fixture::new("uci");
    let new_fixture = Fixture::new("ready");
    let old = run(&app, &old_fixture.path, options(), vec![]);
    tokio::pin!(old);
    tokio::select! {
        result = &mut old => panic!("old report unexpectedly finished: {result:?}"),
        () = old_fixture.phase("uci") => {}
    }
    let old_flag = app
        .state::<AppState>()
        .analysis_cancel_flags
        .get(ID)
        .unwrap()
        .clone();
    let new = run(&app, &new_fixture.path, options(), vec![]);
    tokio::pin!(new);
    tokio::select! {
        result = &mut new => panic!("new report unexpectedly finished: {result:?}"),
        () = new_fixture.phase("ready") => {}
    }
    let new_flag = app
        .state::<AppState>()
        .analysis_cancel_flags
        .get(ID)
        .unwrap()
        .clone();
    assert!(!Arc::ptr_eq(&old_flag, &new_flag));
    assert!(
        old_flag.load(Ordering::SeqCst),
        "replacement must cancel the previous report"
    );
    let result = timeout(CANCEL_DEADLINE, &mut old)
        .await
        .expect("old report did not wake");
    assert!(
        matches!(result, Err(Error::AnalysisCancelled)),
        "{result:?}"
    );
    assert!(Arc::ptr_eq(
        &new_flag,
        &app.state::<AppState>()
            .analysis_cancel_flags
            .get(ID)
            .unwrap()
    ));
    old_fixture.assert_reaped();
    cancel_analysis(ID.into(), app.state()).await.unwrap();
    let result = timeout(CANCEL_DEADLINE, &mut new)
        .await
        .expect("new report did not wake");
    assert!(
        matches!(result, Err(Error::AnalysisCancelled)),
        "{result:?}"
    );
    assert!(app.state::<AppState>().analysis_cancel_flags.is_empty());
    new_fixture.assert_reaped();
}

#[tokio::test]
async fn report_lifecycle_native_write_error_is_preserved_and_reaped() {
    let app = app();
    let fixture = Fixture::new("write_error");
    let result = timeout(WATCHDOG, run(&app, &fixture.path, options(), vec![]))
        .await
        .unwrap();
    assert!(
        matches!(&result, Err(Error::Io(error)) if error.kind() == std::io::ErrorKind::BrokenPipe),
        "{result:?}"
    );
    assert!(app.state::<AppState>().analysis_cancel_flags.is_empty());
    fixture.assert_reaped();
}

#[tokio::test]
async fn report_lifecycle_illegal_move_is_preserved_and_reaped() {
    let app = app();
    let fixture = Fixture::new("success");
    let mut options = options();
    options.moves = vec!["e2e5".into()];
    let result = timeout(WATCHDOG, run(&app, &fixture.path, options, vec![]))
        .await
        .unwrap();
    assert!(
        matches!(result, Err(Error::IllegalUciMove(_))),
        "{result:?}"
    );
    assert!(app.state::<AppState>().analysis_cancel_flags.is_empty());
    fixture.assert_reaped();
}

#[tokio::test]
async fn report_lifecycle_last_cancellation_check_prevents_success() {
    let app = app();
    let fixture = Fixture::new("success");
    let handle = app.handle().clone();
    let observed = Arc::new(AtomicBool::new(false));
    let recorded = observed.clone();
    app.listen(crate::progress::ProgressEvent::NAME, move |event| {
        let event: serde_json::Value = serde_json::from_str(event.payload()).unwrap();
        if event["finished"] == true {
            recorded.store(true, Ordering::SeqCst);
            handle
                .state::<AppState>()
                .analysis_cancel_flags
                .get(ID)
                .unwrap()
                .store(true, Ordering::SeqCst);
        }
    });
    let result = timeout(WATCHDOG, run(&app, &fixture.path, options(), vec![]))
        .await
        .unwrap();
    assert!(observed.load(Ordering::SeqCst));
    assert!(
        matches!(result, Err(Error::AnalysisCancelled)),
        "{result:?}"
    );
    assert!(app.state::<AppState>().analysis_cancel_flags.is_empty());
    fixture.assert_reaped();
}

#[tokio::test]
async fn report_lifecycle_shared_quit_stop_remain_commands_and_report_reap_is_repeatable() {
    let fixture = Fixture::new("success");
    let mut base = BaseEngine::spawn(fixture.path.clone()).await.unwrap();
    timeout(WATCHDOG, async {
        base.init_uci().await.unwrap();
        base.stop().await.unwrap();
        base.quit().await.unwrap();
        // The fixture ignores quit. Shared commands must not forcibly terminate it.
        base.init_uci().await.unwrap();
        base.terminate_report().await.unwrap();
        base.terminate_report().await.unwrap();
    })
    .await
    .unwrap();
    fixture.assert_reaped();
}

#[tokio::test]
async fn report_lifecycle_already_exited_child_is_waited() {
    let fixture = Fixture::new("init_eof");
    let mut base = BaseEngine::spawn(fixture.path.clone()).await.unwrap();
    timeout(WATCHDOG, async {
        assert!(matches!(
            base.init_uci().await,
            Err(Error::EngineDisconnected)
        ));
        base.terminate_report().await.unwrap();
        base.terminate_report().await.unwrap();
    })
    .await
    .unwrap();
    fixture.assert_reaped();
}
