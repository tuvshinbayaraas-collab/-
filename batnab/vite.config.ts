import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {defineConfig} from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
