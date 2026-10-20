import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
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

/**
 * Serves the picture-to-text (OCR) engine at /ocr/: Tesseract's worker, its WebAssembly core (three builds; the worker
 * picks what the browser supports) and the Mongolian and English data, straight from node_modules, so nothing loads
 * from another site. They are only fetched when the teacher reads a picture (src/lib/ocr.ts).
 */
function ocrFiles(): Plugin {
  const need = createRequire(import.meta.url);
  const dir = (pkg: string) => need.resolve(`${pkg}/package.json`).replace(/package\.json$/, '');
  const files: Record<string, () => string> = {
    'worker.min.js': () => `${dir('tesseract.js')}dist/worker.min.js`,
    ...Object.fromEntries(['relaxedsimd-lstm', 'simd-lstm', 'lstm'].map((v) => [`tesseract-core-${v}.wasm.js`, () => `${dir('tesseract.js-core')}tesseract-core-${v}.wasm.js`])),
    ...Object.fromEntries(['mon', 'eng'].map((l) => [`${l}.traineddata.gz`, () => `${dir(`@tesseract.js-data/${l}`)}4.0.0_best_int/${l}.traineddata.gz`])),
  };
  return {
    name: 'batnab-ocr-files',
    configureServer(server) {
      server.middlewares.use('/ocr/', (req, res, next) => {
        const file = files[(req.url ?? '').replace(/^\//, '').split('?')[0]];
        if (!file) return next();
        res.setHeader('Content-Type', file().endsWith('.js') ? 'text/javascript' : 'application/octet-stream');
        res.end(readFileSync(file()));
      });
    },
    generateBundle() {
      for (const [name, file] of Object.entries(files)) this.emitFile({type: 'asset', fileName: `ocr/${name}`, source: readFileSync(file())});
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), serviceWorker(), ocrFiles()],
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
