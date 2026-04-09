# GetClipped — Session Handoff (2026-04-09 v2)

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
| Deployment | Vercel |
| Package manager | npm |

---

## Repo Structure

```
/getclipped-landing/    Static landing page (GitHub Pages)
/getclipped-app/        Next.js 16 app (Vercel)
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

Font: var(--font-geist) on ALL app + auth pages (Barlow fully removed)

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
reputation_score int, avg_rating numeric, ratings_count int, completed_jobs_count int,
stripe_account_id, stripe_onboarding_complete bool
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

### retainer_contracts ← NEW
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

## What's Built (all routes working)

| Route | Notes |
|---|---|
| `/dashboard` | Creator + clipper views, real stat cards (total spent/earned computed), quick actions |
| `/browse` | Job board — hero card, mini-row list, filters, AI search, match scoring, save buttons for clippers |
| `/jobs` | Clipper's "My Applications" — grouped by status |
| `/jobs/[id]` | Job detail, audition form, delivery, proposals panel with reputation + AI tools; "Propose Retainer" CTA on completed jobs |
| `/jobs/new` | Two-column post-a-job form with sticky preview |
| `/pipeline`, `/pipeline/[id]` | AI pipeline jobs (separate from regular jobs) |
| `/messages`, `/messages/[id]` | Real-time conversation threads (Supabase Realtime + optimistic updates), unread badges |
| `/profile` | Edit name/bio/avatar, AI tools (clippers), portfolio, channel info (creators) |
| `/settings` | Account, security (3-step verified password change), plan cards |
| `/settings/style` | Clipper style profile for AI matching |
| `/settings/channels` | Creator channel connections |
| `/onboarding/clipper-style` | 6-step clipper onboarding (added AI tools as step 5) |
| `/retainers` | Retainer contracts — active/pending/past, accept/decline/cancel inline |
| `/login`, `/signup` | Auth pages — fully on Geist font now, SVG logo mark |

---

## Reputation System (fully wired)

`lib/reputation.ts` — `recomputeReputation(clipperId)` fires after every rating:
- Writes `avg_rating`, `ratings_count`, `completed_jobs_count`, `reputation_score` (0–100) to `profiles`
- Score breakdown: avg rating (40pts) + completion rate (30pts) + social proof log scale (15pts) + repeat hire rate (15pts)

Surfaced in `ProposalsPanel.tsx` under each clipper's name:
- `⭐ 4.8 · 12 jobs` for rated clippers
- `Top Clipper` accent badge if reputation_score ≥ 80
- `New clipper` in muted text for zero-rating clippers
- AI tool pills (up to 4, `+N more` overflow)

---

## Retainer Contracts (fully wired)

- Creator sees "Propose Retainer" accordion card on completed job pages (only if clipper was accepted, no existing retainer)
- Clipper gets notified, can accept/decline from `/retainers`
- Either party can cancel active retainers
- Notifications: retainer_proposed / retainer_accepted / retainer_declined
- Dashboard: active retainer count shown in creator quick action; retainers link for clippers

---

## Job Saves / Watchlist (fully wired)

- Bookmark icon on every JobCard and HeroJobCard — clippers only
- `components/browse/SaveButton.tsx` — toggles via POST/DELETE `/api/jobs/[id]/save`
- Browse page fetches saved IDs server-side; initial state correct on load
- `job_saves` table: `user_id`, `job_id`, UNIQUE constraint

If RLS not yet set up, run:
```sql
ALTER TABLE job_saves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own saves"
  ON job_saves FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

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
PATCH /api/retainers/[id]       update retainer status (active/declined/cancelled)
POST /api/conversations         create or get existing conversation
GET/POST /api/conversations/[id]/messages
POST /api/conversations/[id]/read
GET  /api/notifications
POST /api/notifications/read
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
  notifications.ts      createNotification() — types include retainer_proposed/accepted/declined
  reputation.ts         recomputeReputation()
  email.ts              Resend transactional emails
  stripe.ts             lazy Stripe client
  matching/computeMatchScore

components/
  AppShell.tsx
  sidebar.tsx           nav includes /retainers
  browse/JobCard.tsx    accepts isSaved, showSave props
  browse/HeroJobCard.tsx
  browse/SaveButton.tsx bookmark toggle component
  browse/FilterBar.tsx, SortBar.tsx, AIJobSearch.tsx, SearchInput.tsx
  dashboard/StatCard.tsx, QuickActionCard.tsx
  jobs/ProposeRetainerCard.tsx   collapsible form on completed job pages
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

### 1. Job invites
Creator invites a specific clipper to apply to a job. `job_invites` table exists, `/api/jobs/[id]/invite` route exists — UI not built. Should surface on:
- Job detail page (creator side): "Invite a clipper" button → search/select clipper
- Clipper's browse/jobs pages: indicator when they've been invited

### 2. Stripe Connect escrow UI
API routes + DB columns exist. Missing creator-facing payment UI:
- After accepting a proposal, prompt creator to pay into escrow
- Payment status on job detail for both parties
- Clipper earnings display

### 3. Creator analytics page
No dedicated `/analytics` page. Dashboard shows basic stat cards (jobs posted, spent, completed). A full analytics page could show: auditions-per-job funnel, clipper repeat hire rate, average turnaround, budget breakdown.

### 4. Retainer contracts — delivery tracking
Active retainers have no delivery workflow yet. No way to log "I delivered this month's clips." Could add a simple delivery log or monthly check-in to active retainers.

### 5. Real-time notification badge
Sidebar unread notification count is fetched server-side on page load — not live. Could subscribe via Supabase Realtime on the notifications table.

### 6. Auth pages — forgot password page
`/forgot-password` still uses legacy styling. Minor.

---

## Session History Summary

- **Apr 8**: Logo, sidebar collapse, spacing pass, settings page, pipeline cleanup, dashboard refactor
- **Apr 9 session 1**: Mobile responsiveness, strategic repositioning, reputation system, AI tools on profiles
- **Apr 9 session 2 (this session)**:
  - Clipper onboarding: added step 5 "Tools I Use" (6-step flow, saves to profiles.ai_tools)
  - Auth pages: Barlow → Geist on headings/buttons, SVG logo mark in layout
  - Retainer contracts: full feature — schema, API routes, /retainers page, ProposeRetainerCard, sidebar nav, notifications
  - Dashboard: real Total Spent / Total Earned from DB, fixed "Open Auditions" → "Pending" (actual pending count), retainers in quick actions
  - Job saves: SaveButton component, browse page passes saved state server-side, bookmark on JobCard + HeroJobCard
