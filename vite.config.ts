import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * The two latin font files are needed by the first paint, but they are only
 * discovered after the stylesheet has been fetched and parsed, so they arrive
 * a round trip late and the swap reflows the page under them. Measured 0.209
 * CLS on the landing page before this and 0.000 after, at a cost of about
 * 100ms of LCP on slow 4G, which is the right side of that trade: layout
 * shift is a failing Core Web Vital here and the LCP stays inside its budget.
 * Vite hashes the file names, so the tags are written from the bundle rather
 * than by hand.
 */
function preloadLatinFonts() {
  return {
    name: 'preload-latin-fonts',
    transformIndexHtml: {
      order: 'post' as const,
      handler(_html: string, ctx: { bundle?: Record<string, unknown> }) {
        const files = Object.keys(ctx.bundle ?? {}).filter((f) =>
          /geist(-mono)?-latin-wght-normal-[^/]*\.woff2$/.test(f),
        );
        return files.map((file) => ({
          tag: 'link',
          attrs: { rel: 'preload', as: 'font', type: 'font/woff2', crossorigin: '', href: `/${file}` },
          // Appended rather than prepended so the charset declaration stays first.
          injectTo: 'head' as const,
        }));
      },
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), preloadLatinFonts()],
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        // Split so the framework caches independently of the catalog, which
        // is the part that changes every time a price is re-authored.
        manualChunks(id: string) {
          if (id.includes('node_modules/react') || id.includes('node_modules/scheduler')) return 'react';
          if (id.includes('node_modules/motion') || id.includes('node_modules/framer-motion')) return 'motion';
          // details.json is dynamically imported and must stay its own chunk.
          // Routing all of /src/data/ into 'catalog' silently pulled it into
          // the eager bundle and defeated the lazy load.
          if (id.includes('details.json')) return undefined;
          if (id.includes('/src/data/')) return 'catalog';
          return undefined;
        },
      },
    },
  },
});
