# Security Policy

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

If you discover a security vulnerability in Fuutu Stack, please report it responsibly:

1. **Email**: security@fuutu.com
2. **Subject**: `[SECURITY] Fuutu Stack — <brief description>`
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

You will receive a response within **48 hours**. If the vulnerability is confirmed, we will:

1. Acknowledge receipt
2. Investigate and verify
3. Develop a fix
4. Release a patched version
5. Credit you in the release notes (unless you prefer to remain anonymous)

## Supported Versions

| Version | Supported |
|---|---|
| Latest `main` | Yes |
| Latest release tag | Yes |
| Older versions | No |

## Security Features

Fuutu Stack includes the following security measures by default:

- **Rate limiting** — per-endpoint, configurable
- **CSP** (Content Security Policy) headers
- **HSTS** (HTTP Strict Transport Security)
- **Open-redirect guard** — `getSafeRedirect()` on all user-controlled redirects
- **Input validation** — Zod on every API input
- **Audit logs** — immutable, org-scoped, auto-retention
- **Password policy** — validation on signup + change
- **2FA + Passkeys** — WebAuthn support
- **API keys** — scoped, revocable
- **Webhook signing** — HMAC signatures on all outbound webhooks

## Disclosure Timeline

| Time | Action |
|---|---|
| Day 0 | Report received + acknowledged |
| Day 1-7 | Verification + fix development |
| Day 7-14 | Fix released + CVE (if applicable) |
| Day 14 | Public disclosure (if reporter agrees) |

## Bug Bounty

We do not currently offer a monetary bug bounty program. Confirmed security reports will be credited in release notes.
