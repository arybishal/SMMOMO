# SMMOMO

Social media automation SaaS. **V1 focus: Instagram Comment → Automated Private DM.**

A user connects an Instagram account, picks a post/reel, creates an automation with a
keyword, and defines a private DM (plus an optional public reply). When someone comments
with the keyword, SMMOMO matches the automation, queues a job, sends the DM, and records
the result on the dashboard.

Owner: Bishal Aryal

---

## Project Status

**IN DEVELOPMENT — Frontend foundation phase.**

This is a living AI-coded project. Before changing anything, every agent must read:

1. `TASK.md` — what is done, in progress, blocked, and what to do next (most important)
2. `Tree.md` — where everything lives
3. `README.md` — this file

No backend, no database, no Meta/Instagram integration exists yet. The frontend runs on
a centralized mock data layer.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js (App Router), React, TypeScript, Tailwind CSS |
| Backend (planned) | Node.js, TypeScript, Fastify |
| Database (planned) | PostgreSQL, Prisma |
| Queue (planned) | Redis, BullMQ |
| Infrastructure (planned) | Docker, Docker Compose |
| Social platform (V1) | Meta official APIs (Instagram) |

---

## Repository Layout

```text
smmomo/
├── apps/
│   └── web/          Next.js frontend
├── packages/         Shared packages (reserved, empty for now)
├── docs/             Architecture and API decision records
├── tests/            Cross-app tests (reserved)
├── docker/           Container configs (reserved)
├── .env.example      Environment template
├── README.md         This file — general documentation
├── TASK.md           Task tracker / AI handoff file
└── Tree.md           Living file map
```

See `Tree.md` for the detailed map with per-file explanations.

---

## Prerequisites

- Node.js >= 20
- npm >= 10 (workspaces)

## Install

```bash
npm install
```

## Run (development)

```bash
npm run dev
```

Frontend starts at [http://localhost:3000](http://localhost:3000).

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build of the frontend |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript (`tsc --noEmit`) |

---

## Environment Variables

Copy `.env.example` to `.env` and fill values as features land.

| Variable | Status | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | reserved | Base URL of the future Fastify API |
| `DATABASE_URL` etc. | reserved (commented) | Backend — not implemented |
| `META_*` | reserved (commented) | Official Meta credentials — never fake these |

Secrets are ignored by `.gitignore`; only `.env.example` is committed.

---

## Architecture (target)

```text
Instagram Comment
  → Meta Webhook
  → Verify / validate / deduplicate / respond fast
  → Queue job (Redis + BullMQ)
  → Match automation (keyword)
  → Send private DM (+ optional public reply) via Meta Graph API
  → Record result
  → Dashboard statistics
```

Key principles:

- **Frontend-first:** the UI talks to API modules in `apps/web/lib/api/`, never raw
  `fetch` scattered through components. During this phase those modules serve
  centralized mock data (`apps/web/lib/mock/`) shaped like real backend responses.
- **Workspace isolation:** every future backend resource must be authorization-aware.
  User A never sees User B's data.
- **Idempotency:** duplicate webhook events must never produce duplicate DMs.
- **Webhooks are thin:** receive → verify → record/deduplicate → respond → queue.
  Long work never runs inside the webhook request.
- **Official docs win:** Meta API behavior is verified against current official
  documentation before implementation, recorded in `docs/architecture/`.

## How the major systems work (current reality)

| System | Status |
|---|---|
| Frontend app, mock API layer, docs/handoff system | Foundation in progress (Task 001) |
| Fastify API, PostgreSQL, Prisma, auth | Not started |
| Meta OAuth / Graph API / webhooks / BullMQ | Not started — verify official Meta docs first |
| Payments | Deferred — V1 is free; usage tracking only |

Full status lives in `TASK.md`.
