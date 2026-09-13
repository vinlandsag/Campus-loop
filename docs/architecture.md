# CampusLoop — Architecture & Product Document

> **Version:** 0.1 — Pre-implementation baseline  
> **Last updated:** 2026-09-06  
> **Status:** Approved for Phase 1 implementation

---

## 1. Application Overview

CampusLoop is a production-grade college event discovery and registration platform. Students discover, register for, and favourite campus events. Organizers create, publish, edit, and manage their own events and participant lists.

The application is a **Next.js 14+ App Router** project using **Server Components by default**, **Supabase** as the hosted PostgreSQL + Auth backend, and a curated set of UI/UX libraries chosen for quality and bundle efficiency.

---

## 2. Technology Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | Next.js 14 App Router | RSC-first, file-based routing, built-in image/font optimisation |
| Language | TypeScript (strict) | End-to-end type safety |
| Styling | Tailwind CSS v3 | Utility-first, design-token-friendly |
| UI Components | shadcn/ui | Accessible, un-opinionated, copy-in components |
| Database | Supabase (PostgreSQL) | Managed Postgres + Auth + RLS + realtime |
| Auth | Supabase Auth | Email/password + magic link; JWT in httpOnly cookies via `@supabase/ssr` |
| Server state | TanStack Query v5 | Client-side cache for mutable, user-specific data |
| Forms | React Hook Form + Zod | Performant, type-safe forms |
| Icons | Lucide React | Tree-shakeable, consistent |
| Animation | Motion (Framer Motion v11) | Restrained micro-interactions only |
| Linting | ESLint + Prettier | Consistent style enforced in CI |

---

## 3. Repository Structure

```
campusloop/
├── app/                          # Next.js App Router root
│   ├── (public)/                 # Route group — unauthenticated pages
│   │   ├── page.tsx              # Landing / event discovery feed
│   │   ├── events/
│   │   │   ├── page.tsx          # Browse all events (search + filter)
│   │   │   └── [id]/
│   │   │       └── page.tsx      # Event detail page
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── signup/
│   │       └── page.tsx
│   ├── (authenticated)/          # Route group — requires auth session
│   │   ├── layout.tsx            # Shared auth shell (redirects unauthenticated)
│   │   ├── dashboard/
│   │   │   └── page.tsx          # Student dashboard — registered + favourited events
│   │   └── settings/
│   │       └── page.tsx          # Profile / account settings
│   ├── (organizer)/              # Route group — requires organizer role
│   │   ├── layout.tsx            # Organizer shell (role guard + navigation)
│   │   ├── organizer/
│   │   │   ├── page.tsx          # Organizer overview
│   │   │   ├── events/
│   │   │   │   ├── page.tsx      # My events list
│   │   │   │   ├── new/
│   │   │   │   │   └── page.tsx  # Create event
│   │   │   │   └── [id]/
│   │   │   │       ├── edit/
│   │   │   │       │   └── page.tsx   # Edit event
│   │   │   │       └── participants/
│   │   │   │           └── page.tsx   # Participant list
│   ├── api/
│   │   └── auth/
│   │       └── callback/
│   │           └── route.ts      # Supabase OAuth / magic-link callback
│   ├── layout.tsx                # Root layout (fonts, global providers)
│   ├── error.tsx                 # Root error boundary
│   ├── not-found.tsx
│   └── globals.css
├── components/
│   ├── ui/                       # shadcn/ui primitives (auto-generated, do not edit)
│   ├── layout/
│   │   ├── Navbar.tsx
│   │   ├── Footer.tsx
│   │   └── Sidebar.tsx
│   ├── events/
│   │   ├── EventCard.tsx         # Summary card used in listings
│   │   ├── EventCardSkeleton.tsx
│   │   ├── EventGrid.tsx
│   │   ├── EventFilters.tsx      # Category / date / search filter bar
│   │   ├── EventDetail.tsx       # Full event detail view
│   │   ├── RegisterButton.tsx    # Client Component — handles registration state
│   │   └── FavouriteButton.tsx   # Client Component — optimistic toggle
│   ├── organizer/
│   │   ├── EventForm.tsx         # Create/edit event — React Hook Form + Zod
│   │   ├── ParticipantTable.tsx
│   │   └── PublishToggle.tsx
│   ├── auth/
│   │   ├── LoginForm.tsx
│   │   └── SignupForm.tsx
│   └── shared/
│       ├── EmptyState.tsx
│       ├── LoadingSpinner.tsx
│       ├── ErrorMessage.tsx
│       ├── Badge.tsx
│       ├── Avatar.tsx
│       └── PageHeader.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts             # Browser Supabase client (anon key only)
│   │   ├── server.ts             # Server Supabase client (cookie-based session)
│   │   └── middleware.ts         # Session refresh helper used in middleware.ts
│   ├── db/                       # Data-access layer — server-only
│   │   ├── events.ts
│   │   ├── registrations.ts
│   │   ├── favourites.ts
│   │   └── profiles.ts
│   ├── validations/
│   │   ├── event.schema.ts       # Zod schemas shared between client & server
│   │   └── auth.schema.ts
│   ├── hooks/                    # Custom React hooks (client-side)
│   │   ├── useEvents.ts          # TanStack Query wrappers
│   │   ├── useRegistration.ts
│   │   └── useFavourite.ts
│   ├── utils.ts                  # Generic utilities (cn, formatDate, etc.)
│   └── constants.ts              # App-wide constants
├── types/
│   ├── database.ts               # Supabase-generated DB types
│   └── app.ts                    # Application-layer types
├── supabase/
│   ├── migrations/               # SQL migration files
│   └── seed.sql                  # Development seed data
├── public/
│   └── images/
├── middleware.ts                 # Edge middleware — session refresh + role routing
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── .env.local.example
├── .eslintrc.json
├── .prettierrc
└── docs/
    └── architecture.md           # This file
```

