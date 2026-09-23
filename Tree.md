# SMMOMO Tree

Living map of the repository. Update this file whenever files or directories are
created, deleted, renamed, or moved.

Last updated: 2026-09-23

---

```text
smmomo/
├── .env.example              Environment template (secrets reserved/commented)
├── .gitignore                Root ignores (node_modules, .next, .env, etc.)
├── README.md                 Project documentation: what, install, run, architecture
├── TASK.md                   Task tracker + AI handoff file (read first)
├── Tree.md                   This file
├── package.json              Monorepo root: npm workspaces + dev/build/lint/typecheck scripts
│
├── apps/
│   └── web/                  Next.js 16 frontend (App Router, TypeScript, Tailwind v4)
│       ├── package.json      Workspace "web": dev/build/start/lint/typecheck
│       ├── tsconfig.json     Strict TS; "@/*" maps to apps/web root
│       ├── next.config.ts    Next.js config
│       ├── postcss.config.mjs Tailwind v4 via @tailwindcss/postcss
│       ├── eslint.config.mjs ESLint (eslint-config-next)
│       ├── AGENTS.md         Auto-managed Next.js agent rules (do not hand-edit)
│       ├── README.md         Pointer to root README
│       │
│       ├── app/
│       │   ├── layout.tsx            Root layout: fonts, metadata ("SMMOMO")
│       │   ├── page.tsx              Landing page (hero, how-it-works, features, CTA)
│       │   ├── globals.css           Tailwind entry; single controlled theme (Task 003 adds tokens)
│       │   ├── favicon.ico
│       │   ├── (auth)/
│       │   │   ├── layout.tsx        Auth shell: logo header, centered card area
│       │   │   ├── login/page.tsx    Sign-in form (mock submit → /dashboard; auth = Task 013)
│       │   │   └── register/page.tsx Sign-up form (mock submit → /dashboard)
│       │   └── (dashboard)/
│       │       ├── layout.tsx        Wraps DashboardShell (sidebar + topbar)
│       │       ├── dashboard/page.tsx       Metrics, connection card, activity, automations
│       │       ├── automations/
│       │       │   ├── page.tsx             Automation table (status/keyword/stats)
│       │       │   ├── new/page.tsx         Builder concept preview (full builder = Task 006)
│       │       │   └── [id]/page.tsx        Automation detail; params is a Promise; 404s if unknown
│       │       ├── posts/page.tsx           Post grid with media placeholders
│       │       ├── inbox/page.tsx           Recent comments + delivery results
│       │       ├── analytics/page.tsx       KPIs + CSS bar chart (no chart lib yet)
│       │       └── settings/
│       │           ├── page.tsx                   Settings hub (links to 3 sections)
│       │           ├── account/page.tsx           Profile form (client; save disabled until auth)
│       │           ├── social-accounts/page.tsx   Instagram card; Connect disabled (no OAuth fakes)
│       │           └── usage/page.tsx             Usage counters for the current period
│       │
│       ├── components/
│       │   ├── ui/
│       │   │   ├── button.tsx        Button + buttonClasses() (Link reuses variant styles)
│       │   │   ├── card.tsx          Card, CardTitle
│       │   │   ├── badge.tsx         Badge (tone: success/paused/draft/failed/neutral/info)
│       │   │   └── input.tsx         Label, Input, Textarea
│       │   └── layout/
│       │       ├── dashboard-shell.tsx  Client shell: mobile drawer state + sidebar/topbar/main
│       │       ├── sidebar.tsx          Nav (usePathname active state; closes drawer on navigate)
│       │       ├── topbar.tsx           Sticky top bar, menu button, connection pill, avatar
│       │       ├── page-header.tsx      Reusable page title/description/action row
│       │       └── icons.tsx            Inline SVG icon set (no icon dependency)
│       │
│       ├── lib/
│       │   ├── api/
│       │   │   ├── client.ts           request() seam: USE_MOCK flag → mock or fetch(API_BASE)
│       │   │   ├── automations.ts      listAutomations, getAutomation
│       │   │   ├── posts.ts            listPosts, getPost
│       │   │   ├── social-accounts.ts  listSocialAccounts, getInstagramAccount
│       │   │   ├── analytics.ts        getAnalyticsSummary
│       │   │   ├── usage.ts            getUsageSummary
│       │   │   └── inbox.ts            listRecentComments, listRecentDeliveries
│       │   └── mock/
│       │       ├── accounts.ts         Instagram account mock
│       │       ├── posts.ts            Posts/reels mock
│       │       ├── automations.ts      Automations mock (active/paused/draft)
│       │       ├── comments.ts         Comment events mock (matched + unmatched)
│       │       ├── deliveries.ts       DM/public-reply delivery mock (incl. failed)
│       │       └── analytics.ts        Analytics + usage summaries mock
│       │
│       ├── types/
│       │   └── index.ts           Domain types shaped like future API responses
│       │
│       ├── public/                Static assets (template SVGs for now)
│       └── .gitignore             Web-specific ignores
│
├── packages/                 Reserved for genuinely shared code (empty for now)
│   └── .gitkeep
│
├── docs/                     Architecture / API decision records (empty for now)
│   └── .gitkeep
│
├── tests/                    Cross-app tests (empty for now)
│   └── .gitkeep
│
└── docker/                   Container configs (empty for now)
    └── .gitkeep
```

## Important files (short explanations)

- `TASK.md` → WHAT is done / in progress / blocked / next. Read before any change.
- `Tree.md` → WHERE everything is. Keep accurate.
- `README.md` → General docs: install, run, env vars, architecture.
- `package.json` (root) → npm workspaces (`apps/*`, `packages/*`) and top-level scripts.
- `apps/web/lib/api/client.ts` → The only place UI data flows through; flip `USE_MOCK`
  to false to switch to the real API.
- `apps/web/lib/mock/` → Centralized mock data shaped like real backend responses.
- `apps/web/types/index.ts` → Shared frontend domain types (match future API contracts).

## Not created yet (by design — create when needed)

`apps/web/hooks/`, `apps/web/stores/`, `apps/api/`, `prisma/`, `docker-compose.yml`,
`packages/shared/`, `packages/config/`, `docs/architecture/`.
