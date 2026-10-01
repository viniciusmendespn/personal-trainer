import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  publicDir: false,
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  plugins: [react(), {
    name: 'coachpilot-inline-resource',
    generateBundle(_options, bundle) {
      const js = Object.values(bundle).filter(x => x.type === 'chunk').map(x => x.type === 'chunk' ? x.code : '').join('\n')
      const css = Object.values(bundle).filter(x => x.type === 'asset' && x.fileName.endsWith('.css')).map(x => x.type === 'asset' ? String(x.source) : '').join('\n')
      for (const key of Object.keys(bundle)) delete bundle[key]
      this.emitFile({ type: 'asset', fileName: 'v1.html', source: `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CoachPilot</title><style>${css.replaceAll('</style', '<\\/style')}</style></head><body><div id="root"></div><script type="module">${js.replaceAll('</script', '<\\/script')}</script></body></html>` })
    },
  }],
  build: {
    outDir: resolve(__dirname, '../backend/app/mcp/ui_dist'), emptyOutDir: false,
    lib: { entry: resolve(__dirname, 'src/mcp-app/main.tsx'), name: 'CoachPilotUI', formats: ['iife'] },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
})
