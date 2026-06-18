import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Produção: servido pelo CloudFront com behavior /v1/* -> API (mesma origem, sem CORS).
// VITE_API_URL vazio (caminho relativo). No dev, o proxy encaminha /v1 para a API.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['coach-icon.png'],
      manifest: {
        name: 'CoachPilot — Portal',
        short_name: 'CoachPilot',
        description: 'Portal de gestão para personal trainers',
        theme_color: '#0f172a',
        background_color: '#0a0e1a',
        display: 'standalone',
        start_url: '/dashboard',
        scope: '/',
        icons: [{ src: 'coach-icon.png', sizes: '138x135', type: 'image/png', purpose: 'any' }],
      },
      workbox: {
        navigateFallback: null,
        runtimeCaching: [{ urlPattern: /\/v1\//, handler: 'NetworkOnly' }],
      },
    }),
  ],
  server: {
    port: 5174,
    proxy: {
      '/v1': { target: 'https://arrrexx5qh.execute-api.us-east-1.amazonaws.com/prod', changeOrigin: true },
    },
  },
})
