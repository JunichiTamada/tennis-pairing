import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'        // or '@vitejs/plugin-react-swc'
import tailwind from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  base: process.env.BASE_PATH || '/',           // CIで --base を渡すので '/' でOK
  plugins: [react(), tailwind()],               // ★ v4 ではこれで十分
  resolve: { alias: { '@': resolve(__dirname, 'src') } }
})
