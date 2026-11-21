//! Secret storage under the app's keychain service
//! (`desktopIdentity.keychainService`): macOS Keychain, Windows Credential
//! Manager, Secret Service. Only small secrets live here — Windows caps an
//! entry at 2560 bytes — the refresh token and the offline proof; the
//! access token stays in memory.
//!
//! Debug builds use a 0600 file in the app data dir instead, unless
//! `FUUTU_DESKTOP_KEYCHAIN=1`: an unsigned dev binary changes its code
//! signature on every rebuild, so the keychain would ask for access again
//! after each one (blocking agent automation). Release builds always use
//! the keychain.

use std::collections::BTreeMap;
use std::path::PathBuf;
use std::sync::Mutex;

use keyring::{Entry, Error};

pub const REFRESH_TOKEN: &str = "refresh-token";
pub const OFFLINE_PROOF: &str = "offline-proof";

enum Backend {
    Keychain { service: String },
    /// Debug builds only.
    File { path: PathBuf, lock: Mutex<()> },
}

pub struct Keychain {
    backend: Backend,
}

impl Keychain {
    pub fn new(service: &str, data_dir: Option<PathBuf>) -> Self {
        let use_file = cfg!(debug_assertions)
            && std::env::var("FUUTU_DESKTOP_KEYCHAIN").as_deref() != Ok("1");
        let backend = match data_dir {
            Some(dir) if use_file => Backend::File {
                path: dir.join("dev-secrets.json"),
                lock: Mutex::new(()),
            },
            _ => Backend::Keychain {
                service: service.to_owned(),
            },
        };
        Self { backend }
    }

    pub fn get(&self, name: &str) -> Result<Option<String>, String> {
        match &self.backend {
            Backend::Keychain { service } => match entry(service, name)?.get_password() {
                Ok(value) => Ok(Some(value)),
                Err(Error::NoEntry) => Ok(None),
                Err(err) => Err(format!("keychain read failed: {err}")),
            },
            Backend::File { path, lock } => {
                let _guard = lock.lock().unwrap_or_else(|p| p.into_inner());
                Ok(read_file(path).remove(name))
            }
        }
    }

    pub fn set(&self, name: &str, value: &str) -> Result<(), String> {
        match &self.backend {
            Backend::Keychain { service } => entry(service, name)?
                .set_password(value)
                .map_err(|err| format!("keychain write failed: {err}")),
            Backend::File { path, lock } => {
                let _guard = lock.lock().unwrap_or_else(|p| p.into_inner());
                let mut secrets = read_file(path);
                secrets.insert(name.to_owned(), value.to_owned());
                write_file(path, &secrets)
            }
        }
    }

    pub fn delete(&self, name: &str) -> Result<(), String> {
        match &self.backend {
            Backend::Keychain { service } => match entry(service, name)?.delete_credential() {
                Ok(()) | Err(Error::NoEntry) => Ok(()),
                Err(err) => Err(format!("keychain delete failed: {err}")),
            },
            Backend::File { path, lock } => {
                let _guard = lock.lock().unwrap_or_else(|p| p.into_inner());
                let mut secrets = read_file(path);
                if secrets.remove(name).is_some() {
                    write_file(path, &secrets)?;
                }
                Ok(())
            }
        }
    }
}

fn entry(service: &str, name: &str) -> Result<Entry, String> {
    Entry::new(service, name).map_err(|err| format!("keychain unavailable: {err}"))
}

fn read_file(path: &PathBuf) -> BTreeMap<String, String> {
    std::fs::read_to_string(path)
        .ok()
        .and_then(|raw| serde_json::from_str(&raw).ok())
        .unwrap_or_default()
}

fn write_file(path: &PathBuf, secrets: &BTreeMap<String, String>) -> Result<(), String> {
    use std::io::Write;
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let mut options = std::fs::OpenOptions::new();
    options.write(true).create(true).truncate(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut file = options.open(path).map_err(|e| e.to_string())?;
    let json = serde_json::to_string(secrets).map_err(|e| e.to_string())?;
    file.write_all(json.as_bytes()).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn debug_file_store_round_trips_with_owner_only_permissions() {
        let dir = std::env::temp_dir().join(format!("desktop-store-{}", std::process::id()));
        let store = Keychain::new("svc", Some(dir.clone()));
        assert_eq!(store.get(REFRESH_TOKEN).unwrap(), None);
        store.set(REFRESH_TOKEN, "r1").unwrap();
        assert_eq!(store.get(REFRESH_TOKEN).unwrap().as_deref(), Some("r1"));
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mode = std::fs::metadata(dir.join("dev-secrets.json")).unwrap().permissions().mode();
            assert_eq!(mode & 0o777, 0o600);
        }
        store.delete(REFRESH_TOKEN).unwrap();
        assert_eq!(store.get(REFRESH_TOKEN).unwrap(), None);
        let _ = std::fs::remove_dir_all(dir);
    }
}
