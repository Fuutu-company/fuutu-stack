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

/// `desktopConfig.updates` + build inputs.
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct UpdatesConfig {
    /// `backend` | `static`.
    pub source: String,
    /// Public manifest URL for `static` (`{channel}` placeholder).
    pub static_url: Option<String>,
    pub channels: Vec<String>,
    pub default_channel: String,
    /// Updater public key (`DESKTOP_UPDATER_PUBLIC_KEY`); none = no updater.
    pub pubkey: Option<String>,
    pub check_interval_hours: u32,
    /// Linux build without an AppImage (`desktopConfig.release.linuxFormats`):
    /// updates come through the package manager, never in-app.
    pub via_package: bool,
}

impl Default for UpdatesConfig {
    fn default() -> Self {
        Self {
            source: "backend".into(),
            static_url: None,
            channels: vec!["stable".into()],
            default_channel: "stable".into(),
            pubkey: None,
            check_interval_hours: 6,
            via_package: false,
        }
    }
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
    pub updates: UpdatesConfig,
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
    fn updates_via_package_is_off_unless_the_build_says_so() {
        assert!(
            !RuntimeConfig::parse(Some(r#"{"updates":{"pubkey":"pk"}}"#))
                .updates
                .via_package
        );
        let linux = RuntimeConfig::parse(Some(r#"{"updates":{"viaPackage":true}}"#));
        assert!(linux.updates.via_package);
        assert!(linux.updates.pubkey.is_none());
    }

    #[test]
    fn falls_back_on_invalid_json() {
        assert_eq!(RuntimeConfig::parse(Some("{nope")).auth, "off");
    }
}
