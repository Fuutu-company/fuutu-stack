//! Sign-in to the saas backend and authenticated API calls.
//!
//! - OAuth 2.1 authorization code + PKCE in the SYSTEM browser (RFC 8252):
//!   loopback redirect `http://127.0.0.1:<port>/callback`, deep link
//!   `<scheme>://auth/callback` when no loopback port can be opened.
//! - Tokens never reach the webview: the refresh token lives in the OS
//!   keychain, the access token in memory; the webview calls the backend
//!   through `auth_api_fetch`, which only talks to `<saas>/api/*` (never
//!   `/api/auth/*`) and adds the bearer.
//! - `auth_session` = `desktop.session` plus the offline grace: with the
//!   backend unreachable it answers from a verified offline claim
//!   (`offline.rs`) or not at all.

mod loopback;
mod offline;
mod pkce;
mod store;

use std::path::PathBuf;
use std::sync::Mutex as StdMutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use reqwest::{Method, StatusCode};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_opener::OpenerExt;
use tokio::sync::{oneshot, Mutex};
use url::Url;

use crate::config::RuntimeConfig;
pub use loopback::CallbackPage;
use loopback::{Callback, Listener};
pub use offline::OfflineClaim;
use offline::OfflineProof;
use store::{Keychain, INSTALL_KEY, OFFLINE_PROOF, OFFLINE_SEEN, REFRESH_TOKEN};

/// Emitted with `true` / `false` when the sign-in state changes.
pub const AUTH_CHANGED_EVENT: &str = "desktop://auth-changed";
/// Emitted when the app should reload its session (deep link back from
/// the browser after a purchase or account change).
pub const SESSION_REFRESH_EVENT: &str = "desktop://session-refresh";

const SIGN_IN_TIMEOUT: Duration = Duration::from_secs(300);
const HTTP_TIMEOUT: Duration = Duration::from_secs(30);
/// Refresh this long before the access token expires.
const EXPIRY_SKEW_SECS: u64 = 60;
const SCOPES: &str = "openid profile email offline_access";
const SESSION_FILE: &str = "session.json";

#[derive(Debug, Serialize, PartialEq)]
#[serde(tag = "kind", content = "message", rename_all = "snake_case")]
pub enum AuthError {
    /// Backend unreachable (offline, DNS, TLS, 5xx).
    Network(String),
    SignedOut,
    /// The backend refused (OAuth error, 4xx).
    Rejected(String),
    /// Auth off or no backend URL in this build.
    Unavailable(String),
    Keychain(String),
    Invalid(String),
    Cancelled,
    Timeout,
}

type Result<T> = std::result::Result<T, AuthError>;

fn network(err: impl std::fmt::Display) -> AuthError {
    AuthError::Network(err.to_string())
}

fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

struct AccessToken {
    token: String,
    expires_at: u64,
}

struct PendingSignIn {
    state: String,
    deliver: oneshot::Sender<Callback>,
}

pub struct AuthState {
    mode: String,
    offline_grace_days: u32,
    offline_keys: Vec<String>,
    saas: Option<Url>,
    client_id: String,
    scheme: String,
    keychain: Keychain,
    http: reqwest::Client,
    session_file: Option<PathBuf>,
    /// Also serialises refreshes (refresh tokens rotate).
    access: Mutex<Option<AccessToken>>,
    pending: StdMutex<Option<PendingSignIn>>,
}

/// `<saas>/api/<…>` for a webview request — same origin, below `/api/`,
/// never the auth endpoints (the bearer must not reach Better Auth's
/// session-cookie routes).
pub fn api_url(saas: &Url, path: &str) -> Result<Url> {
    let invalid = || AuthError::Invalid("path must be below /api/".into());
    // No percent-encoding in the path: the server decodes `%61uth` → `auth`
    // after this check would have passed.
    let path_part = path.split('?').next().unwrap_or_default();
    if !path.starts_with("/api/") || path.contains('\\') || path.contains('#') || path_part.contains('%') {
        return Err(invalid());
    }
    let url = saas.join(path).map_err(|_| invalid())?;
    let ok = url.origin() == saas.origin()
        && url.path().starts_with("/api/")
        && !url.path().starts_with("/api/auth/")
        && url.path() != "/api/auth";
    ok.then_some(url).ok_or_else(invalid)
}