---

## 4. Route Map

### Public routes (no auth required)

| Route | Page | Notes |
|---|---|---|
| `/` | Landing / event feed | Featured + upcoming events; hero section |
| `/events` | Browse all events | Search, filter, paginate |
| `/events/[id]` | Event detail | Full info; auth-gated registration CTA |
| `/login` | Login | Redirect to `/dashboard` if already authed |
| `/signup` | Sign up | Role selection: Student / Organizer |

### Authenticated routes (any signed-in user)

| Route | Page | Notes |
|---|---|---|
| `/dashboard` | Student dashboard | Registered events + favourites |
| `/settings` | Profile settings | Display name, avatar, email |

### Organizer routes (role = `organizer`)

| Route | Page | Notes |
|---|---|---|
| `/organizer` | Overview | Stats: total events, total registrations |
| `/organizer/events` | My events | Published / draft list |
| `/organizer/events/new` | Create event | EventForm in create mode |
| `/organizer/events/[id]/edit` | Edit event | EventForm in edit mode; only event owner |
| `/organizer/events/[id]/participants` | Participants | Paginated list; CSV export |

### API routes

| Route | Method | Purpose |
|---|---|---|
| `/api/auth/callback` | GET | Supabase PKCE / magic-link exchange |

---

## 5. Database Schema

All tables live in the `public` schema. UUIDs are used for all primary keys. `updated_at` is maintained via a Postgres trigger.

### `profiles`
Extends `auth.users` (1-to-1). Populated on sign-up via a Postgres trigger.

```sql
id           uuid primary key references auth.users(id) on delete cascade
role         text not null default 'student'  -- 'student' | 'organizer'
display_name text not null
avatar_url   text
created_at   timestamptz not null default now()
updated_at   timestamptz not null default now()
```

### `events`
Core event entity.

```sql
id            uuid primary key default gen_random_uuid()
organizer_id  uuid not null references profiles(id) on delete cascade
title         text not null
slug          text not null unique            -- URL-friendly identifier
description   text not null
location      text not null
starts_at     timestamptz not null
ends_at       timestamptz not null
cover_image   text                            -- Supabase Storage public URL
category      text not null                  -- 'academic' | 'social' | 'sports' | 'workshop' | 'career' | 'cultural' | 'other'
capacity      integer                         -- null = unlimited
is_published  boolean not null default false
tags          text[] not null default '{}'
created_at    timestamptz not null default now()
updated_at    timestamptz not null default now()
```

Indexes: `organizer_id`, `starts_at`, `is_published`, `category`, GIN on `tags`, `slug`.

### `registrations`
Student to Event join table.

```sql
id            uuid primary key default gen_random_uuid()
event_id      uuid not null references events(id) on delete cascade
student_id    uuid not null references profiles(id) on delete cascade
registered_at timestamptz not null default now()
unique(event_id, student_id)
```

Indexes: `event_id`, `student_id`.

### `favourites`
Student to Event favourites.

```sql
id         uuid primary key default gen_random_uuid()
event_id   uuid not null references events(id) on delete cascade
student_id uuid not null references profiles(id) on delete cascade
created_at timestamptz not null default now()
unique(event_id, student_id)
```

### Database helpers

