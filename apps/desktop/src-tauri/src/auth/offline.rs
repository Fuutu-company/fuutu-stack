//! Offline grace: `desktop.session` returns a short-lived claim signed by
//! the backend (EdDSA, its JWKS). The app keeps the claim and the signing
//! public key in the OS keychain and, while the backend is unreachable,
//! grants access only on a claim that verifies and has not expired — an
//! edited session file grants nothing.
//!
//! Hardening against a local user editing the keychain entry:
//! - release builds verify only against the backend keys embedded at build
//!   time (`offlineKeys`, fetched by `build:desktop`) — never against the
//!   key stored next to the claim; without embedded keys they grant no
//!   offline grace at all (debug builds fall back to the stored key);
//! - the claim is bound to this install (`cnf`: the install's Ed25519
//!   public key, sent with `desktop.session`) — a proof copied from another
//!   install grants nothing;
//! - issuer and lifetime (≤ the grace period) are checked;
//! - the highest time seen is kept in its own keychain item, so turning the
//!   clock back (or restoring an older proof) ends the grace.
//!
//! Offline licensing stays client-side in the end — see RELEASING.md.

use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use ed25519_dalek::{Signature, VerifyingKey};
use serde::{Deserialize, Serialize};

/// What the keychain keeps for offline use (the highest time seen lives in
/// its own item — `store::OFFLINE_SEEN`).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct OfflineProof {
    /// Compact JWS from `desktop.session` (`offline.token`).
    pub token: String,
    /// Ed25519 public key (JWK `x`, base64url) from the backend's JWKS at
    /// storage time. Debug builds without embedded keys only — release
    /// builds never trust it.
    pub key: String,
}

/// What a claim must satisfy besides its signature.
pub struct Policy<'a> {
    pub audience: &'a str,
    /// Backend origin (`iss`).
    pub issuer: &'a str,
    /// Longest accepted `exp - iat` (the grace period).
    pub max_lifetime: u64,
    /// Build-time trusted keys (JWK `x`). Empty: no offline grace, unless
    /// `allow_stored_key`.
    pub trusted_keys: &'a [String],
    /// Debug builds only: without build-time keys, trust the stored key.
    pub allow_stored_key: bool,
    /// This install's public key (base64url) — the claim's `cnf` must name it.
    pub install_key: &'a str,
}

/// Tolerated clock drift.
const SKEW_SECS: u64 = 3600;

/// Verified claim payload.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct OfflineClaim {
    pub sub: String,
    #[serde(default)]
    pub org: Option<String>,
    /// `granted` | `trial`.
    pub access: String,
    #[serde(default, rename = "maxMajor")]
    pub max_major: Option<u32>,
    pub exp: u64,
    #[serde(default)]
    pub iat: u64,
    #[serde(default)]
    pub iss: Option<String>,
    /// Proof-of-possession key (RFC 7800): the install the claim was issued to.
    #[serde(default)]
    pub cnf: Option<Confirmation>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Confirmation {
    pub jwk: ConfirmationKey,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ConfirmationKey {
    pub kty: String,
    pub crv: String,
    pub x: String,
}

#[derive(Deserialize)]
struct Header {
    alg: String,
    #[serde(default)]
    kid: Option<String>,
}

#[derive(Deserialize)]
struct Jwk {
    #[serde(default)]
    kid: Option<String>,
    kty: String,
    #[serde(default)]
    crv: Option<String>,
    #[serde(default)]
    x: Option<String>,
}

#[derive(Deserialize)]
struct Jwks {
    keys: Vec<Jwk>,
}

/// `kid` from a compact JWS header (no verification).
pub fn token_kid(token: &str) -> Option<String> {
    let header = token.split('.').next()?;
    let header: Header = serde_json::from_slice(&URL_SAFE_NO_PAD.decode(header).ok()?).ok()?;
    header.kid
}

/// The Ed25519 key `x` for `kid` from a JWKS document.
pub fn key_from_jwks(jwks: &str, kid: Option<&str>) -> Option<String> {
    let jwks: Jwks = serde_json::from_str(jwks).ok()?;
    jwks.keys
        .into_iter()
        .filter(|k| k.kty == "OKP" && k.crv.as_deref() == Some("Ed25519"))
        .find(|k| kid.is_none() || k.kid.as_deref() == kid)
        .and_then(|k| k.x)
}

/// Verifies key trust, signature (EdDSA only), audience, issuer, lifetime,
/// expiry, the install binding and the clock (`last_seen`: highest time
/// seen, kept apart from the proof).
pub fn verify(
    proof: &OfflineProof,
    policy: &Policy,
    now: u64,
    last_seen: u64,
) -> Result<OfflineClaim, &'static str> {
    let stored = [proof.key.clone()];
    let keys: &[String] = if !policy.trusted_keys.is_empty() {
        policy.trusted_keys
    } else if policy.allow_stored_key {
        &stored
    } else {
        return Err("no trusted keys");
    };
    if now + SKEW_SECS < last_seen {
        return Err("clock turned back");
    }
    let audience = policy.audience;
    let mut parts = proof.token.split('.');
    let (Some(header), Some(payload), Some(signature), None) =
        (parts.next(), parts.next(), parts.next(), parts.next())
    else {
        return Err("malformed token");
    };
    let header: Header = URL_SAFE_NO_PAD
        .decode(header)
        .ok()
        .and_then(|raw| serde_json::from_slice(&raw).ok())
        .ok_or("malformed header")?;
    if header.alg != "EdDSA" {
        return Err("unexpected algorithm");
    }
    let signature = URL_SAFE_NO_PAD
        .decode(signature)
        .ok()
        .and_then(|raw| Signature::from_slice(&raw).ok())
        .ok_or("malformed signature")?;
    let signed = &proof.token[..header_and_payload_len(&proof.token)];
    let verified = keys.iter().any(|key| {
        URL_SAFE_NO_PAD
            .decode(key)
            .ok()
            .and_then(|raw| <[u8; 32]>::try_from(raw).ok())
            .and_then(|raw| VerifyingKey::from_bytes(&raw).ok())
            .is_some_and(|key| key.verify_strict(signed.as_bytes(), &signature).is_ok())
    });
    if !verified {
        return Err("bad signature");
    }

    let raw = URL_SAFE_NO_PAD.decode(payload).map_err(|_| "malformed payload")?;
    let value: serde_json::Value = serde_json::from_slice(&raw).map_err(|_| "malformed payload")?;
    let audience_ok = match value.get("aud") {
        Some(serde_json::Value::String(aud)) => aud == audience,
        Some(serde_json::Value::Array(list)) => list.iter().any(|a| a.as_str() == Some(audience)),
        _ => false,
    };
    if !audience_ok {
        return Err("wrong audience");
    }
    let claim: OfflineClaim = serde_json::from_value(value).map_err(|_| "malformed payload")?;
    if claim.iss.as_deref() != Some(policy.issuer) {
        return Err("wrong issuer");
    }
    if claim.iat == 0 || claim.exp <= claim.iat || claim.exp - claim.iat > policy.max_lifetime {
        return Err("lifetime too long");
    }
    if claim.exp <= now {
        return Err("expired");
    }
    if claim.access != "granted" && claim.access != "trial" {
        return Err("no access");
    }
    let bound = claim.cnf.as_ref().is_some_and(|cnf| {
        cnf.jwk.kty == "OKP" && cnf.jwk.crv == "Ed25519" && cnf.jwk.x == policy.install_key
    });
    if !bound {
        return Err("bound to another install");
    }
    Ok(claim)
}

