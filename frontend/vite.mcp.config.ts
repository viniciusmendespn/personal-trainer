import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'

export default defineConfig({
  publicDir: false,
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  plugins: [react(), tailwindcss(), {
    name: 'coachpilot-inline-resource',
    // 'post': o CSS só entra no bundle no generateBundle do próprio Vite; antes disso sai <style> vazio.
    enforce: 'post',
    generateBundle(_options, bundle) {
      const js = Object.values(bundle).filter(x => x.type === 'chunk').map(x => x.type === 'chunk' ? x.code : '').join('\n')
      const css = Object.values(bundle).filter(x => x.type === 'asset' && x.fileName.endsWith('.css')).map(x => x.type === 'asset' ? (typeof x.source === 'string' ? x.source : new TextDecoder().decode(x.source)) : '').join('\n')
      if (!css.includes('--color-accent')) throw new Error('CSS da interface MCP não entrou no HTML')
      for (const key of Object.keys(bundle)) delete bundle[key]
      this.emitFile({ type: 'asset', fileName: 'v1.html', source: `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CoachPilot</title><style>${css.replaceAll('</style', '<\\/style')}</style></head><body><div id="root"></div><script type="module">${js.replaceAll('</script', '<\\/script')}</script></body></html>` })
    },
  }],
  build: {
    outDir: resolve(__dirname, '../backend/app/mcp/ui_dist'), emptyOutDir: false,
    // Fontes e ícone viram data URI: a CSP do widget não libera origem externa (nem Google Fonts).
    assetsInlineLimit: 200_000,
    lib: { entry: resolve(__dirname, 'src/mcp-app/main.tsx'), name: 'CoachPilotUI', formats: ['iife'] },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
})
