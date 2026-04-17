# GetClipped — Session Handoff (2026-04-17)

> Paste this file into the next chat to pick up where we left off.

---

## ACTIVE PLAN — Landing repositioning + onboarding overhaul

**Plan file:** `/Users/mjpentz/.claude/plans/vivid-petting-barto.md` (read this first in next session)

**The repositioning in one line:** retire the waitlist at `getclipped.live`, point that domain at the Vercel app, and overhaul onboarding for both creators (currently nonexistent) and clippers (already built but missing emotion + evidence framing).

**Four principles every onboarding surface must hit:** emotion, benefits, personalization, evidence. Because we have zero real users, evidence comes from a coded animated demo + founder note — never fake testimonials or stats.

### Phase status

| Phase | Status | Notes |
|---|---|---|
| 1 — Landing rewrite (`LandingPage.tsx`) | **DONE** | All AI-first copy removed, fake testimonials/stats removed, coded animated `FlowDemo` component built, founder note added, pricing collapsed to 2 tiers |
| 2 — Creator onboarding (NEW) | Pending | New `/onboarding/creator` 6-step wizard, mirror clipper-style pattern, gate via `proxy.ts`, add `platforms`, `clip_volume`, `onboarding_completed_at` columns to `profiles` |
| 3 — Polish clipper onboarding | Pending | Add welcome step 0 + final "what's next" step to existing `/onboarding/clipper-style` |
| 4 — Retire waitlist | Pending | Replace `/Users/mjpentz/PycharmProjects/GetClipped/index.html` with redirect stub to `getclipped.live/signup` |
| 5 — Domain switch (manual — user runs) | Pending | Namecheap DNS + Vercel domain config — exact steps in plan file |

### Phase 1 decisions worth carrying forward

- **Hero headline:** "Get your hours back / Get paid for the cut / Get more clips out" (two-sided framing — picks up both creators and clippers)
- **Hero font reduced** from `clamp(72px, 10vw, 140px)` → `clamp(48px, 7vw, 96px)` and `max-width: 900 → 1200px` so the 3-line headline fits viewport without wrapping
- **Demo budget pricing** shown as **$4–10/clip** (not $15–25) because anything ≥$15 trips the "I could just pay for an AI tool" comparison and bounces the visitor. Footnote: "Clippers set rates by length & complexity"
- **Demo escrow release:** $35 (5 clips × ~$7 avg)
- **No fake testimonials, no fake stats** — all content honestly reflects the early-stage product. Founder note: "There are no fake testimonials on this page — when there are real ones, they'll show up where the sample profile is."
- **Removed:** Agency pricing tier, hero stat row, floating clipper cards, dedicated Auditions section (folded into the demo), all AI tool name-drops (CapCut AI, Opus Clip), all real-streamer name-drops (xQc, summit1g)
- **Asset strategy:** all "demo" content is coded animated React components (no recorded video files). Same approach planned for the onboarding walkthroughs in Phase 2/3.

### How to verify Phase 1

`http://localhost:3000` in **incognito** (logged-in users get redirected to `/dashboard`). Should see: clean hero, animated 3-stage demo loop in the "See the flow" section, sample-profile reputation card with no real names, founder note before footer, 2-tier pricing.

### Files changed this session

- `getclipped-app/components/landing/LandingPage.tsx` — rewritten (485 → 400 lines)
- `getclipped-app/components/landing/landing.css` — added demo, founder, pricing-grid-2, responsive rules

---

## What GetClipped Is

A two-sided marketplace connecting content creators with professional clippers (video editors who produce TikTok clips, YouTube Shorts, Reels). The platform's reputation/ratings layer is the moat — trust, track records, relationships — on top of AI-assisted human talent.

**Strategic positioning:** Not competing with Opus Clip on AI features. The differentiator is the marketplace trust layer.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router), TypeScript |
| Styling | Tailwind CSS v4 + CSS custom properties. Inline styles for spacing (Tailwind mb-* unreliable) |
| Auth + DB | Supabase (project ID: `clqqdgjoyjamojlqfxig`) |
| Storage | Supabase Storage — `clips` bucket (private, signed URLs) |
| Payments | Stripe Connect (escrow) — blocked on SA country support |
| Deployment | Vercel (app at `app.getclipped.live`) + static waitlist at `getclipped.live` |
| Package manager | npm |

---

## MVP Focus

**No AI features until MVP is complete.**
**No Stripe Connect until SA country support is resolved.**

---

## Repo Structure

```
/getclipped-landing/    Static waitlist page (getclipped.live)
/getclipped-app/        Next.js 16 app (Vercel → app.getclipped.live)
```

