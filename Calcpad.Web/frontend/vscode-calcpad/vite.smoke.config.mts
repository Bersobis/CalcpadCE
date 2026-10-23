import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

// Dev-only harness build: compiles the real Live math panel against the real frontend sources.
export default defineConfig({
  plugins: [vue()],
  root: resolve(__dirname, 'smoke'),
  logLevel: 'warn',
  build: {
    outDir: resolve(__dirname, 'smoke-dist'),
    emptyOutDir: true,
    target: 'es2022',
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('development'),
  },
})
