# CampusLoop — Production Launch-Readiness Checklist

This checklist details the configuration and operational setup required **outside the repository** to deploy CampusLoop reliably to production.

---

## 1. Supabase Project Settings

### Authentication & URLs
- [ ] **Site URL**: Set in **Authentication → URL Configuration** to your production domain (e.g. `https://campusloop.edu` or `https://events.campusloop.com`).
- [ ] **Redirect URLs**: Add the production auth callback endpoint to **Redirect URLs**:
  - `https://your-domain.com/api/auth/callback`
  - `https://your-domain.com/**`
- [ ] **Email Auth**:
  - In development, email confirmations may be disabled for rapid testing.
  - For production, enable **Confirm email** under **Authentication → Providers → Email**.
  - Configure custom email template branding with your university or CampusLoop logo.
- [ ] **JWT Expiration**: Default is 3600 seconds (1 hour). Verify session refresh token rotation is enabled.

### Row-Level Security (RLS) Audit
- [ ] Verify that RLS is **enabled** on all production tables:
  - `campuses` (public read active campuses)
  - `events` (public read published, organizer write)
  - `registrations` (student self-manage, event organizer read)
  - `notifications` (user self-read/update)
  - `favorites` (user self-manage)
  - `profiles` (self-manage, public organizer view)
  - `event_team_members` (team view, owner manage)
  - `event_registration_questions` (public read active, editor/owner manage)
  - `registration_answers` (attendee read/write, team member read)
  - `event_announcements` (team member read/audit)
- [ ] Verify security invoker mode on the `organizer_profiles` safe public view.

---

## 2. Supabase Storage Buckets

Configure the two required public storage buckets in **Storage**:

### `event_banners`
- [ ] **Public Bucket**: Yes (allows CDN delivery of event banners).
- [ ] **File Size Limit**: 5 MB (`5242880` bytes).
- [ ] **Allowed MIME Types**: `image/jpeg`, `image/png`, `image/webp`.
- [ ] **RLS Storage Policies**:
  - **Read**: Allow public `SELECT` on `bucket_id = 'event_banners'`.
  - **Insert / Update**: Allow authenticated organizers `INSERT` / `UPDATE` on `bucket_id = 'event_banners'`.

### `avatars`
- [ ] **Public Bucket**: Yes (profile avatars and club logos).
- [ ] **File Size Limit**: 2 MB (`2097152` bytes).
- [ ] **Allowed MIME Types**: `image/jpeg`, `image/png`, `image/webp`.
- [ ] **RLS Storage Policies**:
  - **Read**: Allow public `SELECT` on `bucket_id = 'avatars'`.
  - **Insert / Update**: Allow authenticated users `INSERT` / `UPDATE` for their own profile images.

---

## 3. Database Migration Sequence

Execute all migrations in chronological order against the production Supabase PostgreSQL instance:

```bash
# Apply with Supabase CLI
supabase db push
```

Migration execution sequence:
1. `20260906072952_create_schema.sql` — Initial tables & enums.
2. `20260906073200_create_rls_policies.sql` — Base RLS policies.
3. `20260906092813_add_registration_rpc.sql` — Initial registration procedure.
4. `20260906200000_create_storage_bucket.sql` — Storage bucket definitions.
5. `20260908230000_fix_role_trigger.sql` — Profile role trigger.
6. `20260909000000_add_paid_events.sql` — Free vs paid pricing fields.
7. `20260910000000_secure_customer_data_and_organizers.sql` — Data security & organizer verification view.
8. `20260910120000_phase2_dates_capacity_favorites.sql` — Date filtering, capacity spots, favorites.
9. `20260910180000_phase3_campus_identity_and_scoping.sql` — Campus model and domain scoping.
10. `20260910190000_allow_organizer_signup_unverified.sql` — Organizer pending review status.
11. `20260910220000_phase4_trustworthy_event_changes.sql` — Cancel/reschedule audit & in-app notifications.
12. `20260910225000_phase5_add_waitlist_status_enum.sql` — Separate transaction enum extension (`waitlisted`, `checked_in`).
13. `20260910230000_phase5_waitlist_tickets_checkin.sql` — Waitlist FIFO, cryptographic tickets, QR codes, idempotent check-in.
14. `20260910240000_phase6_organizer_tools_teams_questions.sql` — Organizer teams, custom questions, announcements, safe CSV.
15. `20260911000000_phase7_discovery_profiles_event_details.sql` — Discovery lenses, club profiles, event decision details.
16. `20260912000000_phase9a_transactional_registration_waitlist.sql` — Transactionally correct registration, atomic waitlist promotion, deadline enforcement.
17. `20260912100000_phase9b_security_privacy_hardening.sql` — Notification RLS hardening, draft question privacy, verified organizer privacy view, least-privilege security definer functions.
18. `20260912110000_phase9c_team_permissions_campus_identity.sql` — Unified event team permissions, check-in staff least-privilege & data minimization, campus verification lifecycle & event campus immutability.
19. `20260912120000_phase10_post_registration_experience.sql` — User notification preferences, delivery tracking & honesty audit, scheduled reminder jobs, aggregate feedback privacy RPC, and moderation report queue.

---

## 4. Transactional Email Provider Setup

When moving beyond development mode, configure a production transactional email provider in Supabase **Settings → Authentication → SMTP Settings** (or via Resend / SendGrid / Amazon SES):

- [ ] **Sender Name**: CampusLoop (or University Events)
- [ ] **Sender Email**: `notifications@your-domain.com`
- [ ] **SMTP Host**: e.g., `smtp.resend.com`
- [ ] **SMTP Port**: `465` (SSL) or `587` (TLS)
- [ ] **SMTP User & Password**: Configured from provider credentials.
- [ ] **SPF, DKIM, and DMARC**: Verify DNS records for your sending domain to ensure 100% deliverability to campus student inboxes.

---

## 5. Production Environment Variables

Configure these variables in your hosting provider (Vercel, AWS Amplify, Docker, etc.):

| Variable | Required | Purpose | Example Value |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | **Yes** | Public Supabase project API gateway | `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Yes** | Public Supabase anonymous client key | `eyJhbGciOi...` |
| `NEXT_PUBLIC_APP_URL` | **Yes** | Canonical origin for OpenGraph & metadata | `https://campusloop.edu` |
| `TICKET_SIGNING_SECRET` | **Yes** | Server HMAC secret for ticket signatures (Fails closed in production if missing) | 32+ character random hex string |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional | Admin background jobs / maintenance | Keep strictly server-side |

> [!CAUTION]
> Generate a strong, high-entropy secret for `TICKET_SIGNING_SECRET` in production. Predictable fallbacks (`campusloop-fallback-secret-2026`, `default-secret`, etc.) are blocked and will fail closed at runtime. Changing this key after launch will invalidate QR code signatures on tickets generated beforehand.

---

## 6. Production Hosting & Performance

- [ ] **Custom Domain & SSL**: Enable automatic HTTPS / SSL termination.
- [ ] **Image Optimization**: Confirm Next.js Image optimization is working and `next.config.ts` includes your Supabase storage domain.
- [ ] **Deterministic Fonts**: Verified self-hosted fonts in `src/app/fonts/` require zero external Google Font CDN dependencies.
- [ ] **HTTP Security Headers**: Ensure standard security headers are applied:
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- [ ] **Smoke Test Critical Flows**:
  - Create verified test student account.
  - Create verified test organizer account.
  - Create published event with capacity and questions.
  - Complete RSVP, test waitlist promotion, and scan QR ticket code.