/// Authorization request URL (`/api/auth/oauth2/authorize`).
pub fn authorize_url(
    saas: &Url,
    client_id: &str,
    redirect_uri: &str,
    challenge: &str,
    state: &str,
) -> Url {
    let mut url = saas.join("/api/auth/oauth2/authorize").expect("valid base");
    url.query_pairs_mut()
        .append_pair("response_type", "code")
        .append_pair("client_id", client_id)
        .append_pair("redirect_uri", redirect_uri)
        .append_pair("scope", SCOPES)
        .append_pair("code_challenge", challenge)
        .append_pair("code_challenge_method", "S256")
        .append_pair("state", state)
        .append_pair("resource", &resource(saas));
    url
}

/// The desktop audience (`desktopOAuth.resource`).
fn resource(saas: &Url) -> String {
    format!("{}/api/rpc", saas.origin().ascii_serialization())
}

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
    #[serde(default)]
    refresh_token: Option<String>,
    #[serde(default)]
    expires_in: Option<u64>,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct ApiRequest {
    pub path: String,
    pub method: Option<String>,
    /// JSON body.
    pub body: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ApiResponse {
    pub status: u16,
    pub body: String,
}

#[derive(Debug, Serialize)]
#[serde(tag = "state", rename_all = "snake_case")]
pub enum SessionResult {
    SignedOut,
    /// Fresh `desktop.session` response.
    Online { session: Value },
    /// Backend unreachable, offline grace valid. `session` is the last
    /// cached response (display only — decide access from `claim`).
    Offline {
        session: Option<Value>,
        claim: OfflineClaim,
    },
    /// Backend unreachable and no valid offline claim.
    Unreachable { reason: String },
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthStatus {
    /// `required` | `optional` | `off`.
    pub mode: String,
    /// Backend URL compiled in and auth not off.
    pub available: bool,
    pub signed_in: bool,
}

impl AuthState {
    pub fn new(config: &RuntimeConfig, user_agent: &str, data_dir: Option<PathBuf>) -> Self {
        let http = reqwest::Client::builder()
            .user_agent(user_agent)
            .timeout(HTTP_TIMEOUT)
            // Never follow a redirect with the bearer attached.
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .expect("HTTP client");
        Self {
            mode: config.auth.clone(),
            offline_grace_days: config.offline_grace_days,
            offline_keys: config.offline_keys.clone(),
            saas: config
                .saas_url
                .as_deref()
                .and_then(|raw| Url::parse(raw).ok()),
            client_id: config.identity.oauth_client_id.clone(),
            scheme: config.identity.scheme.clone(),
            keychain: Keychain::new(&config.identity.keychain_service, data_dir.clone()),
            http,
            session_file: data_dir.map(|dir| dir.join(SESSION_FILE)),
            access: Mutex::new(None),
            pending: StdMutex::new(None),
        }
    }

    fn saas(&self) -> Result<&Url> {
        if self.mode == "off" {
            return Err(AuthError::Unavailable("desktop auth is off".into()));
        }
        self.saas
            .as_ref()
            .ok_or_else(|| AuthError::Unavailable("no backend URL in this build".into()))
    }

    /// The access token for other Rust callers (updater) — `None` when
    /// signed out or offline.
    pub async fn bearer(&self, app: &AppHandle) -> Option<String> {
        if self.saas().is_err() {
            return None;
        }
        self.access_token(app, None).await.ok()
    }

    fn offline_audience(&self) -> String {
        format!("{}:offline", self.client_id)
    }

    /// This install's public key (base64url), created on first use. The
    /// seed stays in the keychain; only the public key is sent.
    fn install_public_key(&self) -> std::result::Result<String, String> {
        let seed = match self.keychain.get(INSTALL_KEY)? {
            Some(raw) => URL_SAFE_NO_PAD
                .decode(raw)
                .ok()
                .and_then(|raw| <[u8; 32]>::try_from(raw).ok()),
            None => None,
        };
        let seed = match seed {
            Some(seed) => seed,
            None => {
                let seed: [u8; 32] = rand::random();
                self.keychain.set(INSTALL_KEY, &URL_SAFE_NO_PAD.encode(seed))?;
                seed
            }
        };
        let key = ed25519_dalek::SigningKey::from_bytes(&seed);
        Ok(URL_SAFE_NO_PAD.encode(key.verifying_key().as_bytes()))
    }

    /// Highest time an offline proof was verified at (0 = never).
    fn offline_seen(&self) -> u64 {
        match self.keychain.get(OFFLINE_SEEN) {
            Ok(Some(raw)) => raw.parse().unwrap_or(0),
            _ => 0,
        }
    }

    fn mark_offline_seen(&self, time: u64) {
        let seen = self.offline_seen().max(time);
        if let Err(err) = self.keychain.set(OFFLINE_SEEN, &seen.to_string()) {
            log::warn!("offline marker not updated: {err}");
        }
    }

    fn verify_offline(&self, proof: &OfflineProof) -> std::result::Result<OfflineClaim, &'static str> {
        let install_key = self.install_public_key().map_err(|_| "no install key")?;
        let issuer = self
            .saas
            .as_ref()
            .map(|url| url.origin().ascii_serialization())
            .ok_or("no backend")?;
        let audience = self.offline_audience();
        let policy = offline::Policy {
            audience: &audience,
            issuer: &issuer,
            max_lifetime: u64::from(self.offline_grace_days) * 86_400 + 3_600,
            trusted_keys: &self.offline_keys,
            // Release builds trust build-time keys only (RELEASING.md).
            allow_stored_key: cfg!(debug_assertions),
            install_key: &install_key,
        };
        offline::verify(proof, &policy, now(), self.offline_seen())
    }

    fn store_proof(&self, proof: &OfflineProof) -> std::result::Result<(), String> {
        let json = serde_json::to_string(proof).map_err(|e| e.to_string())?;
        self.keychain.set(OFFLINE_PROOF, &json)
    }

    async fn token_request(&self, form: &[(&str, &str)]) -> Result<TokenResponse> {
        let url = self.saas()?.join("/api/auth/oauth2/token").map_err(network)?;
        let res = self.http.post(url).form(form).send().await.map_err(network)?;
        let status = res.status();
        if status.is_success() {
            return res.json().await.map_err(network);
        }
        let body: Value = res.json().await.unwrap_or(Value::Null);
        let error = body
            .get("error")
            .and_then(Value::as_str)
            .unwrap_or("token request failed")
            .to_owned();
        if status.is_client_error() {
            Err(AuthError::Rejected(error))
        } else {
            Err(AuthError::Network(format!("{status}: {error}")))
        }
    }

    fn store_tokens(&self, tokens: &TokenResponse) -> Result<AccessToken> {
        if let Some(refresh) = &tokens.refresh_token {
            self.keychain.set(REFRESH_TOKEN, refresh).map_err(AuthError::Keychain)?;
        }
        Ok(AccessToken {
            token: tokens.access_token.clone(),
            expires_at: now() + tokens.expires_in.unwrap_or(300),
        })
    }

    /// A valid access token — refreshed when expiring, or when `failed`
    /// (a token the backend just refused) is still the cached one.
    async fn access_token(&self, app: &AppHandle, failed: Option<&str>) -> Result<String> {
        let mut cached = self.access.lock().await;
        if let Some(token) = cached.as_ref() {
            let refused = failed == Some(token.token.as_str());
            if !refused && token.expires_at > now() + EXPIRY_SKEW_SECS {
                return Ok(token.token.clone());
            }
        }
        let refresh = self
            .keychain
            .get(REFRESH_TOKEN)
            .map_err(AuthError::Keychain)?
            .ok_or(AuthError::SignedOut)?;
        let saas = self.saas()?;
        let resource = resource(saas);
        let result = self
            .token_request(&[
                ("grant_type", "refresh_token"),
                ("refresh_token", &refresh),
                ("client_id", &self.client_id),
                ("resource", &resource),
            ])
            .await;
        match result {
            Ok(tokens) => {
                let token = self.store_tokens(&tokens)?;
                let value = token.token.clone();
                *cached = Some(token);
                Ok(value)
            }
            Err(AuthError::Rejected(reason)) if is_dead_grant(&reason) => {
                // Revoked (device removed in the browser), expired or reused.
                log::info!("refresh token rejected ({reason}) — signed out");
                *cached = None;
                drop(cached);
                self.clear_local(app);
                Err(AuthError::SignedOut)
            }
            Err(err) => Err(err),
        }
    }

    async fn send(&self, url: Url, method: Method, token: Option<&str>, body: Option<&str>) -> Result<reqwest::Response> {
        let mut request = self.http.request(method, url).header("accept", "application/json");
        if let Some(token) = token {
            request = request.bearer_auth(token);
        }
        if let Some(body) = body {
            request = request
                .header("content-type", "application/json")
                .body(body.to_owned());
        }
        request.send().await.map_err(network)
    }

    /// Calls `<saas><path>` with the bearer (anonymous when signed out);
    /// one refresh + retry on 401.
    async fn fetch(&self, app: &AppHandle, request: &ApiRequest) -> Result<(StatusCode, String, bool)> {
        let url = api_url(self.saas()?, &request.path)?;
        let method = match request.method.as_deref().unwrap_or("GET").to_ascii_uppercase().as_str() {
            "GET" => Method::GET,
            "POST" => Method::POST,
            "PUT" => Method::PUT,
            "PATCH" => Method::PATCH,
            "DELETE" => Method::DELETE,
            other => return Err(AuthError::Invalid(format!("method {other} not allowed"))),
        };
        let mut token = match self.access_token(app, None).await {
            Ok(token) => Some(token),
            Err(AuthError::SignedOut) => None,
            Err(err) => return Err(err),
        };
        let body = request.body.as_deref();
        let mut res = self.send(url.clone(), method.clone(), token.as_deref(), body).await?;
        if res.status() == StatusCode::UNAUTHORIZED {
            if let Some(failed) = token.take() {
                match self.access_token(app, Some(&failed)).await {
                    Ok(fresh) => {
                        res = self.send(url, method, Some(&fresh), body).await?;
                        token = Some(fresh);
                    }
                    Err(AuthError::SignedOut) => {}
                    Err(err) => return Err(err),
                }
            }
        }
        let status = res.status();
        let text = res.text().await.map_err(network)?;
        Ok((status, text, token.is_some()))
    }

    /// Removes every local trace of the account and tells the webview.
    fn clear_local(&self, app: &AppHandle) {
        for name in [REFRESH_TOKEN, OFFLINE_PROOF] {
            if let Err(err) = self.keychain.delete(name) {
                log::warn!("{err}");
            }
        }
        if let Some(file) = &self.session_file {
            let _ = std::fs::remove_file(file);
        }
        let _ = app.emit(AUTH_CHANGED_EVENT, false);
    }

    /// Keeps the offline proof (claim + the JWKS key that signed it) of a
    /// fresh session, or drops it when the session grants no access.
    async fn keep_offline_proof(&self, session: &Value) {
        let Some(token) = session.pointer("/offline/token").and_then(Value::as_str) else {
            let _ = self.keychain.delete(OFFLINE_PROOF);
            return;
        };
        let result: std::result::Result<(), String> = async {
            let url = self.saas().map_err(|e| format!("{e:?}"))?.join("/api/auth/jwks").map_err(|e| e.to_string())?;
            let jwks = self.http.get(url).send().await.map_err(|e| e.to_string())?.text().await.map_err(|e| e.to_string())?;
            let kid = offline::token_kid(token);
            let key = offline::key_from_jwks(&jwks, kid.as_deref()).ok_or("signing key not in JWKS")?;
            let proof = OfflineProof { token: token.to_owned(), key };
            self.verify_offline(&proof)?;
            self.store_proof(&proof)?;
            self.mark_offline_seen(now());
            Ok(())
        }
        .await;
        if let Err(err) = result {
            log::warn!("offline proof not stored: {err}");
        }
    }

    fn cache_session(&self, session: &Value) {
        let Some(file) = &self.session_file else { return };
        let mut display = session.clone();
        if let Some(object) = display.as_object_mut() {
            object.remove("offline");
        }
        if let Some(dir) = file.parent() {
            let _ = std::fs::create_dir_all(dir);
        }
        if let Err(err) = std::fs::write(file, display.to_string()) {
            log::warn!("session cache not written: {err}");
        }
    }

    fn offline_session(&self) -> SessionResult {
        let proof = match self.keychain.get(OFFLINE_PROOF) {
            Ok(Some(raw)) => serde_json::from_str::<OfflineProof>(&raw).ok(),
            _ => None,
        };
        let Some(proof) = proof else {
            return SessionResult::Unreachable { reason: "no offline grace".into() };
        };
        let refresh_stored = matches!(self.keychain.get(REFRESH_TOKEN), Ok(Some(_)));
        let cached = self
            .session_file
            .as_ref()
            .and_then(|file| std::fs::read_to_string(file).ok())
            .and_then(|raw| serde_json::from_str::<Value>(&raw).ok());
        let granted = self
            .verify_offline(&proof)
            .and_then(|claim| offline_account(refresh_stored, cached, &claim.sub).map(|session| (session, claim)));
        match granted {
            Ok((session, claim)) => {
                self.mark_offline_seen(now());
                SessionResult::Offline { session: Some(session), claim }
            }
            Err(reason) => SessionResult::Unreachable { reason: reason.into() },
        }
    }

    /// Hands a deep-link redirect to the waiting sign-in.
    fn deliver(&self, url: &Url) -> bool {
        let mut pending = self.pending.lock().unwrap_or_else(|p| p.into_inner());
        let Some(current) = pending.as_ref() else { return false };
        let Some(callback) = loopback::parse_callback(url, &current.state) else {
            return false;
        };
        if let Some(sign_in) = pending.take() {
            let _ = sign_in.deliver.send(callback);
        }
        true
    }
}

/// Deep links `<scheme>://…`: `auth/callback` finishes a sign-in, anything
/// else (e.g. `<scheme>://auth/return` after a purchase) reloads the
/// session and focuses the window.
pub fn handle_deep_link(app: &AppHandle, url: &Url) {
    let state = app.state::<AuthState>();
    if url.scheme() != state.scheme {
        return;
    }
    let is_callback = url.host_str() == Some("auth") && url.path() == "/callback";
    if !(is_callback && state.deliver(url)) {
        let _ = app.emit(SESSION_REFRESH_EVENT, ());
    }
    crate::shell::focus_main(app);
}

/// Async so the keychain read never runs on the main (UI) thread.
#[tauri::command]
pub async fn auth_status(state: State<'_, AuthState>) -> Result<AuthStatus> {
    Ok(AuthStatus {
        mode: state.mode.clone(),
        available: state.saas().is_ok(),
        signed_in: matches!(state.keychain.get(REFRESH_TOKEN), Ok(Some(_))),
    })
}

/// OAuth errors after which the refresh token is gone for good — anything
/// else (rate limit, invalid_request) keeps the user signed in.
fn is_dead_grant(error: &str) -> bool {
    matches!(error, "invalid_grant" | "invalid_client" | "unauthorized_client")
}

/// Opens the sign-in in the system browser and waits for the redirect.
#[tauri::command]
pub async fn auth_sign_in(app: AppHandle, state: State<'_, AuthState>, page: CallbackPage) -> Result<()> {
    let saas = state.saas()?.clone();
    let (verifier, challenge) = pkce::pair();
    let csrf = pkce::random_token();
    let (tx, rx) = oneshot::channel();
    // A new sign-in replaces (cancels) a pending one.
    *state.pending.lock().unwrap_or_else(|p| p.into_inner()) = Some(PendingSignIn {
        state: csrf.clone(),
        deliver: tx,
    });

    let (redirect_uri, server) = match Listener::bind().await {
        Ok(listener) => {
            let uri = listener.redirect_uri();
            let handle = app.clone();
            let expected = csrf.clone();
            let task = tauri::async_runtime::spawn(async move {
                let callback = listener.wait(&expected, &page).await;
                let state = handle.state::<AuthState>();
                let mut pending = state.pending.lock().unwrap_or_else(|p| p.into_inner());
                if pending.as_ref().is_some_and(|p| p.state == expected) {
                    if let Some(sign_in) = pending.take() {
                        let _ = sign_in.deliver.send(callback);
                    }
                }
            });
            (uri, Some(task))
        }
        Err(err) => {
            log::warn!("loopback redirect unavailable ({err}) — using the deep link");
            (format!("{}://auth/callback", state.scheme), None)
        }
    };

    let url = authorize_url(&saas, &state.client_id, &redirect_uri, &challenge, &csrf);
    if let Err(err) = open_sign_in(&app, &url) {
        if let Some(task) = server {
            task.abort();
        }
        return Err(AuthError::Unavailable(format!("cannot open the browser: {err}")));
    }

    let outcome = tokio::time::timeout(SIGN_IN_TIMEOUT, rx).await;
    if let Some(task) = server {
        task.abort();
    }
    let code = match outcome {
        Err(_) => {
            state.pending.lock().unwrap_or_else(|p| p.into_inner()).take();
            return Err(AuthError::Timeout);
        }
        Ok(Err(_)) => return Err(AuthError::Cancelled),
        Ok(Ok(Callback::Error(error))) => return Err(AuthError::Rejected(error)),
        Ok(Ok(Callback::Code(code))) => code,
    };

    let resource = resource(&saas);
    let tokens = state
        .token_request(&[
            ("grant_type", "authorization_code"),
            ("code", &code),
            ("redirect_uri", &redirect_uri),
            ("client_id", &state.client_id),
            ("code_verifier", &verifier),
            ("resource", &resource),
        ])
        .await?;
    if tokens.refresh_token.is_none() {
        // Without a refresh token the install is neither counted as a device
        // nor able to stay signed in — refuse it rather than half sign in.
        return Err(AuthError::Rejected("offline_access not granted".into()));
    }
    let token = state.store_tokens(&tokens)?;
    *state.access.lock().await = Some(token);
    log::info!("signed in");
    let _ = app.emit(AUTH_CHANGED_EVENT, true);
    crate::shell::focus_main(&app);
    Ok(())
}

/// Opens the authorization page in the system browser. Debug builds can
/// hand it to an agent instead (check-in-desktop skill):
/// `FUUTU_DESKTOP_SIGNIN_URL_FILE` receives the URL,
/// `FUUTU_DESKTOP_SIGNIN_NO_BROWSER=1` skips the system browser.
fn open_sign_in(app: &AppHandle, url: &Url) -> std::result::Result<(), String> {
    #[cfg(debug_assertions)]
    {
        if let Ok(file) = std::env::var("FUUTU_DESKTOP_SIGNIN_URL_FILE") {
            if let Err(err) = std::fs::write(&file, url.as_str()) {
                log::warn!("sign-in URL not written: {err}");
            }
        }
        if std::env::var("FUUTU_DESKTOP_SIGNIN_NO_BROWSER").as_deref() == Ok("1") {
            return Ok(());
        }
    }
    app.opener()
        .open_url(url.as_str(), None::<&str>)
        .map_err(|err| err.to_string())
}

#[tauri::command]
pub async fn auth_cancel_sign_in(state: State<'_, AuthState>) -> Result<()> {
    // Dropping the sender ends the waiting sign-in with `Cancelled`.
    state.pending.lock().unwrap_or_else(|p| p.into_inner()).take();
    Ok(())
}

/// Revokes the refresh token (this device disappears from the account's
/// device list) and forgets the account locally — also when offline.
#[tauri::command]
pub async fn auth_sign_out(app: AppHandle, state: State<'_, AuthState>) -> Result<()> {
    if let (Ok(saas), Ok(Some(refresh))) = (state.saas(), state.keychain.get(REFRESH_TOKEN)) {
        if let Ok(url) = saas.join("/api/auth/oauth2/revoke") {
            let form = [
                ("token", refresh.as_str()),
                ("token_type_hint", "refresh_token"),
                ("client_id", state.client_id.as_str()),
            ];
            if let Err(err) = state.http.post(url).form(&form).send().await {
                log::warn!("token revocation failed (signed out locally): {err}");
            }
        }
    }
    *state.access.lock().await = None;
    state.clear_local(&app);
    log::info!("signed out");
    Ok(())
}

/// API call from the webview through the signed-in account.
#[tauri::command]
pub async fn auth_api_fetch(app: AppHandle, state: State<'_, AuthState>, request: ApiRequest) -> Result<ApiResponse> {
    let (status, body, _) = state.fetch(&app, &request).await?;
    Ok(ApiResponse {
        status: status.as_u16(),
        body,
    })
}

/// `desktop.session` for `organization_id` (default: the sign-in org),
/// falling back to the offline grace when the backend is unreachable.
#[tauri::command]
pub async fn auth_session(
    app: AppHandle,
    state: State<'_, AuthState>,
    organization_id: Option<String>,
) -> Result<SessionResult> {
    // The install's public key binds the offline claim to this device.
    let mut body = serde_json::json!({});
    if let Some(id) = organization_id {
        body["organizationId"] = id.into();
    }
    match state.install_public_key() {
        Ok(key) => body["installKey"] = key.into(),
        Err(err) => log::warn!("no install key — no offline grace: {err}"),
    }
    let request = ApiRequest {
        path: "/api/desktop/session".into(),
        method: Some("POST".into()),
        body: Some(body.to_string()),
    };
    let (status, text, authenticated) = match state.fetch(&app, &request).await {
        Ok(result) => result,
        Err(AuthError::Network(reason)) => {
            log::info!("backend unreachable ({reason}) — offline grace");
            return Ok(state.offline_session());
        }
        Err(err) => return Err(err),
    };
    if !authenticated {
        return Ok(SessionResult::SignedOut);
    }
    if status == StatusCode::UNAUTHORIZED {
        // A fresh token the API still refuses (user banned, module off on
        // the backend): signed out for now. Local state stays — only a dead
        // refresh grant (`access_token`) forgets the account.
        *state.access.lock().await = None;
        return Ok(SessionResult::SignedOut);
    }
    if status.is_server_error() {
        log::warn!("desktop.session failed with {status} — offline grace");
        return Ok(state.offline_session());
    }
    if !status.is_success() {
        return Err(AuthError::Rejected(format!("desktop.session: {status}")));
    }
    let session: Value = serde_json::from_str(&text).map_err(|e| AuthError::Invalid(e.to_string()))?;
    state.keep_offline_proof(&session).await;
    state.cache_session(&session);
    Ok(SessionResult::Online { session })
}

/// Offline only for the signed-in account of this install: a stored refresh
/// token, and the claim's user = the last online session's user. Returns
/// that cached session (display data).
fn offline_account(
    refresh_stored: bool,
    cached: Option<Value>,
    sub: &str,
) -> std::result::Result<Value, &'static str> {
    if !refresh_stored {
        return Err("signed out");
    }
    cached
        .filter(|s| s.pointer("/user/id").and_then(Value::as_str) == Some(sub))
        .ok_or("claim is for another account")
}

