import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {defineConfig, type Plugin} from 'vite';

/** Writes /sw.js from src/service-worker.js, versioned by the build's file names so every deploy refreshes its cache. */
function serviceWorker(): Plugin {
  return {
    name: 'batnab-service-worker',
    apply: 'build',
    generateBundle(_, bundle) {
      const version = createHash('sha256').update(Object.keys(bundle).sort().join('\n')).digest('hex').slice(0, 12);
      const source = readFileSync(new URL('./src/service-worker.js', import.meta.url), 'utf8').replace('__VERSION__', version);
      this.emitFile({type: 'asset', fileName: 'sw.js', source});
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), serviceWorker()],
  build: {
    rolldownOptions: {
      output: {
        // Long-lived vendor chunks: they rarely change between deploys, so browsers keep them cached.
        codeSplitting: {
          groups: [
            // Analytics (and the installations module it needs) loads later on its own.
            {name: 'firebase', test: /node_modules[\\/](@firebase[\\/](?!analytics|installations)|firebase[\\/](?!analytics))/},
            {name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/},
          ],
        },
      },
    },
  },
});
