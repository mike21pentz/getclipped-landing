# GetClipped — Session Handoff (2026-04-10)

> Paste this file into the next chat to pick up where we left off.

---

## What GetClipped Is

A two-sided marketplace connecting content creators with professional clippers (video editors who produce TikTok clips, YouTube Shorts, Reels). Clippers use AI tools (Opus Clip, CapCut, etc.) to deliver faster and better — the platform's reputation/ratings layer is the moat that standalone AI tools cannot replicate.

**Strategic positioning:** Not competing with Opus Clip on AI features. The differentiator is the marketplace trust layer — ratings, track records, relationships — on top of AI-assisted human talent.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router), TypeScript |
| Styling | Tailwind CSS v4 + CSS custom properties. Inline styles for spacing (Tailwind mb-* unreliable) |
| Auth + DB | Supabase (project ID: `clqqdgjoyjamojlqfxig`) |
| Storage | Supabase Storage — `clips` bucket (private, signed URLs) |
| Payments | Stripe Connect (escrow) — schema + routes exist, UI not wired |
| Deployment | Vercel (app) + GitHub Pages (landing) |
| Package manager | npm |

---

## Repo Structure

```
/getclipped-landing/    Static landing page (GitHub Pages → getclipped.live)
/getclipped-app/        Next.js 16 app (Vercel → getclipped-app.vercel.app)
```

### Supabase Patterns
```ts
// Server component / route handler
import { createClient } from "@/lib/supabase/server";
const supabase = await createClient();

// Client component
import { createClient } from "@/lib/supabase/client";
const supabase = createClient();
```

---

## Design System

```
--background:     #0a0a0a
--surface:        #141414
--surface-raised: #1e1e1e
--border:         #313131
--text-primary:   #f0f0f0
--text-secondary: #8a8a8a
--accent:         #c8f135   (yellow-lime — CTAs, active states)

Font: var(--font-geist) on ALL app + auth pages

Responsive page padding: className="page-container"
  Mobile:  32px 20px 80px
  Desktop: 52px 64px 96px
  DO NOT use hardcoded padding inline — use the class

Spacing: always inline styles with px values. Tailwind mb-* classes are unreliable.
Generous spacing always — user has flagged cramped UI multiple times.
```

### Content Type Colors
```ts
Gaming:   { bg: "rgba(168,85,247,0.12)", text: "#c084fc" }
IRL:      { bg: "rgba(59,130,246,0.12)",  text: "#60a5fa" }
Podcast:  { bg: "rgba(249,115,22,0.12)",  text: "#fb923c" }
Reaction: { bg: "rgba(236,72,153,0.12)",  text: "#f472b6" }
Variety:  { bg: "rgba(20,184,166,0.12)",  text: "#2dd4bf" }
Other:    { bg: "rgba(107,114,128,0.12)", text: "#9ca3af" }
```

### Status Badge Colors
```
accepted → bg: rgba(34,197,94,0.12),   text: #4ade80
rejected → bg: rgba(239,68,68,0.12),   text: #f87171
pending  → bg: rgba(107,114,128,0.12), text: #9ca3af
```

---

## Layout Architecture

- **Desktop sidebar**: `hidden md:flex`, fixed, 220px (collapsed: 64px), state in localStorage
- **Safari fix**: NEVER use `margin-left` to offset main content. Use a flex spacer `<div>` in `AppShell.tsx`.
- **Mobile bottom bar**: `md:hidden`, fixed bottom, 60px height, safe-area-inset-bottom
  - Creators: Home / Browse / Pipeline / Messages (4 items)
  - Clippers: Home / Browse / Pipeline / My Apps / Messages (5 items)
- **`.app-main`** in globals.css handles `padding-bottom: 60px` for mobile bottom bar clearance

---

## Database Schema

### profiles
```
id, name, account_type ('creator'|'clipper'), bio, avatar_url,
channel_url (creator), content_niche (creator), portfolio_urls[] (clipper),
ai_tools[] (clipper — tools they use e.g. "Opus Clip", "CapCut"),
roles text[] — ['creator'] | ['clipper'] | ['creator','clipper'] ← NEW dual-role field
reputation_score int, avg_rating numeric, ratings_count int, completed_jobs_count int,
stripe_account_id, stripe_onboarding_complete bool
```

Migration already run:
```sql
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS roles text[] DEFAULT '{}';
UPDATE public.profiles SET roles = ARRAY[account_type] WHERE roles = '{}' OR roles IS NULL;
```

### jobs
```
id, creator_id, title, description, platform[], content_type, budget_min, budget_max,
clips_needed, turnaround_days, status ('open'|'in_progress'|'completed'|'cancelled'),
completed_at, stripe_payment_intent_id, payment_status ('unpaid'|'escrow'|'released'|'refunded'),
preferred_editing_pace, preferred_caption_style, preferred_clip_length_seconds,
style_notes, job_style_tags[]
```

