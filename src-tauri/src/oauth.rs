use axum::{extract::Query, response::IntoResponse, routing::get, Extension, Router};
use log::info;
use oauth2::{
    basic::BasicClient, reqwest::async_http_client, AuthUrl, AuthorizationCode, ClientId,
    CsrfToken, PkceCodeChallenge, PkceCodeVerifier, RedirectUrl, Scope, TokenResponse, TokenUrl,
};
use serde::Deserialize;
use std::{
    net::{SocketAddr, TcpListener},
    sync::Arc,
};
use tauri::{Emitter, Manager};
use tauri_plugin_shell::ShellExt;

use crate::{error::Error, AppState};

fn create_client(redirect_url: RedirectUrl) -> BasicClient {
    let client_id = ClientId::new("org.encroissant.app".to_string());
    let auth_url = AuthUrl::new("https://lichess.org/oauth".to_string());
    let token_url = TokenUrl::new("https://lichess.org/api/token".to_string());

    BasicClient::new(client_id, None, auth_url.unwrap(), token_url.ok())
        .set_redirect_uri(redirect_url)
}

fn get_available_addr() -> SocketAddr {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let addr = listener.local_addr().unwrap();
    drop(listener);

    addr
}

#[derive(Clone)]
pub struct AuthState {
    pub csrf_token: CsrfToken,
    pub pkce: Arc<(PkceCodeChallenge, String)>,
    pub client: Arc<BasicClient>,
    pub socket_addr: SocketAddr,
}

impl Default for AuthState {
    fn default() -> Self {
        let (pkce_code_challenge, pkce_code_verifier) = PkceCodeChallenge::new_random_sha256();
        let socket_addr = get_available_addr();
        let redirect_url = format!("http://{socket_addr}/callback");
        AuthState {
            csrf_token: CsrfToken::new_random(),
            pkce: Arc::new((
                pkce_code_challenge,
                PkceCodeVerifier::secret(&pkce_code_verifier).to_string(),
            )),
            client: Arc::new(create_client(RedirectUrl::new(redirect_url).unwrap())),
            socket_addr,
        }
    }
}

#[tauri::command]
#[specta::specta]
pub async fn authenticate(
    username: String,
    state: tauri::State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<(), Error> {
    info!("Authenticating user {}", username);
    let (auth_url, _) = state
        .auth
        .client
        .authorize_url(|| state.auth.csrf_token.clone())
        .add_scope(Scope::new("preference:read".to_string()))
        .add_extra_param("username", username)
        .set_pkce_challenge(state.auth.pkce.0.clone())
        .url();
    app.shell().open(auth_url, None)?;
    let _server_handle = tauri::async_runtime::spawn(async move { run_server(app).await });
    Ok(())
}

#[derive(Deserialize)]
struct CallbackQuery {
    code: AuthorizationCode,
    state: CsrfToken,
}

async fn authorize(
    app: Extension<tauri::AppHandle>,
    query: Query<CallbackQuery>,
) -> impl IntoResponse {
    let auth = &app.state::<AppState>().auth;

    if query.state.secret() != auth.csrf_token.secret() {
        println!("Suspected Man in the Middle attack!");
        return "authorized".to_string(); // never let them know your next move
    }

    let token = auth
        .client
        .exchange_code(query.code.clone())
        .set_pkce_verifier(PkceCodeVerifier::new(auth.pkce.1.clone()))
        .request_async(async_http_client)
        .await
        .unwrap();

    let access_token = token.access_token().secret();
    app.emit("access_token", access_token).unwrap();

    "authorized".to_string()
}

async fn run_server(handle: tauri::AppHandle) -> Result<(), axum::Error> {
    let app = Router::new()
        .route("/callback", get(authorize))
        .layer(Extension(handle.clone()));

    let _ = axum::Server::bind(&handle.state::<AppState>().auth.socket_addr.clone())
        .serve(app.into_make_service())
        .await;

    Ok(())
}
