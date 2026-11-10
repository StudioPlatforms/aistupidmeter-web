/**
 * The providers the Smart Router can call, with what a person needs to add a key for each: where
 * to create one and what it looks like. One list for the provider keys page, the router key
 * dialog and the preferences page, so they never disagree.
 */
export type RoutableProvider = 'openai' | 'anthropic' | 'google' | 'deepseek' | 'kimi' | 'glm';

export interface RouterProviderInfo {
  id: RoutableProvider;
  /** How the provider is named on our pages. */
  name: string;
  /** Who runs it, when that differs from the name. */
  maker: string;
  keyFormat: string;
  /** Where the account owner creates an API key (no scheme). */
  keyUrl: string;
}

export const ROUTER_PROVIDERS: RouterProviderInfo[] = [
  { id: 'openai', name: 'OpenAI', maker: 'OpenAI', keyFormat: 'sk-proj-...', keyUrl: 'platform.openai.com/api-keys' },
  { id: 'anthropic', name: 'Anthropic', maker: 'Anthropic', keyFormat: 'sk-ant-...', keyUrl: 'console.anthropic.com/settings/keys' },
  { id: 'google', name: 'Google', maker: 'Google', keyFormat: 'AIza...', keyUrl: 'aistudio.google.com/apikey' },
  { id: 'deepseek', name: 'DeepSeek', maker: 'DeepSeek', keyFormat: 'sk-...', keyUrl: 'platform.deepseek.com/api_keys' },
  { id: 'kimi', name: 'Kimi', maker: 'Moonshot AI', keyFormat: 'sk-...', keyUrl: 'platform.moonshot.ai/console/api-keys' },
  { id: 'glm', name: 'GLM', maker: 'Z.ai', keyFormat: 'API key from Z.ai', keyUrl: 'z.ai/manage-apikey/apikey-list' },
];

export const isRoutableProvider = (p: string | null | undefined): p is RoutableProvider =>
  !!p && ROUTER_PROVIDERS.some(x => x.id === p);

export const routerProvider = (p: string): RouterProviderInfo | undefined => ROUTER_PROVIDERS.find(x => x.id === p);

/** "OpenAI", "Kimi (Moonshot AI)" — the name with its maker when they differ. */
export function providerTitle(p: string): string {
  const info = routerProvider(p);
  if (!info) return p ? p.charAt(0).toUpperCase() + p.slice(1) : 'provider';
  return info.maker !== info.name ? `${info.name} (${info.maker})` : info.name;
}

/** Joins provider titles: "OpenAI, Google and Kimi (Moonshot AI)". */
export function providerList(ps: string[]): string {
  const t = ps.map(providerTitle);
  return t.length <= 1 ? (t[0] ?? '') : `${t.slice(0, -1).join(', ')} and ${t[t.length - 1]}`;
}

/** The link that opens the "add a key" dialog for one provider. */
export const addKeyHref = (p?: string) => (p ? `/router/providers?add=${encodeURIComponent(p)}` : '/router/providers');