- A `handle_new_user()` trigger on `auth.users` inserts a row into `profiles` on every sign-up.
- An `update_updated_at()` trigger keeps `updated_at` current on `events` and `profiles`.
- A `registration_count` view aggregates registrations per event for efficient display.

---

## 6. Authorization Model

### Supabase Auth

- Email + password is the primary auth method.
- Magic link (passwordless) is supported.
- Sessions are stored server-side as httpOnly cookies using `@supabase/ssr`; the anon key is the only Supabase credential ever sent to the browser.
- The service-role key is **never** referenced in any client-side module. It is loaded only in server-only files guarded by `import 'server-only'`.

### Row Level Security (RLS)

RLS is enabled on **all tables**. The frontend never relies solely on UI guards.

#### `profiles`
| Operation | Policy |
|---|---|
| SELECT | `auth.uid() = id` OR profile belongs to event organizer (for display name on cards) |
| INSERT | Trigger only (no direct insert from clients) |
| UPDATE | `auth.uid() = id` |

#### `events`
| Operation | Policy |
|---|---|
| SELECT | `is_published = true` OR `organizer_id = auth.uid()` |
| INSERT | `auth.uid() = organizer_id` AND role verified via `profiles` |
| UPDATE | `organizer_id = auth.uid()` |
| DELETE | `organizer_id = auth.uid()` |

#### `registrations`
| Operation | Policy |
|---|---|
| SELECT | `student_id = auth.uid()` OR `event.organizer_id = auth.uid()` |
| INSERT | `student_id = auth.uid()` AND `event.is_published = true` AND capacity not exceeded |
| DELETE | `student_id = auth.uid()` (unregister) |

#### `favourites`
| Operation | Policy |
|---|---|
| SELECT | `student_id = auth.uid()` |
| INSERT | `student_id = auth.uid()` |
| DELETE | `student_id = auth.uid()` |

### Application-layer role guard

- `middleware.ts` reads the session via `@supabase/ssr`, checks the user's `role` in `profiles`, and redirects any non-organizer attempting to access `/organizer/*` to `/dashboard`.
- Server Component layouts perform a second server-side check as a defence-in-depth measure.

---

## 7. Component Strategy

### Server Components (default)

- All page-level components and layouts.
- Static UI chrome: Navbar, Footer, PageHeader.
- Data-fetching wrappers that call the data-access layer directly.
- Event cards rendered in the initial feed.

### Client Components (`'use client'`)

Strictly limited to components that require browser APIs or interactivity:

| Component | Reason |
|---|---|
| `RegisterButton` | Mutation + optimistic UI + toast |
| `FavouriteButton` | Optimistic toggle |
| `EventFilters` | Controlled inputs, URL state |
| `EventForm` | React Hook Form |
| `LoginForm` / `SignupForm` | React Hook Form |
| `PublishToggle` | Mutation |
| `TanStack Query Provider` | Context provider |

### Shared primitive rules

- shadcn/ui components are imported from `@/components/ui/` and are never modified directly; extend them via composition.
- All interactive elements have descriptive `id` attributes and proper `aria-*` labels.
- Icons from `lucide-react` are always accompanied by a visually hidden label for screen readers where the icon is the sole affordance.

---

## 8. Data Fetching Strategy

### Server-side (default path)

Pages fetch data directly in Server Components by calling functions in `lib/db/`.
No additional HTTP round-trip; data arrives with the initial HTML.

```
page.tsx (Server Component)
  └─ lib/db/events.ts          ← calls supabase server client
       └─ Supabase PostgreSQL
```

### Client-side (mutation + real-time path)

TanStack Query is used **only** where client-side caching, optimistic updates, or re-fetching on focus is genuinely beneficial:

- `useRegistration` — register/unregister mutations with optimistic rollback.
- `useFavourite` — favourite toggle with immediate UI update.
- `useEvents` — used on the `/events` browse page where filters change frequently without full navigation.

TanStack Query does **not** replace server-side data fetching for static or semi-static pages.

### Forms

React Hook Form manages all form state.
Zod schemas live in `lib/validations/` and are imported on both client (for RHF `resolver`) and server (for Server Action / API route validation).

### Server Actions

For form submissions (create event, update profile, register), Next.js **Server Actions** are preferred over separate API routes. This removes a fetch layer and keeps mutations co-located with their forms. Server Actions validate input with Zod before touching the database.

---

## 9. Performance Strategy

