//! Integration tests use only a tiny local UCI fixture, never an installed engine.
use super::*;
use std::{os::unix::fs::PermissionsExt, path::Path, time::Duration};
use tempfile::TempDir;

struct FakeEngine {
    directory: TempDir,
    path: PathBuf,
}

impl FakeEngine {
    fn new() -> Self {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("fake-uci");
        std::fs::write(
            &path,
            r#"#!/bin/sh
cd "$(dirname "$0")" || exit 1
printf '%s\n' "$$" >> starts
sleep 60 &
worker=$!
printf '%s\n' "$worker" >> workers
while IFS= read -r command; do
  case "$command" in
    uci) printf 'uciok\n' ;;
    isready)
      printf '%s\n' "$$" >> waiting
      while [ ! -f ready ]; do sleep 0.01; done
      printf 'readyok\n' ;;
    setoption*)
      if [ -f block-options ]; then
        printf '%s\n' "$$" >> options-waiting
        while [ -f block-options ]; do sleep 0.01; done
      fi ;;
    position*) printf '%s\n' "$command" >> positions ;;
    go*) printf '%s\n' "$command" >> searches ;;
    stop) printf 'bestmove e2e4\n' ;;
    quit) kill "$worker" 2>/dev/null; wait "$worker" 2>/dev/null; exit 0 ;;
  esac
done
kill "$worker" 2>/dev/null
wait "$worker" 2>/dev/null
"#,
        )
        .unwrap();
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o755)).unwrap();
        Self { directory, path }
    }

    fn lines(&self, name: &str) -> Vec<String> {
        std::fs::read_to_string(self.directory.path().join(name))
            .unwrap_or_default()
            .lines()
            .map(str::to_owned)
            .collect()
    }

    fn ready(&self) {
        std::fs::write(self.directory.path().join("ready"), "").unwrap();
    }

    async fn wait_for_lines(&self, name: &str, count: usize) {
        tokio::time::timeout(Duration::from_secs(5), async {
            while self.lines(name).len() < count {
                tokio::time::sleep(Duration::from_millis(5)).await;
            }
        })
        .await
        .unwrap_or_else(|_| panic!("Timed out waiting for {name} {count}"));
    }

    async fn assert_exited(&self) {
        for pid in self
            .lines("starts")
            .into_iter()
            .chain(self.lines("workers"))
        {
            let pid: i32 = pid.parse().unwrap();
            tokio::time::timeout(Duration::from_secs(5), async {
                while unsafe { libc::kill(pid, 0) } == 0 {
                    tokio::time::sleep(Duration::from_millis(10)).await;
                }
            })
            .await
            .unwrap_or_else(|_| panic!("Fixture process {pid} survived cleanup"));
        }
    }
}

impl Drop for FakeEngine {
    fn drop(&mut self) {
        // A failed assertion must not leave the test fixture running. Each
        // fixture leader owns a process group created by BaseEngine::spawn.
        for pid in self.lines("starts") {
            if let Ok(pid) = pid.parse::<i32>() {
                unsafe {
                    libc::killpg(pid, libc::SIGKILL);
                }
            }
        }
    }
}

fn options(moves: &[&str]) -> EngineOptions {
    EngineOptions {
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1".into(),
        moves: moves.iter().map(|s| (*s).into()).collect(),
        extra_options: Vec::new(),
    }
}

fn request(
    registry: &Arc<EngineRegistry>,
    key: &EngineKey,
    path: &Path,
    moves: &[&str],
) -> tokio::task::JoinHandle<Result<(Arc<EngineSession>, EngineRequest), Error>> {
    let (registry, key, path, options) = (
        registry.clone(),
        key.clone(),
        path.to_owned(),
        options(moves),
    );
    tokio::spawn(async move {
        registry
            .request(&key, path, options, GoMode::Infinite)
            .await
    })
}

