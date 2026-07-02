interface ProviderLogoProps {
  provider: string;
  size?: number;
  className?: string;
}

// Official brand marks (Lobe Icons) served from /public/logos.
const FILES = new Set(['openai', 'anthropic', 'google', 'xai', 'deepseek', 'glm', 'kimi']);

function fileFor(provider: string): string {
  const p = (provider || '').toLowerCase().replace('x.ai', 'xai').replace('gemini', 'google');
  return FILES.has(p) ? p : 'openai';
}

export default function ProviderLogo({ provider, size = 48, className = '' }: ProviderLogoProps) {
  return (
    <img
      src={`/logos/${fileFor(provider)}.svg`}
      width={size}
      height={size}
      alt={`${provider} logo`}
      className={className}
      loading="lazy"
      style={{ display: 'block', width: size, height: size, objectFit: 'contain' }}
    />
  );
}
