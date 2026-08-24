import { defineConfig } from 'vitest/config'

// Config próprio, separado do vite.config.ts: o módulo de cálculo é puro, não
// precisa do plugin react nem do VitePWA — e carregá-los só deixaria o teste lento.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