**Next.js 16 middleware:** The middleware file is `proxy.ts` (NOT `middleware.ts`). Never create `middleware.ts`.

### Supabase Patterns
```ts
// Server component / route handler
import { createClient } from "@/lib/supabase/server";
const supabase = await createClient();

// Client component
import { createClient } from "@/lib/supabase/client";
const supabase = createClient();

// Admin client (bypasses RLS — use in API routes when user session is insufficient)
import { createAdminClient } from "@/lib/supabase/admin";
const admin = createAdminClient();
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
Spacing: always inline styles with px values. Tailwind mb-* classes are unreliable.
Generous spacing always.
```

---

## Layout Architecture

- **Desktop sidebar**: fixed, 220px (collapsed: 64px), state in localStorage
- **Mobile bottom bar**: fixed bottom, 60px height
- Safari fix: NEVER use `margin-left` to offset main content — use flex spacer in `AppShell.tsx`
- **`proxy.ts`** is the Next.js 16 middleware file — clipper onboarding gate lives here

---

## Database Schema

### profiles
```
id, name, account_type ('creator'|'clipper'), bio, avatar_url,
channel_url (creator), content_niche (creator), portfolio_urls[] (clipper),
ai_tools[] (clipper), roles text[],
reputation_score, avg_rating, ratings_count, completed_jobs_count,
stripe_account_id, stripe_onboarding_complete
```

### jobs
```
id, creator_id, title, description, platform[], content_type, budget_min, budget_max,
clips_needed, turnaround_days,
status ('open'|'in_progress'|'completed'|'cancelled'),
completed_at, stripe_payment_intent_id,
payment_status ('unpaid'|'escrow'|'released'|'refunded')
```

### proposals
```
id, job_id, clipper_id, message, rate, clip_title, file_url,
status ('pending'|'accepted'|'rejected'),
delivery_message, delivery_files[], delivered_at
```

### ratings
```
id, job_id, rater_id, rated_id, score numeric (0.5–5, half-star), comment text (min 20 chars)
unique(job_id, rater_id)
```

### Other tables
```
retainer_contracts, retainer_deliveries, style_profiles,
conversations, messages, conversation_reads, notifications,
job_templates, job_saves, job_invites
```

---

## PENDING: Stripe DB Migration

Run in Supabase SQL editor before testing payments:

```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_account_id text,
  ADD COLUMN IF NOT EXISTS stripe_onboarding_complete boolean NOT NULL DEFAULT false;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS payment_status text
    NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'escrow', 'released', 'refunded'));
```

---

## Recently Fixed: Sidebar unread message badge (2026-04-17)

The "Messages" sidebar badge was stuck because it summed `unreadCount + unreadNotifications`, and nothing in the app ever marked `notifications` rows as read. Fix: badge is now `unreadCount` only (unread conversations). Also removed the dead notifications UI infrastructure (`GET /api/notifications`, `POST /api/notifications/read`, AppShell Realtime sub on `notifications`, `unreadNotifications` prop wiring). `lib/notifications.ts` is intact — backend still writes notification rows for future consumption.

The `conversation_reads` RLS policy (`auth.uid() = user_id`, command `ALL`) is correct, so `POST /api/conversations/[id]/read` now uses the user-scoped client (the prior admin-client workaround was masking this bug).

---

## What's Built

| Route | Notes |
|---|---|
| `/dashboard` | Creator + clipper views, stat cards, quick actions |
| `/browse` | Job board — hero card, filters, AI search, match scoring, save buttons |
| `/jobs`, `/jobs/[id]`, `/jobs/new` | Clipper applications, job detail, post-a-job |
| `/messages`, `/messages/[id]` | Inbox with unread dots + real-time preview updates. Thread with Realtime + optimistic sends |
| `/profile` | Profile editing + half-star reviews section |
| `/settings`, `/settings/style`, `/settings/payments` | Account, clipper style profile, Stripe Connect setup |
| `/onboarding/clipper-style` | 6-step clipper onboarding |
| `/retainers` | Retainer contracts with delivery tracking |
| `/analytics` | Creator analytics |
| `/login`, `/signup`, `/forgot-password`, `/update-password` | Auth pages |

---

## Stripe Escrow Flow (built, pending DB migration + SA country fix)

```
Creator accepts proposal → POST /api/jobs/[id]/checkout → Stripe Checkout (manual capture)
→ /api/jobs/[id]/checkout-success → job in_progress, proposal accepted
→ Creator confirms delivery → POST /api/jobs/[id]/complete → capture + transfer to clipper (minus 10%)
```