### proposals
```
id, job_id, clipper_id, message, rate, clip_title, file_url,
status ('pending'|'accepted'|'rejected'),
delivery_message, delivery_files[], delivered_at
```

### ratings
```
id, job_id, rater_id, rated_id, score (1-5), comment, created_at
UNIQUE (job_id, rater_id)
RLS: public read, authenticated insert (rater_id = auth.uid())
```

### retainer_contracts
```
id, creator_id, clipper_id, job_id (optional — the job that spawned it),
title, description, clips_per_month int, rate_per_clip int,
status ('proposed'|'active'|'declined'|'cancelled'),
proposed_at, started_at, ended_at, created_at
RLS: participants read/update, creator insert
```

### Other tables
```
style_profiles        — clipper editing preferences for AI match scoring
conversations         — creator ↔ clipper threads
messages              — individual messages
conversation_reads    — last-read timestamps per user per conversation
notifications         — in-app notifications
connected_channels    — creator's linked YouTube/Twitch channels
job_templates         — creator's saved job templates
job_saves             — clipper job watchlist (user_id, job_id, UNIQUE)
job_invites           — creator invites specific clipper to job
```

---

## Dual Role System (NEW — built Apr 10)

Users can hold both `creator` and `clipper` roles on the same account.

**How it works:**
- `profiles.roles text[]` stores all roles a user has (e.g. `['creator', 'clipper']`)
- Active role stored in cookie `active_role` — read server-side by layout, dashboard, and job detail pages
- `AppShell.tsx` manages `activeRole` state; switching sets the cookie + calls `router.refresh()`

**UI:**
- **Sidebar role switcher**: Creator/Clipper toggle pill — shown only when user has both roles
- **"Add Clipper Account"** in sidebar profile popover — shown only to creator-only users; calls `POST /api/profile/add-clipper-role`, sets cookie to `clipper`, redirects to clipper onboarding
- Dashboard, job detail, and sidebar nav all adapt to the active role via cookie

**Key files:**
```
app/api/profile/add-clipper-role/route.ts  — adds 'clipper' to profiles.roles
app/(app)/layout.tsx                        — fetches roles, reads cookie, passes to AppShell
components/AppShell.tsx                     — manages activeRole state + cookie
components/sidebar.tsx                      — role switcher toggle + "Add Clipper Account"
app/(app)/dashboard/page.tsx               — reads active_role cookie
app/(app)/jobs/[id]/page.tsx               — reads active_role cookie; !isOwner guard on audition form
```

**Business rule:** A user cannot audition for a job they posted, even in clipper mode (`!isOwner` guard on the audition form).

---

## What's Built (all routes working)

| Route | Notes |
|---|---|
| `/dashboard` | Creator + clipper views, real stat cards, quick actions, reads active_role cookie |
| `/browse` | Job board — hero card (fully clickable), mini-row list, filters, AI search, match scoring, save buttons |
| `/jobs` | Clipper's "My Applications" — grouped by status |
| `/jobs/[id]` | Job detail, audition form, delivery, proposals panel; reads active_role cookie; blocked for job owner |
| `/jobs/new` | Two-column post-a-job form with sticky preview |
| `/pipeline`, `/pipeline/[id]` | AI pipeline jobs |
| `/messages`, `/messages/[id]` | Real-time conversation threads, unread badges |
| `/profile` | Edit name/bio/avatar, AI tools, portfolio, channel info |
| `/settings` | Account, security, plan cards |
| `/settings/style` | Clipper style profile for AI matching |
| `/settings/channels` | Creator channel connections |
| `/onboarding/clipper-style` | 6-step clipper onboarding — also used when creator adds clipper role |
| `/retainers` | Retainer contracts — active/pending/past, accept/decline/cancel |
| `/login`, `/signup` | Auth pages — signup now creates profiles row immediately (FK bug fixed) |

---

## Landing Page (getclipped-app — Vercel)

`components/landing/LandingPage.tsx` — major UX cleanup done Apr 10:

- **Hero title**: "Find your editor. / Post a job. / Go viral."
- **Hero sub**: trimmed to 2 sentences
- **Nav**: 4 links (How it works / For creators / Auditions / Pricing) — removed "Why human" and "AI tools"
- **Hero CTAs**: single "Sign up free →" button — removed ghost creator/editor buttons
- **How It Works**: step descriptions trimmed to 1 line each
- **For Who**: badge + H3 + 3 bullets each side — paragraphs removed
- **Reputation**: headline + 1 sentence — feature list removed
- **AI Tools section**: removed entirely (feature not built)
- **Auditions**: bullet list removed — visual card does the talking
- **Pricing**: $0 / $14.99 / $49.99. Pro: 1% platform fee on jobs, 10 jobs/month on Free. Agency: multi-account + team seats. Clipper note: "Editors join free — platform takes 10% per job."
- **Section order**: Hero → Marquee → How It Works → For Who → Reputation → Auditions → Pricing → Footer

