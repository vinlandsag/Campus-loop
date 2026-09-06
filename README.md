# College Loop

College Loop is a campus-focused event discovery and registration platform built for students, campus organizers, clubs, and communities. It helps people discover events, RSVP, manage registrations, and keep campus activity organized in one place.

## Tech Stack

- Next.js 16 App Router
- TypeScript
- Tailwind CSS v4
- shadcn/ui
- Supabase (PostgreSQL + Auth)
- TanStack Query v5
- React Hook Form + Zod
- Framer Motion

## Getting Started

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

## Architecture

See [docs/architecture.md](./docs/architecture.md) for the full architecture document.

## Environment Variables

Copy `.env.local.example` to `.env.local` and fill in your Supabase credentials and app secrets.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Build for production |
| `npm run typecheck` | Run TypeScript checks |
| `npm run lint` | Run ESLint |
| `npm run test` | Run the Vitest suite |
| `npm run format` | Format the source files |

## Repository

- GitHub: https://github.com/vinlandsag/College-loop.git
