import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
