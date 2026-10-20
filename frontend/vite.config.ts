import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { cartoKeyDefine } from './config/carto-env.mjs'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  define: cartoKeyDefine(
    loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), ''),
    new URL('../.runtime/carto-env.key', import.meta.url),
  ),
  server: { proxy: { "/api": "http://127.0.0.1:8000" } },
}))
