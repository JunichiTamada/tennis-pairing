// vite.config.ts
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig(({ mode }) => {
  // .env / .env.[mode] も読み込めるように
  const env = loadEnv(mode, process.cwd(), '')
  // VITE_BASE_PATH があればそれを使い、なければ通常の /tennis-pairing/ を使う
  // 末尾スラッシュを必ず付ける
  const rawBase = env.VITE_BASE_PATH ?? '/tennis-pairing/'
  const base = rawBase.endsWith('/') ? rawBase : `${rawBase}/`

  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
    base,
  }
})