| Concern | Approach |
|---|---|
| Image optimisation | `next/image` with explicit `width`/`height`; cover images served from Supabase Storage via the `images.remotePatterns` allow-list |
| Font loading | `next/font/google` with `display: swap` and subsetting |
| Bundle size | Server Components reduce JS payload; `lucide-react` tree-shaken; `framer-motion` limited to leaf Client Components |
| Caching | `fetch` calls in Server Components use `next: { revalidate }` or `cache: 'no-store'` as appropriate; TanStack Query provides client-side stale-while-revalidate |
| Loading states | `loading.tsx` files co-located with pages; skeleton components for cards |
| Streaming | `<Suspense>` boundaries wrap expensive data-fetching Server Components to enable partial streaming |
| Event list pagination | Cursor-based pagination on the Supabase queries; no offset for large tables |
| Database indexes | Composite index on `(is_published, starts_at)` for the public feed; per-column indexes as listed in §5 |

---

## 10. Security Strategy

| Threat | Mitigation |
|---|---|
| Credential leak | Service-role key never in browser bundle; `.env.local.example` lists only `NEXT_PUBLIC_*` vars as public |
| Unauthorized data access | RLS on every table; server-side role checks in middleware + layout |
| CSRF | Next.js Server Actions use the built-in CSRF token mechanism |
| XSS | React escapes output by default; no `dangerouslySetInnerHTML` without sanitisation |
| SQL injection | Supabase JS SDK uses parameterized queries exclusively |
| Mass assignment | Zod schemas on Server Actions strip unknown keys before DB write |
| Insecure direct object reference | RLS policies enforce ownership; organizer can only edit their own events |
| Open redirect | Auth callback validates `next` param against an allow-list |
| Capacity race condition | Postgres function with `FOR UPDATE` row lock checks capacity before inserting a registration |

---

## 11. Accessibility Strategy

- Semantic HTML: `<main>`, `<nav>`, `<header>`, `<section>`, `<article>`, `<aside>` used appropriately.
- Focus management: modal dialogs use `shadcn/ui Dialog` which handles focus trap and `aria-modal`.
- Colour contrast: minimum WCAG AA (4.5:1 for text, 3:1 for UI components).
- Keyboard navigation: all interactive elements reachable and operable via keyboard.
- Motion: all Motion animations respect `prefers-reduced-motion` via Framer Motion's `useReducedMotion` hook.
- Form errors: React Hook Form errors linked to inputs via `aria-describedby`.
- Screen reader labels: icon-only buttons always include a visually hidden `<span>`.

---

## 12. Testing Strategy

### Unit / component tests

- **Vitest** + **React Testing Library** for component logic and utility functions.
- Tests live adjacent to source files (`*.test.ts` / `*.test.tsx`).
- Supabase client is mocked via `vi.mock('@/lib/supabase/client')`.

### Integration tests

- **Playwright** for end-to-end flows: sign up, event registration, organizer event creation.
- Playwright tests run against a local Supabase instance using `supabase start`.
- CI matrix: Chromium, Firefox, WebKit.

### Type checking

- `tsc --noEmit` runs in CI on every pull request.

### Linting

- ESLint with `eslint-config-next` + `@typescript-eslint/recommended`.
- Prettier enforced via `eslint-plugin-prettier`.
- Pre-commit hook via `lint-staged` + `husky`.

### Test coverage targets

| Area | Target |
|---|---|
| Data-access layer (`lib/db/`) | 80%+ |
| Form validation schemas | 100% |
| Critical user flows (E2E) | 100% scenario coverage |

---

## 13. Deployment Strategy

### Hosting

- **Vercel** — primary deployment target for the Next.js application.
  - Preview deployments on every pull request.
  - Production deployment from `main` branch.

### Supabase

- **Supabase Cloud** — managed PostgreSQL + Auth.
- Migrations managed via the Supabase CLI (`supabase db push`).
- Separate Supabase projects for `development`, `staging`, and `production`.

### Environment variables

| Variable | Exposure | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only | Admin operations (never in browser) |
| `NEXT_PUBLIC_APP_URL` | Public | Canonical app URL for redirects |

### CI/CD pipeline

```
push / PR
  ├── tsc --noEmit
  ├── eslint
  ├── prettier --check
  ├── vitest --run
  └── playwright (Chromium, Firefox, WebKit)

merge to main
  └── Vercel production deploy
       └── supabase db push (via GitHub Actions)
```

---

