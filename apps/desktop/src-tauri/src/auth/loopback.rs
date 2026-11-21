//! Loopback redirect for the sign-in (RFC 8252 §7.3): a one-shot HTTP
//! listener on `127.0.0.1:<random port>/callback`. Requests with another
//! path or a foreign `state` are answered and ignored, so a local process
//! poking the port cannot end (or hijack) a sign-in.

use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use url::Url;

/// Largest request head read from the browser.
const MAX_REQUEST: usize = 8 * 1024;
/// Time a connection gets to send its request.
const CONNECTION_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(5);

/// What the redirect carried.
#[derive(Debug, PartialEq, Eq)]
pub enum Callback {
    Code(String),
    /// OAuth `error` (e.g. `access_denied`).
    Error(String),
}

/// Parses the redirect URL's query: `code` / `error`, only when `state`
/// matches. `None` = not ours.
pub fn parse_callback(url: &Url, expected_state: &str) -> Option<Callback> {
    let mut code = None;
    let mut error = None;
    let mut state = None;
    for (key, value) in url.query_pairs() {
        match key.as_ref() {
            "code" => code = Some(value.into_owned()),
            "error" => error = Some(value.into_owned()),
            "state" => state = Some(value.into_owned()),
            _ => {}
        }
    }
    if state.as_deref() != Some(expected_state) {
        return None;
    }
    match (code, error) {
        (_, Some(error)) => Some(Callback::Error(error)),
        (Some(code), None) if !code.is_empty() => Some(Callback::Code(code)),
        _ => None,
    }
}

/// `GET /callback?… HTTP/1.1` → the request URL on the loopback origin.
pub fn request_url(head: &str, port: u16) -> Option<Url> {
    let line = head.lines().next()?;
    let mut parts = line.split(' ');
    let (method, target) = (parts.next()?, parts.next()?);
    if method != "GET" || !target.starts_with('/') {
        return None;
    }
    let url = Url::parse(&format!("http://127.0.0.1:{port}"))
        .ok()?
        .join(target)
        .ok()?;
    (url.path() == "/callback").then_some(url)
}

/// Text of the page the browser shows after the redirect (localised by
/// the webview, which has the translations).
#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CallbackPage {
    pub title: String,
    pub body: String,
}

impl CallbackPage {
    fn html(&self) -> String {
        format!(
            "<!doctype html><meta charset=utf-8><meta name=viewport content=\"width=device-width\">\
             <link rel=icon href=\"data:,\">\
             <title>{t}</title><body style=\"font-family:system-ui;margin:4rem auto;max-width:32rem;padding:0 1rem\">\
             <h1 style=\"font-size:1.25rem\">{t}</h1><p>{b}</p></body>",
            t = escape(&self.title),
            b = escape(&self.body),
        )
    }
}

fn escape(text: &str) -> String {
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

pub struct Listener {
    listener: TcpListener,
    port: u16,
}

impl Listener {
    pub async fn bind() -> std::io::Result<Self> {
        let listener = TcpListener::bind(("127.0.0.1", 0)).await?;
        let port = listener.local_addr()?.port();
        Ok(Self { listener, port })
    }

    pub fn redirect_uri(&self) -> String {
        format!("http://127.0.0.1:{}/callback", self.port)
    }

    /// Serves until the redirect with `expected_state` arrives.
    pub async fn wait(self, expected_state: &str, page: &CallbackPage) -> Callback {
        loop {
            let Ok((stream, _)) = self.listener.accept().await else {
                // e.g. out of file descriptors — back off instead of spinning.
                tokio::time::sleep(std::time::Duration::from_millis(50)).await;
                continue;
            };
            // A silent local connection must not hold up the browser's.
            let handled = tokio::time::timeout(
                CONNECTION_TIMEOUT,
                self.handle(stream, expected_state, page),
            )
            .await;
            if let Ok(Some(callback)) = handled {
                return callback;
            }
        }
    }

    async fn handle(
        &self,
        mut stream: TcpStream,
        expected_state: &str,
        page: &CallbackPage,
    ) -> Option<Callback> {
        let mut buffer = Vec::with_capacity(1024);
        let mut chunk = [0u8; 1024];
        while buffer.len() < MAX_REQUEST && !buffer.windows(4).any(|w| w == b"\r\n\r\n") {
            match stream.read(&mut chunk).await {
                Ok(0) | Err(_) => break,
                Ok(n) => buffer.extend_from_slice(&chunk[..n]),
            }
        }
        let head = String::from_utf8_lossy(&buffer);
        let callback = request_url(&head, self.port)
            .and_then(|url| parse_callback(&url, expected_state));
        let response = match &callback {
            Some(_) => respond("200 OK", &page.html()),
            None => respond("404 Not Found", ""),
        };
        let _ = stream.write_all(response.as_bytes()).await;
        let _ = stream.shutdown().await;
        callback
    }
}

fn respond(status: &str, body: &str) -> String {
    format!(
        "HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\n\
         Content-Length: {}\r\nCache-Control: no-store\r\nReferrer-Policy: no-referrer\r\n\
         Connection: close\r\n\r\n{body}",
        body.len()
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn url(query: &str) -> Url {
        Url::parse(&format!("http://127.0.0.1:5000/callback?{query}")).unwrap()
    }

    #[test]
    fn accepts_code_with_matching_state() {
        assert_eq!(
            parse_callback(&url("code=abc&state=s1"), "s1"),
            Some(Callback::Code("abc".into()))
        );
    }

    #[test]
    fn ignores_foreign_or_missing_state() {
        assert_eq!(parse_callback(&url("code=abc&state=evil"), "s1"), None);
        assert_eq!(parse_callback(&url("code=abc"), "s1"), None);
    }

    #[test]
    fn reports_oauth_errors() {
        assert_eq!(
            parse_callback(&url("error=access_denied&state=s1"), "s1"),
            Some(Callback::Error("access_denied".into()))
        );
    }

    #[test]
    fn only_get_callback_requests() {
        assert!(request_url("GET /callback?code=a HTTP/1.1\r\n", 5000).is_some());
        assert!(request_url("GET /favicon.ico HTTP/1.1\r\n", 5000).is_none());
        assert!(request_url("POST /callback HTTP/1.1\r\n", 5000).is_none());
        assert!(request_url("GET http://evil/callback HTTP/1.1\r\n", 5000).is_none());
    }

    #[test]
    fn page_text_is_escaped() {
        let page = CallbackPage {
            title: "<script>".into(),
            body: "a & b".into(),
        };
        let html = page.html();
        assert!(html.contains("&lt;script&gt;"));
        assert!(html.contains("a &amp; b"));
    }

    #[tokio::test]
    async fn serves_until_the_matching_redirect() {
        let listener = Listener::bind().await.unwrap();
        let port = listener.port;
        let page = CallbackPage {
            title: "ok".into(),
            body: "done".into(),
        };
        let server = tokio::spawn(async move { listener.wait("s1", &page).await });
        // A connection that never sends anything only costs its timeout.
        let _idle = TcpStream::connect(("127.0.0.1", port)).await.unwrap();
        for target in ["/other", "/callback?code=x&state=bad", "/callback?code=good&state=s1"] {
            let mut stream = TcpStream::connect(("127.0.0.1", port)).await.unwrap();
            stream
                .write_all(format!("GET {target} HTTP/1.1\r\nHost: x\r\n\r\n").as_bytes())
                .await
                .unwrap();
            let mut reply = String::new();
            stream.read_to_string(&mut reply).await.unwrap();
        }
        assert_eq!(server.await.unwrap(), Callback::Code("good".into()));
    }
}
