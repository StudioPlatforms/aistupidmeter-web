import { logoSources } from '@/lib/host-logo';

interface ProviderLogoProps {
  provider: string;
  size?: number;
  className?: string;
  /**
   * A host's approved mark: its 64 px rendition (/media/providers/<slug>-<sha8>-64.png); the larger
   * renditions are offered through srcset. A host (an inference provider listed on AI Stupid Level)
   * must never come here without it — every name not in FILES shows the OpenAI mark — so a host
   * with no approved mark is drawn by components/marketplace/HostLogo, with its initials. An address
   * that is not one of a host's PNG renditions (lib/host-logo.ts) draws an empty box of the same
   * size: never a vendor's mark in the host's place, and never that address.
   */
  logoUrl?: string | null;
}

// Official brand marks (Lobe Icons) served from /public/logos.
const FILES = new Set(['openai', 'anthropic', 'google', 'xai', 'deepseek', 'glm', 'kimi']);

function fileFor(provider: string): string {
  const p = (provider || '').toLowerCase().replace('x.ai', 'xai').replace('gemini', 'google');
  return FILES.has(p) ? p : 'openai';
}

export default function ProviderLogo({ provider, size = 48, className = '', logoUrl }: ProviderLogoProps) {
  const host = logoUrl ? logoSources(logoUrl, size) : null;
  if (logoUrl && !host) return <span className={className} aria-hidden="true" style={{ display: 'block', width: size, height: size }} />;
  return (
    <img
      src={host ? host.src : `/logos/${fileFor(provider)}.svg`}
      srcSet={host?.srcSet}
      sizes={host?.sizes}
      width={size}
      height={size}
      alt={`${provider} logo`}
      className={className}
      loading="lazy"
      style={{ display: 'block', width: size, height: size, objectFit: 'contain' }}
    />
  );
}