## 14. Key Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Auth session storage | httpOnly cookies via `@supabase/ssr` | Prevents XSS token theft; works with RSC |
| Role storage | `profiles.role` column | Simple; RLS checks `profiles` via `auth.uid()` |
| Slug generation | Server-side from title + `nanoid` suffix | Unique, human-readable event URLs |
| Image storage | Supabase Storage | Integrated CDN; avoids third-party dependency |
| Pagination style | Cursor-based | Stable under concurrent inserts; no offset drift |
| Server Actions vs API routes | Server Actions for mutations | Fewer round-trips; built-in CSRF; co-location |
| TanStack Query scope | Client mutations + filter-heavy browse page only | Avoids over-engineering static pages |
| Capacity enforcement | Postgres function + row lock | Prevents double-booking race conditions |
| Animation library | Framer Motion (Motion v11) | Best-in-class but used sparingly |
| Component primitives | shadcn/ui | Copy-in, accessible, unstyled-by-default |

---

## 15. Open Assumptions

1. **Email provider**: Supabase's default email provider (Mailer) is assumed for development. For production, an SMTP provider (e.g., Resend) should be configured.
2. **OAuth providers**: Scope is email/password + magic link. Google OAuth can be added in Phase 2 with minimal schema changes.
3. **Real-time**: Registration counts will update on page refresh. Live real-time via Supabase subscriptions is a Phase 2 feature.
4. **Notifications**: Out of scope for Phase 1. A `notifications` table pattern is reserved.
5. **Multi-campus/multi-tenant**: Out of scope. A single shared database with no campus scoping is assumed.
6. **File uploads**: Cover images uploaded to Supabase Storage from the organizer event form. Max 5 MB, JPEG/PNG/WebP only.
7. **Time zones**: All timestamps stored in UTC. Display in the user's local time via `Intl.DateTimeFormat`.
8. **CSV export**: Participant export implemented via a streamed Server Action / route handler, not a third-party library.

---

## 16. Required Dependencies

### Production

```json
{
  "next": "^14",
  "react": "^18",
  "react-dom": "^18",
  "typescript": "^5",
  "@supabase/supabase-js": "^2",
  "@supabase/ssr": "^0.5",
  "@tanstack/react-query": "^5",
  "react-hook-form": "^7",
  "@hookform/resolvers": "^3",
  "zod": "^3",
  "lucide-react": "^0.400",
  "framer-motion": "^11",
  "tailwindcss": "^3",
  "class-variance-authority": "^0.7",
  "clsx": "^2",
  "tailwind-merge": "^2",
  "nanoid": "^5"
}
```

### Development

```json
{
  "@types/node": "^20",
  "@types/react": "^18",
  "@types/react-dom": "^18",
  "eslint": "^8",
  "eslint-config-next": "^14",
  "@typescript-eslint/eslint-plugin": "^7",
  "@typescript-eslint/parser": "^7",
  "prettier": "^3",
  "eslint-plugin-prettier": "^5",
  "vitest": "^1",
  "@testing-library/react": "^14",
  "@testing-library/user-event": "^14",
  "playwright": "^1",
  "@playwright/test": "^1",
  "husky": "^9",
  "lint-staged": "^15",
  "supabase": "^1"
}
```

---

## 17. Recommended Implementation Phases

### Phase 1 — Foundation
- [ ] Initialise Next.js project with TypeScript, Tailwind, shadcn/ui
- [ ] Configure ESLint, Prettier, `tsconfig` (strict)
- [ ] Set up Supabase project and local dev environment
- [ ] Write all database migrations (schema + RLS policies + triggers)
- [ ] Implement `lib/supabase/` client, server, and middleware helpers
- [ ] Implement `lib/db/` data-access layer with types
- [ ] Implement auth flows: sign up, log in, log out, session middleware
- [ ] Build Navbar, Footer, and root layout

### Phase 2 — Core Student Experience
- [ ] Landing page with event feed
- [ ] `/events` browse page with search and filters
- [ ] `/events/[id]` event detail page
- [ ] `RegisterButton` with optimistic UI
- [ ] `FavouriteButton` with optimistic UI
- [ ] `/dashboard` — registered events + favourites

### Phase 3 — Organizer Experience
- [ ] `/organizer` overview
- [ ] Event creation form (`EventForm`)
- [ ] Event edit form
- [ ] Event publish/unpublish toggle
- [ ] `/organizer/events/[id]/participants` with CSV export
- [ ] Event deletion with confirmation dialog

### Phase 4 — Polish & Production Readiness
- [ ] Loading skeletons for all data-fetching routes
- [ ] Error boundaries and useful error states
- [ ] Empty states for all list views
- [ ] Accessibility audit (axe-core)
- [ ] Playwright E2E test suite
- [ ] Performance audit (Lighthouse CI)
- [ ] SEO: metadata API, Open Graph, sitemap
- [ ] Deployment pipeline on Vercel + Supabase Cloud
