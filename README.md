# AI Stupid Level — web app

The Next.js front end of [AI Stupid Level](https://aistupidlevel.info), an independent, continuous
LLM benchmark running since August 2025. The site is the leaderboard, the per-model pages, the
drift reporting, the provider status page, the Smart Router dashboard and the public documentation.

## What the site shows

- **Benchmarks on a fixed schedule.** Models from OpenAI, Anthropic, Google, DeepSeek,
  Moonshot AI (Kimi) and Z.ai (GLM) get the same tests through each provider's public API:
  coding every four hours, reasoning and tool use daily, with an hourly canary probe.
- **Coding graded by execution.** Repository debugging tasks are scored by running the project's
  own tests, including hidden tests; the coding score is built from nine measures with published
  weights. Reasoning is scored over long multi-turn sessions, tool use in sandboxed machines.
- **Scores with error bars.** Every score carries a standard error from its own run-to-run
  repeatability; models whose lead is inside that noise share a place on the board.
- **Drift detection per suite.** Page-Hinkley change-point detection (a CUSUM-family test) runs
  on each model's daily median, per suite, with the constants published on the methodology page.
  Watchlist alerts go out by email when a watched model's coding score falls.
- **Smart Router.** One OpenAI-compatible endpoint (`/v1/chat/completions`, plus an Anthropic
  `/v1/messages` passthrough and `/v1/embeddings`) on your own provider keys, with 14 `auto-*`
  routing modes driven by the benchmark results and zero markup on tokens.
- **Data API.** A keyed JSON API for rankings, degradation alerts, drift signatures and provider
  reliability, with a free tier.
- **Plans.** Free, Pro, Developer and Teams, with Enterprise by arrangement; every price and limit is rendered from
  `lib/entitlements.ts`, never typed into copy.

The methodology is public — every weight, statistical test and drift constant — at
[aistupidlevel.info/methodology](https://aistupidlevel.info/methodology). The test tasks are
private, so no lab can train on them. The benchmark runner and API are a separate, private
service; this repository is the web application only.

## Links

- Live site: <https://aistupidlevel.info>
- Methodology: <https://aistupidlevel.info/methodology>
- Smart Router API documentation: <https://aistupidlevel.info/router/docs>
- Public Data API: <https://aistupidlevel.info/api-docs>
- Pricing: <https://aistupidlevel.info/pricing>

## Stack

- Next.js 14 (App Router) with React 18 server components, TypeScript
- next-auth v5 (beta) for accounts; Stripe for plans
- Plain CSS in `styles/` (no Tailwind); design tokens drive light and dark themes
- Server components read the API over loopback (`API_INTERNAL_URL`); client components fetch
  relative paths through the site's reverse proxy

## Running it locally

Requires Node.js 18+ and a running instance of the benchmark API (not included).

```bash
git clone https://github.com/StudioPlatforms/aistupidmeter-web.git
cd aistupidmeter-web
npm install
cp .env.local.template .env.local   # fill in the values
npm run dev
```

Scripts:

- `npm run dev` — development server on <http://localhost:3000>
- `npm run build` — production build (`prebuild` writes `lib/page-dates.json`, the per-page last
  commit dates the sitemap uses as `lastmod`)
- `npm run start` — production server
- `npx tsc --noEmit -p .` — type check

## Layout of the code

- `app/` — routes. Public pages are server components with `export const revalidate`; signed-in
  pages (`/router/*`, `/account/*`) are client-rendered inside the studio shell.
- `components/landing/` — the landing and reading-page toolkit (`Reading.tsx`);
  `components/seo/` — the shared pieces of the SEO pages; `components/studio/` — the app shell.
- `lib/` — `entitlements.ts` (plans and limits), `pricing-display.ts`, `boards-core.ts`
  (statistical ranks and ties, shared by the leaderboard and the server-rendered pages),
  `seo.ts` (metadata and JSON-LD helpers), `seo-data.ts` (server-side data for the SEO pages),
  `seo-routes.ts` (the route registry behind the sitemap).
- `styles/` — one stylesheet per surface; `landing.css` and `reading.css` carry the public look.

## Contributing

Pull requests are welcome. Keep copy to claims that can be checked against the code or the live
data: no model names or rankings in static text (they are rendered from the API), no counts typed
by hand, and the cadence exactly as the scheduler runs it.

## Community

- X: [@AIStupidlevel](https://x.com/AIStupidlevel)
- Reddit: [r/aistupidlevel](https://www.reddit.com/r/aistupidlevel/)
- Hugging Face: [AIStupidLevel](https://huggingface.co/AIStupidLevel)
- LinkedIn: [AI Stupid Level](https://www.linkedin.com/company/asl-aistupidlevel-info)

## License

MIT — see `LICENSE`.

Built by [Studio Platforms](https://studioplatforms.eu). Contact: <hello@aistupidlevel.info>.
