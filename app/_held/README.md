# Held pages

Folders whose name starts with an underscore are private in the Next.js App Router: nothing in
here is routed. A page waits here until it is ready to publish; to publish it, move its folder
back to `app/` and add it to `STATIC_ROUTES` in `lib/seo-routes.ts`.

- `dumbest-ai-model/` (built 2026-10-30) — "Which AI model is the dumbest right now?". Held
  because it names the lowest-placed models on the 24-hour board. Publish when the owner decides.
- `ai-nerf-tracker/` (built 2026-11-26) — the version of /ai-nerf-tracker with one verdict per model,
  family by family, read from the tracker's data. The published page is the guide (what a nerf is, how
  the check works, where to look); this one replaces `app/ai-nerf-tracker/page.tsx` when the owner decides.
