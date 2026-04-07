# GetClipped

Hiring marketplace connecting content creators/streamers with professional clippers (video editors for TikTok, YouTube Shorts, Reels). Like Upwork for the clipping economy.

## Repo Structure

```
/getclipped-landing/   — Static landing page (GitHub Pages → getclipped.live)
/getclipped-app/       — Next.js 16 MVP app (Vercel)
/frontend/CLAUDE.md    — Frontend context: design system, components, routes, styling rules
/backend/CLAUDE.md     — Backend context: Supabase, DB schema, RLS, auth patterns
```

## Dev Commands

```bash
cd getclipped-app && npm run dev     # http://localhost:3000
cd getclipped-app && npm run build   # type-check + build

# Package manager: npm (not yarn or pnpm)
```

## Tech Stack

- **Framework**: Next.js 16 (App Router), TypeScript
- **Styling**: Tailwind CSS v4 + CSS custom properties
- **Auth + DB**: Supabase (project ID: clqqdgjoyjamojlqfxig)
- **Storage**: Supabase Storage — `clips` bucket (private)
- **Payments**: Stripe Connect (escrow) — not yet implemented

---

## What's Not Built Yet

- Stripe Connect escrow (payments)
- Real messaging (`/messages` is a placeholder)
- Ratings / trust score
- Auth pages redesign (login/signup still use legacy Barlow design)
- Retainer contracts
- Performance analytics
- Clipper onboarding flow (new clippers are not routed to onboarding on signup)

# GetClipped — Backend Context

Auth + DB: Supabase (project ID: `clqqdgjoyjamojlqfxig`)
Storage: Supabase Storage — `clips` bucket (private)
Payments: Stripe Connect (escrow) — not yet implemented
Package manager: npm (not yarn or pnpm)

---

## Supabase Patterns

```ts
// Server component (use in page.tsx, route handlers, server actions)
import { createClient } from "@/lib/supabase/server";
const supabase = await createClient();

// Client component (use in "use client" components)
import { createClient } from "@/lib/supabase/client";
const supabase = createClient();

// Get current user + account type
const { data: { user } } = await supabase.auth.getUser();
const accountType = user?.user_metadata?.account_type as string;
const isCreator = accountType === "creator";
```

---

## User Types

- **Creator** — posts jobs, reviews auditions, accepts/rejects proposals
- **Clipper** — browses job board, submits audition clips, delivers work

`account_type` stored in both `user_metadata` (Supabase Auth) and `profiles` table.

---

## Database Schema

### Tables

**profiles**
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | FK → auth.users |
| `name` | text | |
| `account_type` | text | `creator` or `clipper` |
| `bio` | text | |
| `avatar_url` | text | |
| `channel_url` | text | Creator only |
| `content_niche` | text | Creator only |
| `portfolio_urls` | text[] | Clipper only |

**jobs**
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `creator_id` | uuid | FK → profiles |
| `title` | text | |
| `description` | text | |
| `platform` | text[] | e.g. `['TikTok', 'YouTube Shorts']` |
| `content_type` | text | Gaming, IRL, Podcast, Reaction, Variety, Other |
| `budget_min` | int | |
| `budget_max` | int | |
| `clips_needed` | int | |
| `turnaround_days` | int | |
| `status` | text | `open` / `in_progress` / `completed` / `cancelled` |
| `completed_at` | timestamptz | Set when creator marks complete |

**proposals**
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `job_id` | uuid | FK → jobs |
| `clipper_id` | uuid | FK → profiles |
| `message` | text | Cover message from clipper |
| `rate` | int | Per-clip rate offered |
| `clip_title` | text | |
| `file_url` | text | Audition clip URL |
| `status` | text | `pending` / `accepted` / `rejected` |
| `delivery_message` | text | Clipper's delivery note |
| `delivery_files` | text[] | Delivered clip URLs |
| `delivered_at` | timestamptz | Set on delivery |

### Pending Migration (run in Supabase before testing delivery flow)
```sql
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS delivery_message text,
  ADD COLUMN IF NOT EXISTS delivery_files text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

CREATE POLICY "Clippers can deliver on accepted proposals"
  ON public.proposals FOR UPDATE
  USING (auth.uid() = clipper_id AND status = 'accepted')
  WITH CHECK (auth.uid() = clipper_id);
```

---

## Row Level Security (RLS)

| Table | Policy |
|---|---|
| profiles | Public read, owner write |
| jobs | Public read, creator write (creator_id = auth.uid()) |
| proposals | Clippers see own rows; creators see proposals on their jobs; creators can update status |

---

## Storage

- Bucket: `clips` (private — signed URLs required for access)
- Job auditions: `jobs/{job_id}/{clipper_id}/{timestamp}.{ext}`
- Portfolio clips: `portfolio/{user_id}/{timestamp}.{ext}`

---

## Key Backend Files

| File | Purpose |
|---|---|
| `lib/supabase/server.ts` | Server Supabase client — use in server components + API routes |
| `lib/supabase/client.ts` | Browser Supabase client — use in `"use client"` components |
| `app/(auth)/actions.ts` | Login/signup server actions |
| `supabase/schema.sql` | Canonical DB schema — keep up to date when adding columns |
| `app/api/jobs/[id]/deliver/route.ts` | Clipper submits delivery |
| `app/api/jobs/[id]/complete/route.ts` | Creator marks job complete |