---

## Reputation System

`lib/reputation.ts` — `recomputeReputation(clipperId)` fires after every rating:
- Writes `avg_rating`, `ratings_count`, `completed_jobs_count`, `reputation_score` (0–100) to `profiles`
- Score: avg rating (40pts) + completion rate (30pts) + social proof log scale (15pts) + repeat hire rate (15pts)

Surfaced in `ProposalsPanel.tsx`: star rating, job count, Top Clipper badge (≥80 score), AI tool pills.

---

## Key API Routes

```
POST /api/jobs/[id]/submit      clipper submits audition
POST /api/jobs/[id]/approve     creator accepts proposal
POST /api/jobs/[id]/reject      creator rejects proposal
POST /api/jobs/[id]/deliver     clipper delivers clips
POST /api/jobs/[id]/complete    creator marks job complete
POST /api/jobs/[id]/rate        rate each other (fires recomputeReputation)
GET  /api/jobs/[id]/save        check saved status + count
POST /api/jobs/[id]/save        save job
DELETE /api/jobs/[id]/save      unsave job
POST /api/retainers             creator proposes retainer
PATCH /api/retainers/[id]       update retainer status
POST /api/conversations         create or get existing conversation
GET/POST /api/conversations/[id]/messages
POST /api/conversations/[id]/read
GET  /api/notifications
POST /api/notifications/read
POST /api/profile/add-clipper-role   add clipper role to existing creator account ← NEW
POST /api/stripe/connect/onboard
GET  /api/stripe/connect/status
POST /api/stripe/webhook
GET  /api/ai/job-search
```

---

## Key File Map

```
lib/
  supabase/server.ts, client.ts, admin.ts
  notifications.ts      createNotification()
  reputation.ts         recomputeReputation()
  email.ts              Resend transactional emails
  stripe.ts             lazy Stripe client
  matching/computeMatchScore

components/
  AppShell.tsx          manages activeRole state + cookie switching
  sidebar.tsx           role switcher toggle, "Add Clipper Account" in profile popover
  landing/LandingPage.tsx
  browse/JobCard.tsx
  browse/HeroJobCard.tsx   fully clickable (onClick navigates whole card)
  browse/SaveButton.tsx
  dashboard/CreatorJobCard.tsx   redesigned Apr 10 — generous padding, stat layout
  dashboard/StatCard.tsx, QuickActionCard.tsx
  jobs/ProposeRetainerCard.tsx
```

---

## Environment Variables

```
SUPABASE_SERVICE_ROLE_KEY=...
ANTHROPIC_API_KEY=...
RESEND_API_KEY=...
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=...
NEXT_PUBLIC_APP_URL=https://app.getclipped.live   (http://localhost:3000 locally)
```

---

## What's NOT Built Yet (priority order)

### 1. Stripe Connect escrow UI
API routes + DB columns exist. Missing:
- After accepting a proposal, prompt creator to pay into escrow
- Payment status on job detail for both parties
- Clipper earnings display

### 2. Creator analytics page
No `/analytics` page. Dashboard shows basic stat cards. Full analytics could show: auditions-per-job funnel, repeat hire rate, average turnaround, budget breakdown.

### 3. Retainer delivery tracking
Active retainers have no delivery workflow. No way to log "I delivered this month's clips."

### 4. Real-time notification badge
Sidebar unread count is fetched server-side on page load — not live. Could subscribe via Supabase Realtime.

### 5. Auth pages redesign
`/login` and `/signup` still use the legacy Barlow design — flagged for redesign but not yet done.

### 6. Mobile responsiveness pass
Full mobile pass was planned (Option B from Apr 8 session) but not yet executed.

---

## Session History Summary

- **Apr 8**: Logo, sidebar collapse, spacing pass, settings page, pipeline cleanup, dashboard refactor
- **Apr 9 session 1**: Mobile responsiveness planning, strategic repositioning, reputation system, AI tools on profiles
- **Apr 9 session 2**: Clipper onboarding tools step, auth pages Geist font, retainer contracts (full feature), dashboard real stats, job saves/watchlist
- **Apr 10 (this session)**:
  - Landing page UX overhaul — cut copy, new hero title, pricing revamp ($0/$14.99/$49.99)
  - Signup bug fix — profiles row now created immediately on signup (FK constraint error resolved)
  - Dual role system — creator can add clipper account, role switcher in sidebar, cookie-based active role
  - CreatorJobCard redesign — generous padding, stat layout, lightweight Manage link
  - HeroJobCard made fully clickable
  - Job detail page reads active_role cookie; !isOwner guard added to audition form
