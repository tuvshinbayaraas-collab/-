import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {defineConfig, type Plugin} from 'vite';

/**
 * Writes /sw.js from src/service-worker.js, versioned by the build's file names so every deploy refreshes its cache,
 * and told which built files this version uses (so the ones that didn't change stay saved on the phone).
 */
function serviceWorker(): Plugin {
  return {
    name: 'batnab-service-worker',
    apply: 'build',
    generateBundle(_, bundle) {
      const version = createHash('sha256').update(Object.keys(bundle).sort().join('\n')).digest('hex').slice(0, 12);
      const files = Object.keys(bundle)
        .filter((f) => f.startsWith('assets/'))
        .map((f) => `/${f}`)
        .sort();
      const source = readFileSync(new URL('./src/service-worker.js', import.meta.url), 'utf8')
        .replace('__VERSION__', version)
        .replace("'__FILES__'", `'${JSON.stringify(files)}'`);
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

/** An oklch() colour as #rrggbb(aa), clipped to what sRGB can show. */
function oklchToHex(value: string) {
  // Each part a number, a percentage or `none` (as 0: a grey has no hue).
  const m = value.match(/oklch\(\s*([\d.]+|none)(%?)\s+([\d.]+|none)(%?)\s+([\d.]+|none)(?:deg)?\s*(?:\/\s*([\d.]+|none)(%?))?\s*\)/);
  if (!m) return null;
  const num = (v: string) => (v === 'none' ? 0 : Number(v));
  const L = m[2] ? num(m[1]) / 100 : num(m[1]);
  const C = m[4] ? (num(m[3]) / 100) * 0.4 : num(m[3]);
  const h = (num(m[5]) * Math.PI) / 180;
  const alpha = m[6] === undefined ? 1 : m[7] ? num(m[6]) / 100 : num(m[6]);
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mid = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [4.0767416621 * l - 3.3077115913 * mid + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * mid - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * mid + 1.707614701 * s];
  const byte = (n: number) => Math.round(Math.min(1, Math.max(0, n)) * 255).toString(16).padStart(2, '0');
  const rgb = linear.map((c) => byte(c <= 0.0031308 ? 12.92 * c : 1.055 * Math.max(c, 0) ** (1 / 2.4) - 0.055)).join('');
  return `#${rgb}${alpha < 1 ? byte(alpha) : ''}`;
}

/**
 * Colours for phones whose browser can't read oklch() (Chrome before 111: Android 6 and Chrome left un-updated,
 * Samsung Internet before 22). Tailwind's colours are oklch() custom properties, which such a browser takes without a
 * word and then draws nothing with: the blue «Нэвтрэх» button with no blue, the cards with no card. So the same colours
 * in sRGB, for them alone (@supports not); a plain oklch() declaration gets an sRGB one before it.
 */
function oklchFallback(): Plugin {
  return {
    name: 'batnab-oklch-fallback',
    apply: 'build',
    enforce: 'post',
    generateBundle(_, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type !== 'asset' || !file.fileName.endsWith('.css') || typeof file.source !== 'string') continue;
        let css = file.source;
        const vars = new Map<string, string>();
        for (const block of css.matchAll(/:root,:host\{([^{}]*)\}/g))
          for (const [, name, value] of block[1].matchAll(/(--[\w-]+):(oklch\([^)]*\))/g)) {
            const hex = oklchToHex(value);
            if (hex) vars.set(name, hex);
          }
        css = css.replace(/([{;])([a-z-]+):(oklch\([^)]*\))/g, (all, at: string, prop: string, value: string) => {
          const hex = oklchToHex(value);
          return hex ? `${at}${prop}:${hex};${prop}:${value}` : all;
        });
        if (vars.size) css += `@supports not (color:oklch(0% 0 0)){:root,:host{${[...vars].map(([k, v]) => `${k}:${v}`).join(';')}}}`;
        file.source = css;
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), serviceWorker(), ocrFiles(), oklchFallback()],
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
