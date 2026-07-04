// Cloudflare Workers entrypoint referenced by `main` in wrangler.toml; runs the Astro pipeline via `handle`.

import { handle } from '@astrojs/cloudflare/handler';

export default {
  async fetch(request, env, ctx) {
    return handle(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
