# Held pages

Folders whose name starts with an underscore are private in the Next.js App Router: nothing in
here is routed. A page waits here until it is ready to publish; to publish it, move its folder
back to `app/` and add it to `STATIC_ROUTES` in `lib/seo-routes.ts`.

- `dumbest-ai-model/` (built 2026-10-30) — "Which AI model is the dumbest right now?". Held
  because it names the lowest-placed models on the 24-hour board, and while SYNTHETIC_MODE is on
  those scores are generated, not measured. Publish once the real benchmark data is merged.
