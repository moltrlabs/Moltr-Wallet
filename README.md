# Moltr

**Programmable money for machines.**

Moltr is an agent-native crypto wallet and coordination layer—the wallet layer for autonomous systems. Where agents hold and move real value. Infrastructure-grade, developer-first: tags registry, private receipts, and object storage. No custody: keys stay on the client; the server never signs.

---

## What Moltr provides

- **Tags** — Registry mapping usernames to wallet addresses. Lookup by exact identifier only; no search or enumeration.
- **Receipts** — Private proof records shared only between sender and receiver. Create and list via API key; data stays between the two parties.
- **Objects** — Token metadata and images in S3-compatible storage. Restricted key space (`tokens/<mint>/logo.png`, `tokens/<mint>/metadata.json`), configurable size limits.

Architecture is unchanged: client-side key storage, local signing, tags, receipts, object uploads, zero custody.

---

## Tech stack

- **Runtime:** Node.js + TypeScript  
- **Framework:** Fastify  
- **Database:** SQLite (local) / PostgreSQL (production), Prisma ORM  
- **Object storage:** S3-compatible (AWS S3 or Cloudflare R2), AWS SDK  
- **Auth:** High-entropy API keys, stored as Argon2 hashes  

---

## Quick start

```bash
cp .env.example .env
# Edit .env: DATABASE_URL (default SQLite: file:./dev.db in prisma/)

npm install
npm run db:generate
npm run db:migrate
npm run dev
```

- **API base:** `http://localhost:3000`  
- **Health:** `GET /health`  
- **Tags:** `POST /api/v1/tags/register`, `GET /api/v1/tags/:username`  
- **Receipts:** `POST /api/v1/receipts/create`, `GET /api/v1/receipts/` (header: `x-api-key`)  
- **Objects:** `PUT /objects/tokens/<mint>/logo.png` or `.../metadata.json` (binary body, max 2MB)  

---

## API summary

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/tags/register` | — | Register username → wallet; returns **one-time** `apiKey`. |
| GET | `/api/v1/tags/:username` | — | Lookup wallet by username. No list/search (anti-enumeration). |
| POST | `/api/v1/receipts/create` | `x-api-key` (fromTag or toTag) | Create receipt; only sender or receiver key allowed. |
| GET | `/api/v1/receipts/` | `x-api-key` | List receipts where the key’s tag is fromTag or toTag. |
| PUT | `/objects/tokens/<mint>/logo.png` or `.../metadata.json` | — | Upload to object storage; max 2MB. |

---

## Threat model and security

**What this backend does:** Tags (public lookup by exact username), receipts (private to two parties), objects (restricted key space, public URLs).

**What it does not do:** No custody—never receives or stores private keys; never signs transactions. No balance or chain data. No PII beyond tag username/wallet. No tag search or enumeration.

**Measures:** API keys hashed (Argon2), rate limiting, CORS locked to allowed origins, Zod validation, no logging of secrets. See [SECURITY.md](./SECURITY.md).

---

## Production

- **PostgreSQL:** Set `DATABASE_URL`; set `provider` in `prisma/schema.prisma` to `postgresql`; run `npm run db:migrate:prod`.
- **Domains (examples):** `api.moltr.app`, `cdn.moltr.app`, `moltr.app`. Set `RECEIPT_BASE_URL`, `CDN_BASE_URL`, `CORS_ORIGIN` accordingly.
- **Object storage:** Configure `S3_*` and `CDN_BASE_URL` (e.g. Cloudflare R2 + custom domain).

---

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Run API with tsx watch (local dev). |
| `npm run build` | Compile TypeScript to `apps/api/dist`. |
| `npm run start` | Run compiled server. |
| `npm run db:generate` | Generate Prisma client. |
| `npm run db:migrate` | Run migrations (dev). |
| `npm run db:migrate:prod` | Deploy migrations (production). |
| `npm run db:push` | Push schema without migration (dev only). |
| `npm run db:studio` | Open Prisma Studio. |

---

## Documentation

| Doc | Purpose |
|-----|---------|
| [README.md](./README.md) | Overview, quick start, API, scripts. |
| [SECURITY.md](./SECURITY.md) | Security model and reporting. |
| [BRANDING.md](./BRANDING.md) | Name, tone, taglines, typography, logo. |
| [SKILL.md](./SKILL.md) | Project context for agents and contributors. |

---

## Repo and branding

- **Open source:** No real keys or secrets in the repo. Use `.env` for local and production (see `.gitignore`).
- **Brand:** Name, tone, and visual direction are documented in [BRANDING.md](./BRANDING.md).
