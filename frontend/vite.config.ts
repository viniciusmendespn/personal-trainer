import { resolve } from 'path'
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
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      manifest: false,
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        navigateFallback: null,
        runtimeCaching: [{ urlPattern: /\/v1\//, handler: 'NetworkOnly' }],
      },
      // Manifesto vazio: sem precache. Assets servidos pelo CloudFront.
      // Precaching ~82 entradas travava o install do SW em redes móveis lentas.
      injectManifest: {
        globPatterns: [],
      },
    }),
  ],
  build: {
    rollupOptions: {
      input: {
        main:  resolve(__dirname, 'index.html'),
        aluno: resolve(__dirname, 'aluno.html'),
      },
    },
  },
  server: {
    port: 5174,
    proxy: {
      '/v1': { target: 'https://arrrexx5qh.execute-api.us-east-1.amazonaws.com/prod', changeOrigin: true },
    },
  },
})
