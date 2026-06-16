import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Em produção o app é servido pelo CloudFront, que tem behavior /v1/* -> API (mesma origem,
// sem CORS). Por isso VITE_API_URL fica vazio (caminho relativo). No dev, este proxy
// encaminha /v1 para a API real.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
    proxy: {
      '/v1': {
        target: 'https://arrrexx5qh.execute-api.us-east-1.amazonaws.com/prod',
        changeOrigin: true,
      },
    },
  },
})