---

## Clipper Onboarding (fixed this session)

- `actions.ts` uses admin client for `profiles.upsert` so RLS doesn't block it when no session exists
- `auth/callback/route.ts` checks if profile exists after email confirmation, creates it if missing
- New clippers are routed to `/onboarding/clipper-style` after email confirmation

---

## Key API Routes

```
POST /api/jobs/[id]/submit, /approve, /reject, /deliver, /complete, /rate
POST /api/jobs/[id]/checkout
GET  /api/jobs/[id]/checkout-success
GET/POST/DELETE /api/jobs/[id]/save
GET  /api/analytics/creator
POST /api/stripe/connect/onboard
GET  /api/stripe/connect/status
POST /api/stripe/webhook
POST /api/conversations, GET/POST /api/conversations/[id]/messages
POST /api/conversations/[id]/read       ← user-scoped, RLS covers it
GET  /api/conversations/unread-count    ← used by AppShell for live badge
POST /api/profile/add-clipper-role
GET  /api/ai/job-search
```

---

## Key File Map

```
lib/
  supabase/server.ts, client.ts, admin.ts
  notifications.ts, reputation.ts, email.ts, stripe.ts
  matching/computeMatchScore.ts

components/
  AppShell.tsx          — listens for conversation-read event, updates sidebar badge live
  sidebar.tsx
  ProtectedVideoPlayer.tsx

app/(app)/
  messages/page.tsx                    — fetches read state, computes isUnread per conversation
  messages/ConversationList.tsx        — unread dots, real-time preview, clears dot on row click
  messages/[id]/ConversationThread.tsx — dispatches conversation-read event after POST /read
  settings/payments/page.tsx
```

---

## Environment Variables

```
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
RESEND_API_KEY=...
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=...
NEXT_PUBLIC_APP_URL=https://app.getclipped.live
```

---

## Test Accounts

- **Creator:** Michael (mjpentz21@gmail.com)
- **Clipper:** Daryl Marock (cmpstudios.site@gmail.com)
- Use incognito for second account

---

## What's NOT Built Yet

1. **Stripe payout on completion** — blocked on SA Stripe Connect country support
2. **Clip protection Phase 2** — server-side FFmpeg watermarking, deferred post-MVP
3. **Clipper onboarding auto-route** — fixed in auth/callback, needs end-to-end testing
4. **Real /messages search/filter** — nice to have
5. **Notifications UI** — backend still writes `notifications` rows (proposals, deliveries, ratings) but there's no UI to view them. Build a dropdown/panel when ready.

---

## Session History

- **Apr 8**: Logo, sidebar, spacing, settings, pipeline, dashboard
- **Apr 9**: Mobile responsiveness, reputation, AI tools, retainers, onboarding
- **Apr 10**: Landing page, signup fix, dual roles, domain setup, analytics, notifications
- **Apr 13**: Notifications → Messages merge, AI Clip Finder, Remotion clip editor
- **Apr 14**: AI Clip Studio, role CTAs, onboarding middleware, ratings, localStorage cache
- **Apr 15**: Clip protection overlay, card/form restyles, delivery progress, payment modal, half-star ratings
- **Apr 16 #1**: WayinVideo API integration
- **Apr 16 #2**: Removed all AI clipping. Built Stripe escrow checkout. Fixed onboarding bug. Fixed half-star display.
- **Apr 16 #3**: Fixed clipper onboarding profiles bug (admin client). Fixed Stripe Connect bugs. Built messages inbox unread indicators + real-time. Sidebar badge still broken (see ACTIVE BUG).
- **Apr 17 #1**: Fixed sidebar Messages badge — was summing unread conversations + unread notifications, but nothing ever marked notifications read. Badge now reflects conversations only. Deleted orphan notifications API routes and reverted admin-client workaround in `POST /api/conversations/[id]/read`.
- **Apr 17 #2**: Strategic decision to retire waitlist + reposition landing + build creator onboarding. Approved plan saved at `/Users/mjpentz/.claude/plans/vivid-petting-barto.md`. **Phase 1 complete:** rewrote `LandingPage.tsx` (485 → 400 lines), removed all AI-first copy + fake testimonials/stats, built coded animated `FlowDemo` (post job → auditions → delivery, ~13s loop), added founder note, collapsed pricing to 2 tiers, hero rewritten to two-sided framing ("Get your hours back / Get paid for the cut / Get more clips out"), demo budget set to $4–10/clip to stay below AI-tool subscription comparison threshold. **Phases 2–5 pending.**
