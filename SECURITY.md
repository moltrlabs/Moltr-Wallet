# Moltr — Security

Moltr is an agent-native crypto wallet and coordination layer. This document describes the security model, supported use cases, and out-of-scope behavior.

---

## What Moltr secures

- **Tags registry:** Username → wallet address. Lookup by exact username only. No listing or search to prevent enumeration.
- **Receipts:** Private proof records. Only the two parties (fromTag, toTag) can create (with their API key) and list receipts (via API key). Data is stored server-side but access is restricted.
- **Objects:** Token metadata and images in S3-compatible storage. Key space restricted to `tokens/<mint>/logo.png` and `tokens/<mint>/metadata.json`. Public read via CDN; upload is unauthenticated by design (restricted keys only).
- **API keys:** High-entropy, random; stored as Argon2 hashes. Shown once on tag registration. Never logged.
- **Operational:** Rate limiting on all endpoints; CORS locked to configured origins; request validation (Zod); no custody of keys or signing.

---

## What Moltr does not do

- **No custody:** The server never receives or stores private keys. It never signs transactions. Wallets and signing remain on the client or agent.
- **No balance or chain data:** The backend does not read balances, history, or chain state. It stores tags, receipts, and object references only.
- **No PII beyond tags:** Only username and wallet address are stored for tags; receipt payload is whatever the client sends (signature, memo, amount). No additional PII collection.
- **No tag enumeration:** No endpoints to list or search tags; only exact-username lookup.

---

## Reporting vulnerabilities

If you believe you have found a security issue in Moltr, please report it responsibly. Do not open public issues for sensitive findings. Prefer private disclosure so we can address the issue before public discussion.

---

## Configuration

- Use `.env` for all secrets; never commit `.env`. Rely on `.env.example` for structure only (no real keys).
- In production: PostgreSQL, TLS, locked-down CORS, and object storage (e.g. Cloudflare R2) with appropriate bucket policies.
- Keep dependencies updated and review release notes for security fixes.
