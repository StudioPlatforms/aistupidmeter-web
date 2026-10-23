/**
 * One-click import into CC Switch (ccswitch.io), the provider switcher for coding tools. Its
 * `ccswitch://v1/import` deep link adds AI Stupid Level as a provider in the chosen app (protocol:
 * cc-switch docs/user-manual/en/5-faq/5.3-deeplink.md).
 *
 * Only apps that speak OpenAI Chat Completions natively are offered. The router has no Responses
 * API, and Claude Code would reach only Claude, through the /v1/messages passthrough.
 */
export const CC_SWITCH_APPS = [
  { app: 'opencode', label: 'OpenCode' },
  { app: 'openclaw', label: 'OpenClaw' },
  { app: 'hermes', label: 'Hermes' },
  { app: 'pi', label: 'Pi' },
] as const;

export type CcSwitchApp = (typeof CC_SWITCH_APPS)[number]['app'];

/** A provider import link. With a key it is ready to use; without one, CC Switch asks for it. */
export function ccSwitchProviderLink(app: CcSwitchApp, apiKey?: string): string {
  const params: Array<[string, string]> = [
    ['resource', 'provider'],
    ['app', app],
    ['name', 'AI Stupid Level'],
    ['endpoint', 'https://aistupidlevel.info/v1'],
    ['apiFormat', 'openai_chat'],
    ['model', 'auto-coding'],
    ['homepage', 'https://aistupidlevel.info/router'],
  ];
  if (apiKey) params.push(['apiKey', apiKey]);
  // encodeURIComponent rather than URLSearchParams: spaces become %20, as in the protocol's examples.
  return `ccswitch://v1/import?${params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}`;
}
