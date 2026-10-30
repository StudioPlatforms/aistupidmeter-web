/** @type {import('next').NextConfig} */
const nextConfig = {
  // Lets a deploy build into another folder while the live server keeps serving .next, then
  // swap the two (/root/admin/deploy-web.sh): seconds of restart instead of minutes of 502s,
  // which Google records as server errors. Unset, this is Next's own default.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  webpack: (config, { isServer }) => {
    // Exclude Node.js modules from client bundle
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        path: false,
        os: false,
        stream: false,
        http: false,
        https: false,
        zlib: false,
        'better-sqlite3': false,
        bcryptjs: false,
      };
    }
    return config;
  },
  // Ensure server-only modules stay server-side.
  // In Next 14 this lives under `experimental`; at the top level it is ignored
  // and the server warns "Unrecognized key(s)" on every boot.
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3', 'bcryptjs'],
  },

  /**
   * Account surfaces moved out of /router/*.
   *
   * /router stays the routing product — keys, providers, routing preferences,
   * analytics, monitoring. What moved is the part about the person rather than
   * the proxy: plan, settings, team. A Pro subscriber who never routes a request
   * should not open a page called "router" to change their email preferences.
   *
   * NOTE: these must live in THIS file. Next resolves next.config.js BEFORE
   * next.config.mjs, so a config placed in the .mjs is silently ignored — which
   * is exactly what happened on the first attempt.
   */
  async redirects() {
    return [
      { source: '/router/subscription', destination: '/account/billing', permanent: true },
      { source: '/router/profile', destination: '/account/settings', permanent: true },
      { source: '/router/data-keys', destination: '/account/data-keys', permanent: true },

      // Retired models whose pages were indexed (in the sitemap, or still requested by
      // Googlebot) go to their successor or their vendor's page instead of a 404, so the
      // links they earned are kept. Add a line here whenever a ranked model is retired.
      { source: '/models/kimi-k3', destination: '/models/kimi-k3-1-pro', permanent: true },
      { source: '/models/kimi-k2-7-code', destination: '/models/kimi', permanent: true },
      { source: '/models/claude-opus-4-5', destination: '/models/anthropic', permanent: true },
      { source: '/models/gpt-5-3-codex', destination: '/models/openai', permanent: true },
      { source: '/models/gpt-5-4', destination: '/models/openai', permanent: true },
      { source: '/models/glm-5-2', destination: '/models/glm', permanent: true },
      { source: '/models/claude-sonnet-4-5', destination: '/models/anthropic', permanent: true },
      { source: '/models/kimi-k2.7-code', destination: '/models/kimi', permanent: true },
      // Old numeric model URLs. Current models' ids already go to their slug from the model page;
      // these belong to retired models (xAI is no longer tracked, so its ids go to the model hub).
      { source: '/models/41', destination: '/models', permanent: true },   // grok-4-latest
      { source: '/models/42', destination: '/models', permanent: true },   // grok-code-fast-1
      { source: '/models/69', destination: '/models/openai', permanent: true },   // gpt-4o-2024-11-20
      { source: '/models/140', destination: '/models', permanent: true },  // grok-4-0709
      { source: '/models/160', destination: '/models/anthropic', permanent: true },  // claude-sonnet-4-5-20250929
      { source: '/models/171', destination: '/models/kimi', permanent: true },   // kimi-latest
      { source: '/models/185', destination: '/models/google', permanent: true },  // gemini-3-pro-preview
      { source: '/models/188', destination: '/models/anthropic', permanent: true },  // claude-opus-4-5-20251101
      { source: '/models/226', destination: '/models/openai', permanent: true },  // gpt-5.3-codex
      { source: '/models/230', destination: '/models/openai', permanent: true },  // gpt-5.4
      { source: '/models/270', destination: '/models/kimi', permanent: true },   // kimi-k2.7-code
      { source: '/models/272', destination: '/models/glm', permanent: true },    // glm-5.2
      { source: '/models/278', destination: '/models/kimi-k3-1-pro', permanent: true },  // kimi-k3
      { source: '/models/295', destination: '/models/anthropic', permanent: true },  // claude-sonnet-4-5
    ];
  },

  compiler: {
    // Strip console output from production builds.
    //
    // The app carries ~205 console calls, 83 of them in HomeClient alone, and
    // they were all shipping to real users' browsers — every period switch
    // dumped a wall of "⚡ User changed to…", "🚀 CLIENT CACHE HIT…",
    // "🚫 Degraded models to exclude…" into the console. Fine while debugging,
    // unprofessional for anyone who opens devtools on the live site.
    //
    // Done at build time rather than by deleting the call sites so local `next
    // dev` keeps every log. error and warn are kept deliberately: genuine
    // failures should still be visible in production.
    removeConsole:
      process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
};

module.exports = nextConfig;
