import { lazy } from 'react'
import type { ComponentType } from 'react'
import type { WidgetKind } from '../publicSeoData.js'

// Cada entrada é só um stub de import dinâmico no bundle principal — o código do
// widget só é baixado quando a rota correspondente renderiza. PublicSeoPage é
// import estático em App.tsx, então sem isso os 5 widgets entrariam no chunk da landing.
//
// Record (e não Partial) de propósito: adicionar uma calculadora nova sem registrar
// o widget vira erro de compilação, não tela em branco em produção.
export const WIDGETS: Record<WidgetKind, ComponentType> = {
  '1rm': lazy(() => import('./OneRepMaxWidget').then((m) => ({ default: m.OneRepMaxWidget }))),
  dobras: lazy(() => import('./DobrasWidget').then((m) => ({ default: m.DobrasWidget }))),
  precificacao: lazy(() => import('./PrecificacaoWidget').then((m) => ({ default: m.PrecificacaoWidget }))),
  volume: lazy(() => import('./VolumeWidget').then((m) => ({ default: m.VolumeWidget }))),
  energia: lazy(() => import('./EnergiaWidget').then((m) => ({ default: m.EnergiaWidget }))),
}
