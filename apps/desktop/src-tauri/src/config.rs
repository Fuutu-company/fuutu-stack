//! Desktop behaviour from `desktopConfig` (`@fuutu/desktop/config`),
//! embedded at compile time: `apps/desktop/scripts/run.ts` serialises it into
//! `FUUTU_DESKTOP_CONFIG`. Without it (plain `cargo check` / `cargo test`)
//! the defaults below apply.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ShellConfig {
    pub tray: bool,
    pub autostart: bool,
    pub single_instance: bool,
    pub close_to_tray: bool,
}

impl Default for ShellConfig {
    fn default() -> Self {
        Self {
            tray: true,
            autostart: true,
            single_instance: true,
            close_to_tray: false,
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct IdentityConfig {
    pub product_name: String,
    pub scheme: String,
    pub oauth_client_id: String,
    pub keychain_service: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct RuntimeConfig {
    pub shell: ShellConfig,
    pub identity: IdentityConfig,
    /// `required` | `optional` | `off`.
    pub auth: String,
    pub offline_grace_days: u32,
    /// Base URL of the saas backend (`NEXT_PUBLIC_SAAS_URL`), if any.
    pub saas_url: Option<String>,
    /// Ed25519 keys (JWK `x`) of the backend's JWKS at build time — the
    /// only keys an offline claim may be signed with (empty: dev builds,
    /// trust the key stored at the last online session).
    pub offline_keys: Vec<String>,
}

impl RuntimeConfig {
    pub fn parse(raw: Option<&str>) -> Self {
        let mut config: Self = raw
            .and_then(|json| serde_json::from_str(json).ok())
            .unwrap_or_default();
        if config.auth.is_empty() {
            config.auth = "off".into();
        }
        // Closing to the tray needs a tray to come back from.
        config.shell.close_to_tray &= config.shell.tray;
        config
    }

    pub fn embedded() -> Self {
        Self::parse(option_env!("FUUTU_DESKTOP_CONFIG"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_without_embedded_config() {
        let config = RuntimeConfig::parse(None);
        assert_eq!(config.shell, ShellConfig::default());
        assert_eq!(config.auth, "off");
    }

    #[test]
    fn reads_desktop_config_json() {
        let config = RuntimeConfig::parse(Some(
            r#"{"shell":{"tray":false,"autostart":false,"singleInstance":false,"closeToTray":true},
                "identity":{"productName":"Acme","scheme":"acme","oauthClientId":"acme-desktop","keychainService":"app.acme.desktop"},
                "auth":"required","offlineGraceDays":7,"saasUrl":"https://app.acme.test"}"#,
        ));
        assert_eq!(config.auth, "required");
        assert_eq!(config.identity.scheme, "acme");
        assert_eq!(config.saas_url.as_deref(), Some("https://app.acme.test"));
        // close-to-tray without a tray is switched off
        assert!(!config.shell.close_to_tray);
    }

    #[test]
    fn falls_back_on_invalid_json() {
        assert_eq!(RuntimeConfig::parse(Some("{nope")).auth, "off");
    }
}
