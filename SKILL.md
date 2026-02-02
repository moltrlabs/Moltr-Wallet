# Moltr — Project skill

Use this when working on or discussing the **Moltr** project (agent-native crypto wallet and coordination layer).

---

## What Moltr is

- **Product name:** Moltr (not Moltwallet).
- **Positioning:** Agent-native crypto wallet and coordination layer. Programmable money for machines; the wallet layer for autonomous systems.
- **Tone:** Professional, infra-grade, developer-first. Not meme-y or hypey.

---

## Architecture (unchanged)

- **Client-side key storage;** local signing; no custody.
- **Tags:** Registry mapping username → wallet address. Lookup by exact username only; no search or enumeration.
- **Receipts:** Private proof records; only fromTag and toTag can create/list via API key.
- **Objects:** Token metadata/images in S3-compatible storage; keys restricted to `tokens/<mint>/logo.png` and `tokens/<mint>/metadata.json`.
- **Backend:** Node.js, TypeScript, Fastify, Prisma (SQLite dev / Postgres prod), S3-compatible object storage, API key auth (Argon2).

---

## Naming and branding

- **Binary/CLI:** `moltr` (e.g. `moltr wallet create`, `moltr send`, `moltr deploy`).
- **Packages:** `moltr-backend`, `moltr-api`.
- **Domain placeholders:** `moltr.app`, `api.moltr.app`, `cdn.moltr.app` (examples only; no real keys in repo).
- **Taglines:** "Programmable money for machines." / "Where agents hold and move real value." / "The wallet layer for autonomous systems."
- **Docs:** [README.md](./README.md), [SECURITY.md](./SECURITY.md), [BRANDING.md](./BRANDING.md).

---

## When editing

- Use "Moltr" and the above positioning in copy and comments.
- Keep architecture and security model as-is unless explicitly requested otherwise.
- Prefer the taglines and domain placeholders from this file and BRANDING.md.
