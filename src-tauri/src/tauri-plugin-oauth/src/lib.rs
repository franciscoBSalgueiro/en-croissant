use std::{
    borrow::Cow,
    io::{Read, Write},
    net::{SocketAddr, TcpListener, TcpStream},
    thread,
};

use tauri::{
    plugin::{Builder, TauriPlugin},
    Runtime,
};

const EXIT: [u8; 4] = [1, 3, 3, 7];

/// Starts the localhost (using 127.0.0.1) server. Returns the port its listening on.
///
/// Because of the unprotected localhost port, you _must_ verify the URL in the handler function.
///
/// # Arguments
///
/// * `handler` - Closure which will be executed on a successful connection. It receives the full URL as a String.
///
/// # Errors
///
/// - Returns `std::io::Error` if the server creation fails.
///
/// # Panics
///
/// The seperate server thread can panic if its unable to send the html response to the client. This may change after more real world testing.
pub fn start<F: FnMut(String) + Send + 'static>(handler: F) -> Result<u16, std::io::Error> {
    start_with_config(OauthConfig::default(), handler)
}

/// The optional server config.
#[derive(Default, serde::Deserialize)]
pub struct OauthConfig {
    /// An array of hard-coded ports the server should try to bind to.
    /// This should only be used if your oauth provider does not accept wildcard localhost addresses.
    ///
    /// Default: Asks the system for a free port.
    pub ports: Option<Vec<u16>>,
    /// Optional static html string send to the user after being redirected.
    /// Keep it self-contained and as small as possible.
    ///
    /// Default: `"<html><body>Please return to the app.</body></html>"`.
    pub response: Option<Cow<'static, str>>,
}

/// Starts the localhost (using 127.0.0.1) server. Returns the port its listening on.
///
/// Because of the unprotected localhost port, you _must_ verify the URL in the handler function.
///
/// # Arguments
///
/// * `config` - Configuration the server should use, see [`OauthConfig.]
/// * `handler` - Closure which will be executed on a successful connection. It receives the full URL as a String.
///
/// # Errors
///
/// - Returns `std::io::Error` if the server creation fails.
///
/// # Panics
///
/// The seperate server thread can panic if its unable to send the html response to the client. This may change after more real world testing.
pub fn start_with_config<F: FnMut(String) + Send + 'static>(
    config: OauthConfig,
    mut handler: F,
) -> Result<u16, std::io::Error> {
    let listener = match config.ports {
        Some(ports) => TcpListener::bind(
            ports
                .iter()
                .map(|p| SocketAddr::from(([127, 0, 0, 1], *p)))
                .collect::<Vec<SocketAddr>>()
                .as_slice(),
        ),
        None => TcpListener::bind(SocketAddr::from(([127, 0, 0, 1], 0))),
    }?;

    let port = listener.local_addr()?.port();

    thread::spawn(move || {
        for conn in listener.incoming() {
            match conn {
                Ok(conn) => {
                    if let Some(url) = handle_connection(conn, config.response.as_deref(), port) {
                        // Using an empty string to communicate that a shutdown was requested.
                        if !url.is_empty() {
                            handler(url);
                        }
                        // TODO: Check if exiting here is always okay.
                        break;
                    }
                }
                Err(err) => {
                    log::error!("Error reading incoming connection: {}", err.to_string());
                }
            }
        }
    });

    Ok(port)
}

fn handle_connection(mut conn: TcpStream, response: Option<&str>, port: u16) -> Option<String> {
    let mut buffer = [0; 4048];
    if let Err(io_err) = conn.read(&mut buffer) {
        log::error!("Error reading incoming connection: {}", io_err.to_string());
    };
    if buffer[..4] == EXIT {
        return Some(String::new());
    }

    let mut headers = [httparse::EMPTY_HEADER; 16];
    let mut request = httparse::Request::new(&mut headers);
    request.parse(&buffer).ok()?;

    let path = request.path.unwrap_or_default();

    if path == "/exit" {
        return Some(String::new());
    };

    let mut is_localhost = false;

    for header in &headers {
        if header.name == "Full-Url" {
            return Some(String::from_utf8_lossy(header.value).to_string());
        } else if header.name == "Host" {
            is_localhost = String::from_utf8_lossy(header.value).starts_with("localhost");
        }
    }
    if path == "/cb" {
        log::error!(
            "Client fetched callback path but the request didn't contain the expected header."
        );
    }

    let script = format!(
        r#"<script>fetch("http://{}:{}/cb",{{headers:{{"Full-Url":window.location.href}}}})</script>"#,
        if is_localhost {
            "localhost"
        } else {
            "127.0.0.1"
        },
        port
    );
    let response = match response {
        Some(s) if s.contains("<head>") => s.replace("<head>", &format!("<head>{}", script)),
        Some(s) if s.contains("<body>") => {
            s.replace("<body>", &format!("<head>{}</head><body>", script))
        }
        Some(s) => {
            log::warn!(
                "`response` does not contain a body or head element. Prepending a head element..."
            );
            format!("<head>{}</head>{}", script, s)
        }
        None => format!(
            "<html><head>{}</head><body>Please return to the app.</body></html>",
            script
        ),
    };

    // TODO: Test if unwrapping here is safe (enough).
    conn.write_all(
        format!(
            "HTTP/1.1 200 OK\r\nContent-Length: {}\r\n\r\n{}",
            response.len(),
            response
        )
        .as_bytes(),
    )
    .unwrap();
    conn.flush().unwrap();

    None
}

/// Stops the currently running server behind the provided port without executing the handler.
/// Alternatively you can send a request to http://127.0.0.1:port/exit
///
/// # Errors
///
/// - Returns `std::io::Error` if the server couldn't be reached.
pub fn cancel(port: u16) -> Result<(), std::io::Error> {
    // Using tcp instead of something global-ish like an AtomicBool,
    // so we don't have to dive into the set_nonblocking madness.
    let mut stream = TcpStream::connect(SocketAddr::from(([127, 0, 0, 1], port)))?;
    stream.write_all(&EXIT)?;
    stream.flush()?;

    Ok(())
}

mod plugin_impl {
    use tauri::{Manager, Runtime, Window};

    #[tauri::command]
    pub(crate) fn start<R: Runtime>(
        window: Window<R>,
        config: Option<super::OauthConfig>,
    ) -> Result<u16, String> {
        let mut config = config.unwrap_or_default();
        if config.response.is_none() {
            config.response = window
                .config()
                .plugins
                .0
                .get("oauth")
                .map(|v| v.as_str().unwrap().to_string().into());
        }

        crate::start_with_config(config, move |url| match url::Url::parse(&url) {
            Ok(_) => {
                if let Err(emit_err) = window.emit("oauth://url", url) {
                    log::error!("Error emitting oauth://url event: {}", emit_err)
                };
            }
            Err(err) => {
                if let Err(emit_err) = window.emit("oauth://invalid-url", err.to_string()) {
                    log::error!("Error emitting oauth://invalid-url event: {}", emit_err)
                };
            }
        })
        .map_err(|err| err.to_string())
    }

    #[tauri::command]
    pub(crate) fn cancel(port: u16) -> Result<(), String> {
        crate::cancel(port).map_err(|err| err.to_string())
    }
}

/// Initializes the tauri plugin.
/// Only use this if you need the JavaScript APIs.
///
/// Note for the `start()` command: If `response` is not provided it will fall back to the config
/// in tauri.conf.json if set and will fall back to the library's default, see [`OauthConfig`].
#[must_use]
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("oauth")
        .invoke_handler(tauri::generate_handler![
            plugin_impl::start,
            plugin_impl::cancel
        ])
        .build()
}
