# My Fitness Tracker — cloud-synced GitHub Pages version

## What changed
- Diet and workout records are stored in Supabase by date, so the same account can use the tracker on phone and computer.
- Home page shows today's diet + workout overview and weekly/monthly/yearly trends.
- Diet analytics use saved daily nutrition summaries, so calorie/protein graphs follow actual saved entries.
- Workout analytics use saved workout summaries, so volume and completion graphs follow actual saved entries.
- Custom foods and custom exercises are stored per user and sync across devices.
- Responsive layouts for desktop, tablet and mobile.
- Workout page no longer leaves the large empty side gap; the reference images sit in their own right-side card on desktop and stack on mobile.
- Gym / food / combined fitness imagery is used as remote 3840px Unsplash backgrounds.
- Existing workout reference images are included.

## Setup
1. Create a Supabase project.
2. Open Supabase SQL Editor and run `supabase_setup.sql`.
3. Copy `config.example.js` to `config.js`.
4. Put your Supabase project URL and browser publishable/anon key into `config.js`.
5. Never put a `service_role` or secret key in `config.js`.
6. Upload the full folder to the same GitHub repository that hosts your current site.
7. On the first login, use Home -> "Import old local history" to migrate data from the previous localStorage-based tracker.

## Why the old site did not sync
The previous static tracker used browser localStorage, so each device had a separate copy. This version uses Supabase Auth + database rows keyed by the signed-in user and date.

## GitHub Pages
GitHub Pages hosts the static frontend. Supabase provides authentication and the cloud database. Keep Row Level Security enabled as provided in `supabase_setup.sql`.

## Background image sources
The backgrounds use remote Unsplash image URLs. Unsplash provides free image libraries and health/fitness collections; individual photo availability/licensing can vary, so you can replace these URLs with any images you prefer.