/// Installs the process-wide TLS provider (ring — as the updater plugin).
pub fn init_tls() {
    let _ = rustls::crypto::ring::default_provider().install_default();
}

/// The app data dir for the display cache.
pub fn data_dir(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_data_dir().ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn offline_only_for_the_signed_in_account() {
        let cached = || Some(serde_json::json!({ "user": { "id": "u1" } }));
        assert!(offline_account(true, cached(), "u1").is_ok());
        assert_eq!(offline_account(false, cached(), "u1"), Err("signed out"));
        assert_eq!(offline_account(true, cached(), "u2"), Err("claim is for another account"));
        assert_eq!(offline_account(true, None, "u1"), Err("claim is for another account"));
    }

    fn saas() -> Url {
        Url::parse("https://app.example.com").unwrap()
    }

    #[test]
    fn api_url_stays_on_the_backend_api() {
        assert_eq!(
            api_url(&saas(), "/api/desktop/session").unwrap().as_str(),
            "https://app.example.com/api/desktop/session"
        );
        assert!(api_url(&saas(), "/api/rpc/x?y=1").is_ok());
        assert!(api_url(&saas(), "/api/rpc/x?q=a%20b").is_ok());
        for bad in [
            "//evil.com/api/x",
            "https://evil.com/api/x",
            "/api/../auth/x",
            "/api/%2e%2e/admin",
            "/api/auth/oauth2/token",
            "/api/auth",
            "/api/%61uth/oauth2/token",
            "/api\\x",
            "/other",
            "api/x",
        ] {
            assert!(api_url(&saas(), bad).is_err(), "{bad} should be refused");
        }
    }

    #[test]
    fn authorize_url_carries_pkce_state_and_the_desktop_audience() {
        let url = authorize_url(&saas(), "acme-desktop", "http://127.0.0.1:5000/callback", "ch", "st");
        assert_eq!(url.path(), "/api/auth/oauth2/authorize");
        let query: std::collections::HashMap<_, _> = url.query_pairs().into_owned().collect();
        assert_eq!(query["client_id"], "acme-desktop");
        assert_eq!(query["code_challenge"], "ch");
        assert_eq!(query["code_challenge_method"], "S256");
        assert_eq!(query["state"], "st");
        assert_eq!(query["resource"], "https://app.example.com/api/rpc");
        assert!(query["scope"].contains("offline_access"));
    }

    #[test]
    fn only_dead_grants_sign_out() {
        assert!(is_dead_grant("invalid_grant"));
        assert!(!is_dead_grant("rate_limited"));
        assert!(!is_dead_grant("invalid_request"));
    }

    #[test]
    fn errors_serialise_for_the_webview() {
        assert_eq!(
            serde_json::to_value(AuthError::SignedOut).unwrap(),
            serde_json::json!({ "kind": "signed_out" })
        );
        assert_eq!(
            serde_json::to_value(AuthError::Network("x".into())).unwrap(),
            serde_json::json!({ "kind": "network", "message": "x" })
        );
    }
}
