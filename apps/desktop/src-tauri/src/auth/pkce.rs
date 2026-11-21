//! PKCE (RFC 7636, S256) and random OAuth `state` values.

use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use sha2::{Digest, Sha256};

/// 32 random bytes, base64url — a PKCE verifier or an OAuth `state`.
pub fn random_token() -> String {
    let bytes: [u8; 32] = rand::random();
    URL_SAFE_NO_PAD.encode(bytes)
}

/// S256 challenge of `verifier`.
pub fn challenge(verifier: &str) -> String {
    URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()))
}

/// `(verifier, challenge)`.
pub fn pair() -> (String, String) {
    let verifier = random_token();
    let challenge = challenge(&verifier);
    (verifier, challenge)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rfc_7636_appendix_b_vector() {
        assert_eq!(
            challenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
            "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
        );
    }

    #[test]
    fn verifier_is_43_chars_and_random() {
        let (a, _) = pair();
        let (b, _) = pair();
        assert_eq!(a.len(), 43); // RFC 7636: 43..=128
        assert_ne!(a, b);
    }
}
