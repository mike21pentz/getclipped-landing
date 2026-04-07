# GetClipped — Session Handoff (2026-03-20)

> Paste this file into the next chat to pick up where we left off.
> Always read `backend/CLAUDE.md` and `frontend/CLAUDE.md` at session start.

---

## DB State — Fully Migrated

All tables are live in Supabase. Everything below has been created and verified:

**Core tables:** `profiles`, `jobs`, `proposals` (with delivery columns)
**Messaging:** `conversations`, `messages`, `conversation_reads`
**Notifications:** `notifications`
**Ratings:** `ratings`
**Style / AI pipeline:** `style_profiles`, `connected_channels`, `pipeline_jobs`, `ai_drafts`, `clip_submissions`, `preference_signals`

**Extra columns added to `profiles`:** `reputation_score`, `avg_rating`, `ratings_count`, `completed_jobs_count`
**Extra columns added to `jobs`:** `completed_at`, `preferred_editing_pace`, `preferred_caption_style`, `preferred_clip_length_seconds`, `style_notes`, `reference_clip_url`, `job_style_tags`

**Storage:** `clips` bucket created (private), INSERT + SELECT policies for authenticated users.

---

## What Was Built This Session

### 1. Clipper onboarding routing
`app/(auth)/actions.ts` — clippers now redirect to `/onboarding/clipper-style` on signup instead of `/dashboard`.

### 2. Full messaging system
- `app/api/conversations/route.ts` — GET list + POST start conversation
- `app/api/conversations/[id]/messages/route.ts` — GET + POST messages
- `app/api/conversations/[id]/read/route.ts` — POST marks conversation as read
- `app/(app)/messages/page.tsx` — real inbox with conversation list, timestamps, last message preview
- `app/(app)/messages/[id]/page.tsx` + `ConversationThread.tsx` — real-time thread via Supabase subscription, optimistic sends, Enter to submit
- Message buttons on job detail: creator → "Message clipper" on proposals panel, clipper → "Message creator" in sidebar
- Unread message badge on Messages nav item (counts conversations with unread messages)

### 3. Ratings system
- `app/api/jobs/[id]/rate/route.ts` — one rating per user per job, creator rates clipper and clipper rates creator
- `app/(app)/jobs/[id]/RatingForm.tsx` — star rating UI shown after job completion on both sides
- Wired into `ProposalsPanel.tsx` (creator view) and job detail completed state (clipper view)

### 4. Notification system
- `lib/supabase/admin.ts` — service role Supabase client (bypasses RLS for server-side inserts)
- `lib/notifications.ts` — `createNotification()` helper
- `app/api/notifications/route.ts` — GET last 30 notifications
- `app/api/notifications/read/route.ts` — POST marks all as read
- Notifications fire automatically on: proposal accepted, proposal rejected, delivery received, job completed, rating received
- `NotificationBell` component in sidebar — unread badge + dropdown with click-to-navigate

### 5. Clipper reputation score
- `lib/reputation.ts` — `recomputeReputation(clipperId)` fire-and-forget async helper
- Score 0–100: avg rating (40pts) + completion rate (30pts) + social proof log scale (15pts) + repeat hire rate (15pts)
- Stored on `profiles` as `reputation_score`, `avg_rating`, `ratings_count`, `completed_jobs_count`
- Auto-triggers after job completion and after a creator submits a rating

### 6. Bug fix — style profile content types
`app/api/style/profile/route.ts` — removed overly restrictive validation that silently dropped all content types from onboarding (was filtering against wrong canonical values).

---

## Environment Variables
Both of these must be in `getclipped-app/.env.local`:
```
SUPABASE_SERVICE_ROLE_KEY=...    ← added this session (Supabase → Settings → API → Secret key)
ANTHROPIC_API_KEY=...            ← added previous session
```

---

## What To Build Next (Priority Order)

### 1. Smart Clipper Matching
`GET /api/jobs/[id]/matched-clippers`
When a creator posts a job, score all clippers by fit using `style_profiles` data: content type overlap, editing pace match, caption preference match, AI style tags overlap, past completion rate. Return top N ranked clippers. This flips discovery — creators find clippers instead of waiting.

### 2. Direct Hire / Job Invite
`POST /api/jobs/[id]/invite` — creator invites a specific clipper directly.
Needs new table: `job_invites(id, job_id, clipper_id, invited_by, status, created_at)`
Clipper gets a notification + "Invited" badge on the job. Builds repeat-hire loyalty loops.

### 3. Analytics API
- `GET /api/analytics/creator` — jobs posted, avg proposals per job, avg time to hire, total committed spend, top clippers
- `GET /api/analytics/clipper` — win rate, avg earnings, best content type, completion rate, repeat hire count
Powers an insights section on the dashboard.

### 4. Job Watchlist
New table: `job_saves(user_id, job_id, saved_at)`
- `POST /api/jobs/[id]/save`
- `DELETE /api/jobs/[id]/save`
- `GET /api/jobs/saved`
Clippers save jobs they're eyeing. Creators see save count as social proof.

### 5. Clipper Availability Status
Add `availability text check (availability in ('available', 'busy', 'unavailable'))` to `profiles`.
Auto-set to `busy` on job accept, `available` on job complete.
`PATCH /api/profile/availability`. Creators can filter browse by availability.

### 6. Job Templates
New table: `job_templates(id, creator_id, title, description, platform, content_type, budget_min, budget_max, clips_needed, turnaround_days, created_at)`
- `GET /api/job-templates`
- `POST /api/job-templates`
- `POST /api/jobs/from-template/[templateId]`

### 7. Proposal Limit Per Job
Add `max_proposals int default 20` to `jobs`. Auto-close to new auditions when limit is hit. Adds urgency.

### 8. Stripe Connect
Biggest remaining feature. Escrow on job accept, release on completion. `releaseEscrow.ts` is a stub in the codebase.

### 9. Auth pages redesign
`/login` and `/signup` still use old Barlow design — mismatched with the rest of the app.

### 10. Clipper onboarding for existing users
Clippers who signed up before this session never went through onboarding. Need a check on dashboard: if clipper + no `style_profile` row → surface a prompt to complete it.

---

## Key File Map
```
lib/
  supabase/server.ts          server Supabase client
  supabase/client.ts          browser Supabase client
  supabase/admin.ts           service role client (NEW this session)
  notifications.ts            createNotification() helper (NEW)
  reputation.ts               recomputeReputation() helper (NEW)

app/api/
  conversations/              GET list + POST start
  conversations/[id]/
    messages/                 GET + POST messages
    read/                     POST mark read
  notifications/              GET fetch
  notifications/read/         POST mark all read
  jobs/[id]/
    submit/                   clipper submits audition
    approve/                  creator accepts proposal (+ notification)
    reject/                   creator rejects proposal (+ notification)
    claim/                    clipper direct-claims a job
    deliver/                  clipper submits delivery (+ notification)
    complete/                 creator marks job done (+ notification + reputation recompute)
    rate/                     post-completion rating (+ notification + reputation recompute)

app/(app)/
  messages/page.tsx           inbox
  messages/[id]/page.tsx      thread page
  messages/[id]/ConversationThread.tsx  real-time client component
  jobs/[id]/
    page.tsx                  job detail
    ProposalsPanel.tsx        creator proposals view + rating form
    RatingForm.tsx            star rating UI (NEW)
    MessageButton.tsx         clipper → message creator (NEW)
    AuditionForm.tsx          clipper audition submission
    DeliveryForm.tsx          clipper delivery submission

components/
  sidebar.tsx                 nav + unread badges + NotificationBell (updated)
```