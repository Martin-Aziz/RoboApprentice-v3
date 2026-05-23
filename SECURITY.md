# Security Policy

## Supported Versions

| Version | Supported |
|---|---|
| 0.1.x (latest) | ✅ |
| < 0.1.0 | ❌ |

---

## Reporting a Vulnerability

**Please do NOT open a public GitHub issue for security vulnerabilities.**

Send a report to **security@forge-mind.dev** (or directly message the maintainer on GitHub) with:

1. A clear description of the vulnerability
2. Steps to reproduce
3. Potential impact
4. Any suggested remediation (optional)

We will acknowledge receipt within **48 hours** and aim to provide a fix or workaround within **14 days** for critical issues.

Once a fix is released, we will publicly disclose the vulnerability in [CHANGELOG.md](CHANGELOG.md) and credit the reporter (unless anonymity is requested).

---

## Security Design Decisions

| Area | Approach |
|---|---|
| Authentication | RS256 JWT (access token 15 min) + refresh token (30 days, HttpOnly cookie) |
| Password storage | Argon2id with configurable cost parameters |
| Session rotation | Refresh token rotated on every use |
| CORS | Restricted to explicit `ALLOWED_ORIGINS` — no wildcard in production |
| Cookie security | `Secure`, `HttpOnly`, `SameSite=Strict` on refresh token in production |
| Rate limiting | Redis sliding-window on auth endpoints per email |
| Internal services | `X-Internal-Secret` header required for ML→API callbacks |
| File uploads | MIME type allowlist + configurable size cap |
| SQL injection | SQLx compile-time checked queries only — no string interpolation |
| Secrets | Never committed — all via environment variables |

---

## Dependency Auditing

- Rust: `cargo audit` runs in CI on every push to `main` and weekly via `security.yml`
- Python: `pip-audit` runs weekly
- JavaScript: `pnpm audit` runs weekly

---

## OWASP Top 10 Checklist

| # | Risk | Status |
|---|---|---|
| A01 | Broken Access Control | ✅ Row-level ownership checks on all resources |
| A02 | Cryptographic Failures | ✅ TLS in prod, RS256 JWT, Argon2id |
| A03 | Injection | ✅ SQLx compile-time query validation |
| A04 | Insecure Design | ✅ Internal endpoints protected by shared secret |
| A05 | Security Misconfiguration | ✅ Strict CORS, production config validation |
| A06 | Vulnerable Components | ✅ Automated weekly audits |
| A07 | Authentication Failures | ✅ Rate limiting, token rotation |
| A08 | Software Integrity Failures | ✅ Pinned Docker base images, Cargo.lock committed |
| A09 | Logging Failures | ✅ Structured tracing with request IDs |
| A10 | SSRF | ⚠️ ML service URL configurable — restrict via firewall in prod |