async fn finish(
    task: tokio::task::JoinHandle<Result<(Arc<EngineSession>, EngineRequest), Error>>,
) -> (Arc<EngineSession>, EngineRequest) {
    tokio::time::timeout(Duration::from_secs(5), task)
        .await
        .unwrap()
        .unwrap()
        .unwrap()
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn engine_lifecycle_concurrent_delayed_startup_spawns_once() {
    let fixture = FakeEngine::new();
    let registry = Arc::new(EngineRegistry::default());
    let key = ("tab".into(), "maia".into());
    let first = request(&registry, &key, &fixture.path, &[]);
    fixture.wait_for_lines("waiting", 1).await;
    let more: Vec<_> = (0..7)
        .map(|_| request(&registry, &key, &fixture.path, &["e2e4"]))
        .collect();
    tokio::time::sleep(Duration::from_millis(150)).await;
    assert_eq!(
        fixture.lines("starts").len(),
        1,
        "Pending requests must share one startup"
    );
    fixture.ready();
    let (session, first) = finish(first).await;
    assert!(matches!(first, EngineRequest::Started { .. }));
    let mut held_readers = vec![first];
    for task in more {
        let (other, result) = finish(task).await;
        assert!(Arc::ptr_eq(&session, &other));
        assert!(matches!(result, EngineRequest::Existing(_)));
        held_readers.push(result);
    }
    assert_eq!(fixture.lines("starts").len(), 1);
    registry.release(&key).await.unwrap();
    fixture.assert_exited().await;
}

#[tokio::test]
async fn engine_lifecycle_close_tab_cancels_initialization_and_queued_requests() {
    let fixture = FakeEngine::new();
    let registry = Arc::new(EngineRegistry::default());
    let key = ("tab".into(), "maia".into());
    let first = request(&registry, &key, &fixture.path, &[]);
    fixture.wait_for_lines("waiting", 1).await;
    let second = request(&registry, &key, &fixture.path, &["e2e4"]);
    // Let the second command acquire the already registered slot before closing.
    tokio::task::yield_now().await;
    registry.release_tab("tab").await.unwrap();
    assert!(matches!(finish(first).await.1, EngineRequest::Cancelled));
    assert!(matches!(finish(second).await.1, EngineRequest::Cancelled));
    assert!(registry.session(&key).is_none());
    assert!(fixture.lines("searches").is_empty());
    registry.release(&key).await.unwrap();
    registry.release_tab("tab").await.unwrap();
    fixture.assert_exited().await;
}

#[tokio::test]
async fn engine_lifecycle_stop_during_initialization_does_not_start_search() {
    let fixture = FakeEngine::new();
    let registry = Arc::new(EngineRegistry::default());
    let key = ("tab".into(), "maia".into());
    let pending = request(&registry, &key, &fixture.path, &[]);
    fixture.wait_for_lines("waiting", 1).await;
    registry.stop(&key).await.unwrap();
    assert!(matches!(finish(pending).await.1, EngineRequest::Cancelled));
    assert!(fixture.lines("searches").is_empty());
    fixture.assert_exited().await;
}

#[tokio::test]
async fn engine_lifecycle_old_reader_cannot_remove_restarted_engine() {
    let fixture = FakeEngine::new();
    fixture.ready();
    let registry = Arc::new(EngineRegistry::default());
    let key = ("tab".into(), "maia".into());
    let (old_session, old) = finish(request(&registry, &key, &fixture.path, &[])).await;
    let old_guard = EngineReaderGuard::new(&registry, key.clone(), old_session.clone());
    registry.release(&key).await.unwrap();
    let (new_session, new) = finish(request(&registry, &key, &fixture.path, &["e2e4"])).await;
    assert!(!Arc::ptr_eq(&old_session, &new_session));
    drop(old_guard);
    drop(old);
    assert!(Arc::ptr_eq(&registry.session(&key).unwrap(), &new_session));
    assert!(!new_session.is_cancelled());
    registry.release(&key).await.unwrap();
    drop(new);
    fixture.assert_exited().await;
}

#[tokio::test]
async fn engine_lifecycle_position_changes_and_pause_resume_reuse_process() {
    let fixture = FakeEngine::new();
    fixture.ready();
    let registry = Arc::new(EngineRegistry::default());
    let key = ("tab".into(), "maia".into());
    let (session, started) = finish(request(&registry, &key, &fixture.path, &[])).await;
    for moves in [vec!["e2e4"], vec!["e2e4", "e7e5"], vec!["d2d4"]] {
        assert!(matches!(
            finish(request(&registry, &key, &fixture.path, &moves))
                .await
                .1,
            EngineRequest::Existing(_)
        ));
    }
    registry.stop(&key).await.unwrap();
    assert!(!session.process().unwrap().lock().await.running);
    finish(request(&registry, &key, &fixture.path, &["d2d4"])).await;
    assert!(session.process().unwrap().lock().await.running);
    fixture.wait_for_lines("positions", 4).await;
    assert_eq!(fixture.lines("starts").len(), 1);
    assert!(fixture
        .lines("positions")
        .last()
        .unwrap()
        .ends_with("moves d2d4"));
    registry.release(&key).await.unwrap();
    drop(started);
    fixture.assert_exited().await;
}

#[tokio::test]
async fn engine_lifecycle_different_engine_ids_and_tabs_remain_independent() {
    let fixture = FakeEngine::new();
    fixture.ready();
    let registry = Arc::new(EngineRegistry::default());
    let keys = [
        ("tab", "maia1600"),
        ("tab", "maia2600"),
        ("other", "maia1600"),
    ]
    .map(|(tab, id)| (tab.into(), id.into()));
    let mut held = Vec::new();
    for key in &keys {
        held.push(finish(request(&registry, key, &fixture.path, &[])).await);
    }
    assert_eq!(fixture.lines("starts").len(), 3);
    registry.release_tab("tab").await.unwrap();
    assert!(registry.session(&keys[0]).is_none());
    assert!(registry.session(&keys[1]).is_none());
    assert!(!registry.session(&keys[2]).unwrap().is_cancelled());
    registry.release(&keys[2]).await.unwrap();
    drop(held);
    fixture.assert_exited().await;
}

#[tokio::test]
async fn engine_lifecycle_exit_kills_pending_wrapper_and_child() {
    let fixture = FakeEngine::new();
    let registry = Arc::new(EngineRegistry::default());
    let key = ("tab".into(), "maia".into());
    let pending = request(&registry, &key, &fixture.path, &[]);
    fixture.wait_for_lines("waiting", 1).await;
    registry.kill_all_sync();
    assert!(matches!(finish(pending).await.1, EngineRequest::Cancelled));
    registry.release(&key).await.unwrap();
    fixture.assert_exited().await;
}

#[tokio::test]
async fn engine_lifecycle_aborted_initializer_retires_process_and_reader_slot() {
    let fixture = FakeEngine::new();
    fixture.ready();
    std::fs::write(fixture.directory.path().join("block-options"), "").unwrap();
    let registry = Arc::new(EngineRegistry::default());
    let key = ("tab".into(), "maia".into());
    let mut settings = options(&[]);
    settings.extra_options.push(EngineOption {
        name: "LargeOption".into(),
        value: "x".repeat(1024 * 1024),
    });
    let (cloned, copied_key, path) = (registry.clone(), key.clone(), fixture.path.clone());
    let pending = tokio::spawn(async move {
        cloned
            .request(&copied_key, path, settings, GoMode::Infinite)
            .await
    });
    fixture.wait_for_lines("options-waiting", 1).await;
    assert!(registry.session(&key).unwrap().process().is_some());
    pending.abort();
    assert!(matches!(pending.await, Err(error) if error.is_cancelled()));
    assert!(registry.session(&key).is_none());
    fixture.assert_exited().await;
    std::fs::remove_file(fixture.directory.path().join("block-options")).unwrap();
    let (_, result) = finish(request(&registry, &key, &fixture.path, &[])).await;
    assert!(matches!(result, EngineRequest::Started { .. }));
    registry.release(&key).await.unwrap();
    fixture.assert_exited().await;
}

#[tokio::test]
async fn engine_lifecycle_different_keys_initialize_concurrently() {
    let fixture = FakeEngine::new();
    let registry = Arc::new(EngineRegistry::default());
    let first = ("tab".into(), "maia1600".into());
    let second = ("tab".into(), "maia2600".into());
    let a = request(&registry, &first, &fixture.path, &[]);
    let b = request(&registry, &second, &fixture.path, &[]);
    fixture.wait_for_lines("waiting", 2).await;
    assert_eq!(fixture.lines("starts").len(), 2);
    fixture.ready();
    let held = [finish(a).await, finish(b).await];
    registry.release_tab("tab").await.unwrap();
    drop(held);
    fixture.assert_exited().await;
}

#[tokio::test]
async fn engine_lifecycle_late_request_cannot_reopen_closed_tab() {
    let fixture = FakeEngine::new();
    fixture.ready();
    let registry = Arc::new(EngineRegistry::default());
    registry.release_tab("closed-tab").await.unwrap();
    for tab in ["closed-tab", "closed-tab-analysis"] {
        let key = (tab.into(), "maia".into());
        let (_, result) = finish(request(&registry, &key, &fixture.path, &[])).await;
        assert!(matches!(result, EngineRequest::Cancelled));
        assert!(registry.session(&key).is_none());
    }
    assert!(fixture.lines("starts").is_empty());
    // A different newly opened tab still starts normally.
    let key = ("new-tab".into(), "maia".into());
    let (_, result) = finish(request(&registry, &key, &fixture.path, &[])).await;
    assert!(matches!(result, EngineRequest::Started { .. }));
    registry.release(&key).await.unwrap();
    fixture.assert_exited().await;
}
