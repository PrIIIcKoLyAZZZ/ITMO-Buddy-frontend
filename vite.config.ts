import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import tailwind from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ command, mode, isPreview }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const https = command === 'serve' && !isPreview
    ? {
        cert: readFileSync(env.DEV_TLS_CERT || '.cert/localhost.pem'),
        key: readFileSync(env.DEV_TLS_KEY || '.cert/localhost-key.pem'),
      }
    : undefined

  return {
    plugins: [react(), tailwind()],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    server: { host: 'localhost', port: 5173, strictPort: true, https },
  }
})
