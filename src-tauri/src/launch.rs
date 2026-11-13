#[cfg(any(target_os = "linux", test))]
use std::ffi::OsString;

#[cfg(any(target_os = "linux", test))]
fn x11_requested(args: impl IntoIterator<Item = OsString>) -> bool {
    args.into_iter()
        .skip(1)
        .take_while(|arg| arg != "--")
        .any(|arg| arg == "--x11")
}

#[cfg(target_os = "linux")]
pub fn configure_display_backend() {
    if x11_requested(std::env::args_os()) {
        // This must run before GTK is initialized or any threads are started.
        // An explicit CLI choice takes precedence over GDK_BACKEND.
        std::env::set_var("GDK_BACKEND", "x11");
    }
}

pub fn file_from_args(args: &[String], cwd: &str) -> Option<String> {
    let mut file = None;
    let mut positional_only = false;
    for arg in args.iter().skip(1) {
        if !positional_only {
            match arg.as_str() {
                "--" => {
                    positional_only = true;
                    continue;
                }
                "--x11" if cfg!(target_os = "linux") => continue,
                _ if arg.starts_with('-') => return None,
                _ => {}
            }
        }
        if file.replace(arg).is_some() {
            return None;
        }
    }
    let file = file?;
    if file.to_ascii_lowercase().starts_with("encroissant:") {
        return None;
    }
    Some(
        std::path::Path::new(cwd)
            .join(file)
            .to_string_lossy()
            .into_owned(),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn arguments(args: &[&str]) -> Vec<String> {
        args.iter().map(|arg| (*arg).to_string()).collect()
    }

    fn requests_x11(args: &[&str]) -> bool {
        x11_requested(args.iter().map(|arg| OsString::from(*arg)))
    }

    #[test]
    fn display_backend_is_opt_in() {
        assert!(!requests_x11(&["app"]));
        assert!(!requests_x11(&["app", "game.pgn"]));
        assert!(requests_x11(&["app", "--x11"]));
        assert!(requests_x11(&["app", "game.pgn", "--x11"]));
    }

    #[test]
    fn backend_flag_respects_end_of_options() {
        assert!(!requests_x11(&["app", "--", "--x11"]));
        assert!(requests_x11(&["app", "--x11", "--", "game.pgn"]));
    }

    #[test]
    fn backend_flag_requires_an_exact_match() {
        assert!(!requests_x11(&["app", "--x11=false"]));
        assert!(!requests_x11(&["app", "encroissant://import?url=--x11"]));
    }

    #[test]
    fn forwards_a_single_file() {
        let expected = std::path::Path::new("games").join("my game.pgn");
        assert_eq!(
            file_from_args(&arguments(&["app", "my game.pgn"]), "games"),
            Some(expected.to_string_lossy().into_owned())
        );
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn forwards_files_with_the_backend_flag_in_either_order() {
        let expected = Some("/games/my game.pgn".to_string());
        assert_eq!(
            file_from_args(&arguments(&["app", "--x11", "my game.pgn"]), "/games"),
            expected
        );
        assert_eq!(
            file_from_args(&arguments(&["app", "my game.pgn", "--x11"]), "/games"),
            expected
        );
    }

    #[test]
    fn does_not_forward_flags_or_multiple_files() {
        for args in [
            vec!["app"],
            vec!["app", "--x11"],
            vec!["app", "--unknown", "game.pgn"],
            vec!["app", "one.pgn", "two.pgn"],
            vec!["app", "--x11", "one.pgn", "two.pgn"],
        ] {
            assert_eq!(file_from_args(&arguments(&args), "games"), None);
        }
    }

    #[test]
    fn forwards_flag_like_filenames_after_end_of_options() {
        let expected = std::path::Path::new("games").join("--x11");
        assert_eq!(
            file_from_args(&arguments(&["app", "--", "--x11"]), "games"),
            Some(expected.to_string_lossy().into_owned())
        );
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn combines_backend_selection_with_end_of_options() {
        assert_eq!(
            file_from_args(&arguments(&["app", "--x11", "--", "--game.pgn"]), "/games"),
            Some("/games/--game.pgn".to_string())
        );
    }

    #[test]
    fn leaves_deep_links_to_the_deep_link_handler() {
        assert_eq!(
            file_from_args(
                &arguments(&["app", "encroissant://import?url=game"]),
                "games"
            ),
            None
        );
        assert_eq!(
            file_from_args(
                &arguments(&["app", "--x11", "ENCROISSANT://import"]),
                "games"
            ),
            None
        );
    }
}
