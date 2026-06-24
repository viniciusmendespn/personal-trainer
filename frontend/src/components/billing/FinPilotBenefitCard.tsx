import { ArrowUpRight } from 'lucide-react'

const FEATURES = [
  { icon: '📊', label: 'Planilha inteligente', desc: 'Edição inline igual ao Excel — sem fórmulas para manter' },
  { icon: '🤖', label: 'IA em português', desc: '"Adicione R$ 200 de supermercado em março" e pronto' },
  { icon: '📅', label: 'Visão anual completa', desc: 'Gráfico de saldo nos 12 meses, com filtro por conta' },
  { icon: '💳', label: 'Controle de cartões', desc: 'Gastos no cartão já impactam o saldo da conta automaticamente' },
  { icon: '📱', label: 'Instala no celular', desc: 'PWA — funciona como app nativo, sem loja de apps' },
  { icon: '🔒', label: 'Sem acesso ao banco', desc: 'Você lança o que quer. Total privacidade e controle.' },
]

export function FinPilotBenefitCard() {
  return (
    <div data-theme="dark" style={{
      background: 'linear-gradient(160deg, #071a10 0%, #030d07 60%, #020617 100%)',
      border: '1px solid rgba(74, 222, 128, 0.18)',
      borderRadius: 16,
      padding: '24px',
      position: 'relative',
      overflow: 'hidden',
      boxShadow: '0 8px 32px -8px rgb(0 0 0 / 0.35)',
    }}>
      {/* glow decorativo */}
      <div style={{
        position: 'absolute', top: -80, right: -80,
        width: 240, height: 240, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(22,163,74,0.18) 0%, transparent 70%)',
        filter: 'blur(30px)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: -60, left: -60,
        width: 180, height: 180, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(74,222,128,0.08) 0%, transparent 70%)',
        filter: 'blur(25px)', pointerEvents: 'none',
      }} />

      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, position: 'relative' }}>
        <img
          src="https://djkvxxf33pska.cloudfront.net/pwa-64x64.png"
          alt="FinPilot"
          style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0 }}
        />
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 16 }}>FinPilot</span>
            <span style={{
              background: 'linear-gradient(135deg, #4ade80, #16a34a)',
              color: '#fff', fontSize: 10, fontWeight: 700,
              padding: '2px 8px', borderRadius: 20,
              textTransform: 'uppercase', letterSpacing: 0.5,
            }}>Benefício exclusivo</span>
          </div>
          <p style={{ color: '#94a3b8', fontSize: 12, marginTop: 1 }}>
            Planilha inteligente com IA para controle financeiro pessoal
          </p>
        </div>
      </div>

      {/* pitch */}
      <div style={{
        background: 'rgba(74, 222, 128, 0.07)',
        border: '1px solid rgba(74, 222, 128, 0.15)',
        borderRadius: 10,
        padding: '12px 14px',
        marginBottom: 20,
        position: 'relative',
      }}>
        <p style={{ color: '#e2e8f0', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
          <span style={{ color: '#4ade80', fontWeight: 600 }}>A cada mês pago no Gestão Pro</span>
          {' '}você recebe automaticamente um código para{' '}
          <span style={{ color: '#4ade80', fontWeight: 600 }}>1 mês grátis no FinPilot</span>
          {' '}— um gerenciador financeiro pessoal com planilha digital e IA que entende português.
          Os códigos ficam disponíveis no histórico de pagamentos abaixo.
        </p>
      </div>

      {/* features */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
        {FEATURES.map((f) => (
          <div key={f.label} style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 10, padding: '10px 12px',
          }}>
            <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0, marginTop: 1 }}>{f.icon}</span>
            <div>
              <p style={{ color: '#f1f5f9', fontSize: 12, fontWeight: 600, margin: 0 }}>{f.label}</p>
              <p style={{ color: '#64748b', fontSize: 11, margin: '2px 0 0', lineHeight: 1.4 }}>{f.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <a
        href="https://finpilot.ia.br"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'linear-gradient(135deg, #4ade80, #16a34a)',
          color: '#fff', fontWeight: 700, fontSize: 14,
          padding: '10px 20px', borderRadius: 8,
          textDecoration: 'none',
          boxShadow: '0 4px 16px rgba(22,163,74,0.35)',
          transition: 'opacity 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
      >
        Conhecer o FinPilot
        <ArrowUpRight size={15} />
      </a>
      <p style={{ color: '#475569', fontSize: 11, marginTop: 8, marginBottom: 0 }}>
        Use o código do histórico abaixo para ativar 1 mês grátis.
      </p>
    </div>
  )
}