fn header_and_payload_len(token: &str) -> usize {
    token.rfind('.').unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::{Signer, SigningKey};

    const AUD: &str = "acme-desktop:offline";
    const ISS: &str = "https://app.example.com";

    /// This install's public key in the tests.
    const INSTALL: &str = "aW5zdGFsbC1rZXktb2YtdGhpcy1tYWNoaW5lLTAwMDA";

    fn policy(trusted: &[String]) -> Policy<'_> {
        Policy {
            audience: AUD,
            issuer: ISS,
            max_lifetime: 7 * 86_400,
            trusted_keys: trusted,
            allow_stored_key: true,
            install_key: INSTALL,
        }
    }

    fn check(proof: &OfflineProof, now: u64) -> Result<OfflineClaim, &'static str> {
        verify(proof, &policy(&[]), now, 0)
    }

    fn key() -> SigningKey {
        SigningKey::from_bytes(&[7u8; 32])
    }

    fn b64(data: &[u8]) -> String {
        URL_SAFE_NO_PAD.encode(data)
    }

    fn sign(alg: &str, payload: serde_json::Value, key: &SigningKey) -> String {
        let header = b64(format!(r#"{{"alg":"{alg}","kid":"k1"}}"#).as_bytes());
        let payload = b64(payload.to_string().as_bytes());
        let input = format!("{header}.{payload}");
        let signature = key.sign(input.as_bytes());
        format!("{input}.{}", b64(&signature.to_bytes()))
    }

    fn proof(token: String) -> OfflineProof {
        OfflineProof {
            token,
            key: b64(key().verifying_key().as_bytes()),
        }
    }

    fn claim(aud: &str, exp: u64) -> serde_json::Value {
        serde_json::json!({ "sub": "u1", "org": null, "access": "granted", "maxMajor": 2, "aud": aud, "iss": ISS, "iat": exp.saturating_sub(100).max(1), "exp": exp, "cnf": { "jwk": { "kty": "OKP", "crv": "Ed25519", "x": INSTALL } } })
    }

    #[test]
    fn accepts_a_valid_claim() {
        let claim = check(&proof(sign("EdDSA", claim(AUD, 2000), &key())), 1000).unwrap();
        assert_eq!(claim.sub, "u1");
        assert_eq!(claim.max_major, Some(2));
    }

    #[test]
    fn rejects_expired_wrong_audience_and_alg() {
        assert_eq!(check(&proof(sign("EdDSA", claim(AUD, 900), &key())), 1000), Err("expired"));
        assert_eq!(
            check(&proof(sign("EdDSA", claim("acme-desktop", 2000), &key())), 1000),
            Err("wrong audience")
        );
        assert_eq!(
            check(&proof(sign("HS256", claim(AUD, 2000), &key())), 1000),
            Err("unexpected algorithm")
        );
    }

    #[test]
    fn rejects_tampered_payload_and_foreign_key() {
        let token = sign("EdDSA", claim(AUD, 2000), &key());
        let parts: Vec<&str> = token.split('.').collect();
        let forged = b64(claim(AUD, 9_999_999).to_string().as_bytes());
        let tampered = format!("{}.{}.{}", parts[0], forged, parts[2]);
        assert_eq!(check(&proof(tampered), 1000), Err("bad signature"));

        let other = SigningKey::from_bytes(&[9u8; 32]);
        assert_eq!(
            check(&proof(sign("EdDSA", claim(AUD, 2000), &other)), 1000),
            Err("bad signature")
        );
    }

    #[test]
    fn rejects_wrong_issuer_and_overlong_lifetime() {
        let mut payload = claim(AUD, 2000);
        payload["iss"] = "https://evil.example".into();
        assert_eq!(check(&proof(sign("EdDSA", payload, &key())), 1000), Err("wrong issuer"));
        let mut payload = claim(AUD, 10_000_000);
        payload["iat"] = 1.into();
        assert_eq!(check(&proof(sign("EdDSA", payload, &key())), 1000), Err("lifetime too long"));
    }

    #[test]
    fn only_build_time_keys_when_embedded() {
        let token = sign("EdDSA", claim(AUD, 2000), &key());
        let other = b64(SigningKey::from_bytes(&[9u8; 32]).verifying_key().as_bytes());
        assert_eq!(verify(&proof(token.clone()), &policy(&[other]), 1000, 0), Err("bad signature"));
        let own = b64(key().verifying_key().as_bytes());
        assert!(verify(&proof(token), &policy(&[own]), 1000, 0).is_ok());
    }

    #[test]
    fn never_trusts_the_stored_key_next_to_a_forged_claim() {
        // A local user signs their own claim and stores their own key
        // with it: with build-time keys the stored key is never consulted.
        let attacker = SigningKey::from_bytes(&[9u8; 32]);
        let forged = OfflineProof {
            token: sign("EdDSA", claim(AUD, 2000), &attacker),
            key: b64(attacker.verifying_key().as_bytes()),
        };
        let backend = b64(key().verifying_key().as_bytes());
        assert_eq!(verify(&forged, &policy(&[backend]), 1000, 0), Err("bad signature"));
    }

    #[test]
    fn release_builds_without_embedded_keys_grant_nothing() {
        let p = proof(sign("EdDSA", claim(AUD, 2000), &key()));
        let release = Policy { allow_stored_key: false, ..policy(&[]) };
        assert_eq!(verify(&p, &release, 1000, 0), Err("no trusted keys"));
    }

    #[test]
    fn a_claim_for_another_install_grants_nothing() {
        let mut payload = claim(AUD, 2000);
        payload["cnf"]["jwk"]["x"] = "b3RoZXItaW5zdGFsbC1rZXktMDAwMDAwMDAwMDAwMDA".into();
        assert_eq!(check(&proof(sign("EdDSA", payload, &key())), 1000), Err("bound to another install"));
        let mut payload = claim(AUD, 2000);
        payload.as_object_mut().unwrap().remove("cnf");
        assert_eq!(check(&proof(sign("EdDSA", payload, &key())), 1000), Err("bound to another install"));
    }

    #[test]
    fn a_clock_turned_back_ends_the_grace() {
        let p = proof(sign("EdDSA", claim(AUD, 900_000), &key()));
        assert_eq!(verify(&p, &policy(&[]), 1000, 500_000), Err("clock turned back"));
        assert!(verify(&p, &policy(&[]), 499_000, 500_000).is_ok());
    }

    #[test]
    fn rejects_claim_without_access() {
        let mut payload = claim(AUD, 2000);
        payload["access"] = "missing".into();
        assert_eq!(check(&proof(sign("EdDSA", payload, &key())), 1000), Err("no access"));
    }

    #[test]
    fn finds_the_signing_key_in_a_jwks() {
        let token = sign("EdDSA", claim(AUD, 2000), &key());
        assert_eq!(token_kid(&token).as_deref(), Some("k1"));
        let x = b64(key().verifying_key().as_bytes());
        let jwks = format!(
            r#"{{"keys":[{{"kty":"RSA","kid":"k1"}},{{"kty":"OKP","crv":"Ed25519","kid":"k0","x":"zz"}},{{"kty":"OKP","crv":"Ed25519","kid":"k1","x":"{x}"}}]}}"#
        );
        assert_eq!(key_from_jwks(&jwks, Some("k1")), Some(x));
        assert_eq!(key_from_jwks(&jwks, Some("nope")), None);
    }
}
