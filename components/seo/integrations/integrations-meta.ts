import { PLANS } from '@/lib/entitlements';
import { INTEGRATIONS } from '@/lib/integrations';

/**
 * The hub's metadata strings (app/router/integrations/page.tsx), kept out of the component file
 * so the route can import them without pulling React in. Tool names are products, not models,
 * so they may be typed; the request count is read from the plan table.
 */

const n = (x: number) => x.toLocaleString('en-US');

export const HUB_TITLE = 'Smart Router integrations: setup guides';

export const HUB_DESCRIPTION = 'Set up Claude Code, Cursor, Cline, Continue, Aider, OpenCode, n8n, LangChain, Zed, Open WebUI and LibreChat on the Smart Router: one base URL, one key.';

export const HUB_KEYWORDS = [
  'Smart Router integrations', 'LLM router integrations', 'OpenAI compatible proxy setup', 'AI gateway for Cursor',
  'AI gateway for Claude Code', 'one API key all AI models', 'OpenAI compatible base URL', 'AI model router setup',
  ...INTEGRATIONS.flatMap((i) => [i.name, ...(i.aliases ?? [])].map((t) => `${t} AI router`)),
];

export const HUB_LEAD = `The router is an OpenAI-compatible endpoint, so any tool that lets you set a base URL works with it. Every guide below uses the same three values: the base URL, your aism_ key and a routing mode as the model. Your own provider keys, zero token markup, and ${n(PLANS.free.routerRequestsPerMonth)} routed requests a month on the Free plan.`;
