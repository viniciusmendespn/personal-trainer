import { Link } from 'react-router-dom'
import { Check, X, MessageCircle, Sparkles } from 'lucide-react'

const FREE_INCLUDES = [
  'Até 3 alunos cadastrados',
  'Treinos e templates',
  'Avaliações físicas',
  'Agenda',
  'App do aluno (PWA)',
  'Chat interno',
  'Dashboard',
  'Perfil público do personal',
  'Sem fidelidade',
]

const FREE_EXCLUDES = [
  'Canal WhatsApp',
  'Assistente IA',
  'Add-ons pagos',
]

const PRO_INCLUDES = [
  'Alunos ilimitados',
  'Treinos e templates ilimitados',
  'Avaliações físicas com evolução',
  'Agenda',
  'App do aluno (PWA)',
  'Chat interno',
  'Dashboard completo',
  'Perfil público do personal',
  'Relatórios',
  'Suporte',
  'Sem fidelidade',
]

const COMPARE_ROWS: { feature: string; free: string; pro: string }[] = [
  { feature: 'Alunos cadastrados', free: 'Até 3', pro: 'Ilimitado' },
  { feature: 'Treinos e templates', free: 'Sim', pro: 'Sim' },
  { feature: 'Avaliações físicas', free: 'Sim', pro: 'Sim' },
  { feature: 'Agenda', free: 'Sim', pro: 'Sim' },
  { feature: 'App do aluno', free: 'Sim', pro: 'Sim' },
  { feature: 'Chat interno', free: 'Sim', pro: 'Sim' },
  { feature: 'Dashboard', free: 'Sim', pro: 'Sim' },
  { feature: 'Perfil público', free: 'Sim', pro: 'Sim' },
  { feature: 'Canal WhatsApp', free: 'Add-on', pro: 'Add-on' },
  { feature: 'Assistente IA', free: 'Add-on', pro: 'Add-on' },
  { feature: 'Preço', free: 'R$0', pro: 'R$39,90/mês' },
]

export default function PricingSection() {
  return (
    <section id="pricing" style={{ background: '#fff', padding: '80px 24px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{
            display: 'inline-block',
            background: 'rgba(20,184,166,0.12)',
            border: '1px solid rgba(20,184,166,0.3)',
            borderRadius: 20, padding: '5px 14px', marginBottom: 16,
          }}>
            <span style={{ color: '#0d9488', fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Planos e Preços</span>
          </div>
          <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px', marginBottom: 12 }}>
            Planos simples para crescer{' '}
            <span style={{ background: 'linear-gradient(135deg, #14b8a6, #10b981)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              junto com você
            </span>
          </h2>
          <p style={{ color: '#475569', fontSize: 16, maxWidth: 520, margin: '0 auto 8px' }}>
            Comece grátis com até 3 alunos. Quando precisar de mais, desbloqueie alunos ilimitados por apenas R$39,90/mês.
          </p>
          <p style={{ color: '#64748b', fontSize: 14, maxWidth: 480, margin: '0 auto' }}>
            O CoachPilot separa gestão, WhatsApp e IA para você pagar apenas pelo que realmente usa.
          </p>
        </div>

        {/* Cards dos planos */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24, marginBottom: 48, maxWidth: 780, margin: '0 auto 48px' }}>
          {/* Card Grátis */}
          <div style={{
            background: '#f8fafc',
            border: '1.5px solid #e2e8f0',
            borderRadius: 20,
            padding: 32,
            display: 'flex',
            flexDirection: 'column',
          }}>
            <div style={{ marginBottom: 24 }}>
              <div style={{ color: '#64748b', fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Grátis</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, marginBottom: 6 }}>
                <span style={{ color: '#0f172a', fontSize: 48, fontWeight: 800, lineHeight: 1, letterSpacing: '-2px' }}>R$0</span>
                <span style={{ color: '#94a3b8', fontSize: 14, marginBottom: 6 }}>/mês</span>
              </div>
              <p style={{ color: '#64748b', fontSize: 14, lineHeight: 1.5 }}>Para começar a organizar seus primeiros alunos sem pagar nada.</p>
            </div>

            <div style={{ flex: 1, marginBottom: 24 }}>
              <div style={{ color: '#0f172a', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Inclui</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                {FREE_INCLUDES.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(20,184,166,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Check size={12} color="#14b8a6" strokeWidth={2.5} />
                    </div>
                    <span style={{ color: '#475569', fontSize: 14 }}>{f}</span>
                  </div>
                ))}
              </div>
              <div style={{ color: '#0f172a', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Não inclui</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {FREE_EXCLUDES.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(239,68,68,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <X size={12} color="#ef4444" strokeWidth={2.5} />
                    </div>
                    <span style={{ color: '#94a3b8', fontSize: 14 }}>{f}</span>
                  </div>
                ))}
              </div>
            </div>

            <Link
              to="/signup"
              style={{
                display: 'block', textAlign: 'center',
                background: '#f1f5f9',
                border: '1.5px solid #e2e8f0',
                color: '#0f172a', fontWeight: 600, fontSize: 15, textDecoration: 'none',
                padding: '14px', borderRadius: 10,
                transition: 'background 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#e2e8f0')}
              onMouseLeave={e => (e.currentTarget.style.background = '#f1f5f9')}
            >
              Começar grátis
            </Link>
            <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: 12, marginTop: 10 }}>
              Ideal para testar o CoachPilot com alunos reais.
            </p>
          </div>

          {/* Card Gestão Pro */}
          <div style={{
            background: 'linear-gradient(160deg, #0f172a 0%, #060a14 100%)',
            borderRadius: 20,
            padding: 32,
            border: '1.5px solid rgba(20,184,166,0.3)',
            boxShadow: '0 20px 60px rgba(20,184,166,0.15)',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', top: -60, right: -60,
              width: 200, height: 200, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(20,184,166,0.15) 0%, transparent 70%)',
              filter: 'blur(20px)',
            }} />
            <div style={{
              position: 'absolute', top: 16, right: 16,
              background: 'linear-gradient(135deg, #14b8a6, #10b981)',
              borderRadius: 20, padding: '4px 12px',
            }}>
              <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>Mais indicado</span>
            </div>

            <div style={{ marginBottom: 24, position: 'relative' }}>
              <div style={{ color: '#14b8a6', fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Gestão Pro</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, marginBottom: 6 }}>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 18, marginBottom: 6 }}>R$</span>
                <span style={{ color: '#fff', fontSize: 48, fontWeight: 800, lineHeight: 1, letterSpacing: '-2px' }}>39</span>
                <div style={{ marginBottom: 6 }}>
                  <span style={{ color: '#fff', fontSize: 22, fontWeight: 800 }}>,90</span>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>/mês</div>
                </div>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, lineHeight: 1.5 }}>Para personal trainers que querem gerenciar todos os alunos profissionalmente.</p>
            </div>

            <div style={{ flex: 1, marginBottom: 24, position: 'relative' }}>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Inclui</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {PRO_INCLUDES.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(20,184,166,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Check size={12} color="#14b8a6" strokeWidth={2.5} />
                    </div>
                    <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14 }}>{f}</span>
                  </div>
                ))}
              </div>
            </div>

            <Link
              to="/signup"
              style={{
                display: 'block', textAlign: 'center',
                background: 'linear-gradient(135deg, #14b8a6, #10b981)',
                color: '#fff', fontWeight: 700, fontSize: 15, textDecoration: 'none',
                padding: '14px', borderRadius: 10,
                boxShadow: '0 8px 24px rgba(20,184,166,0.35)',
                transition: 'transform 0.2s, box-shadow 0.2s',
                position: 'relative',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 30px rgba(20,184,166,0.45)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(20,184,166,0.35)' }}
            >
              Assinar Gestão Pro
            </Link>
            <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 10 }}>
              Cancele quando quiser.
            </p>
          </div>
        </div>

        {/* Bloco Add-ons */}
        <div style={{
          background: '#f0fdfa',
          border: '1px solid rgba(20,184,166,0.2)',
          borderRadius: 20,
          padding: '40px 32px',
          marginBottom: 56,
        }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <h3 style={{ fontFamily: "'Sora', sans-serif", fontSize: 'clamp(20px, 3vw, 28px)', fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>
              Add-ons opcionais
            </h3>
            <p style={{ color: '#475569', fontSize: 15 }}>
              Comece apenas com a gestão. Ative WhatsApp e IA somente quando fizer sentido para seus alunos.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20, maxWidth: 700, margin: '0 auto' }}>
            {/* Canal WhatsApp */}
            <div style={{ background: '#fff', border: '1.5px solid rgba(20,184,166,0.2)', borderRadius: 16, padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(20,184,166,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <MessageCircle size={22} color="#14b8a6" />
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 15 }}>Canal WhatsApp</div>
                  <div style={{ color: '#14b8a6', fontWeight: 700, fontSize: 14 }}>+R$29,90/mês</div>
                </div>
              </div>
              <p style={{ color: '#475569', fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>
                Conecte um número de WhatsApp para facilitar a comunicação com seus alunos.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {['Conexão com WhatsApp', 'Comunicação com alunos pelo canal', 'Base para uso do assistente via WhatsApp'].map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Check size={12} color="#14b8a6" strokeWidth={2.5} />
                    <span style={{ color: '#64748b', fontSize: 13 }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Assistente IA */}
            <div style={{ background: '#fff', border: '1.5px solid rgba(20,184,166,0.2)', borderRadius: 16, padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Sparkles size={22} color="#10b981" />
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 15 }}>Assistente IA</div>
                  <div style={{ color: '#10b981', fontWeight: 700, fontSize: 14 }}>+R$4,90/aluno/mês</div>
                </div>
              </div>
              <p style={{ color: '#475569', fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>
                Habilite o assistente para alunos selecionados. Você só paga pela IA dos alunos em que quiser ativar.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {['Habilitado por aluno', 'Uso pelo chat interno', 'Uso via WhatsApp (se o canal estiver ativo)', 'Registro com contexto de treino e exercício'].map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Check size={12} color="#10b981" strokeWidth={2.5} />
                    <span style={{ color: '#64748b', fontSize: 13 }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Seção FinPilot */}
        <div style={{
          background: 'linear-gradient(160deg, #071a10 0%, #030d07 55%, #020617 100%)',
          border: '1px solid rgba(74, 222, 128, 0.2)',
          borderRadius: 20,
          padding: 'clamp(28px, 4vw, 48px)',
          marginBottom: 56,
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* glows */}
          <div style={{ position: 'absolute', top: -100, right: -100, width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(22,163,74,0.15) 0%, transparent 70%)', filter: 'blur(40px)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: -80, left: -80, width: 250, height: 250, borderRadius: '50%', background: 'radial-gradient(circle, rgba(74,222,128,0.07) 0%, transparent 70%)', filter: 'blur(30px)', pointerEvents: 'none' }} />

          {/* header */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16, marginBottom: 24, position: 'relative' }}>
            <img src="https://djkvxxf33pska.cloudfront.net/pwa-64x64.png" alt="FinPilot" style={{ width: 52, height: 52, borderRadius: 12 }} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ color: '#f1f5f9', fontFamily: "'Poppins', sans-serif", fontWeight: 800, fontSize: 'clamp(18px, 3vw, 24px)' }}>FinPilot</span>
                <span style={{ background: 'linear-gradient(135deg, #4ade80, #16a34a)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Bônus Gestão Pro
                </span>
              </div>
              <p style={{ color: '#64748b', fontSize: 14, margin: '2px 0 0' }}>
                Planilha inteligente com IA para controle financeiro pessoal
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 32, alignItems: 'center', position: 'relative' }}>
            {/* texto esquerda */}
            <div>
              <h3 style={{ fontFamily: "'Poppins', sans-serif", fontSize: 'clamp(18px, 2.5vw, 26px)', fontWeight: 800, color: '#f1f5f9', lineHeight: 1.3, marginBottom: 12 }}>
                A cada mês pago no Gestão Pro,<br />
                <span style={{ background: 'linear-gradient(135deg, #4ade80, #16a34a)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  1 mês grátis no FinPilot.
                </span>
              </h3>
              <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.7, marginBottom: 20 }}>
                Assine o Gestão Pro e receba automaticamente um código promocional após cada pagamento confirmado. Gerencie suas finanças pessoais com a praticidade de uma planilha e o poder de uma IA em português.
              </p>
              <a
                href="https://finpilot.ia.br"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: 'linear-gradient(135deg, #4ade80, #16a34a)',
                  color: '#fff', fontWeight: 700, fontSize: 14,
                  padding: '11px 22px', borderRadius: 8,
                  textDecoration: 'none',
                  boxShadow: '0 4px 20px rgba(22,163,74,0.35)',
                }}
              >
                Conhecer o FinPilot
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M7 17L17 7M17 7H7M17 7v10"/></svg>
              </a>
            </div>

            {/* features direita */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { icon: '📊', label: 'Planilha digital', desc: 'Edição inline igual ao Excel — sem fórmulas' },
                { icon: '🤖', label: 'IA em português', desc: '"Adicione R$ 200 de mercado em março"' },
                { icon: '📅', label: 'Visão anual', desc: 'Gráfico de saldo nos 12 meses' },
                { icon: '💳', label: 'Controle de cartões', desc: 'Gastos integrados à conta' },
                { icon: '⏱️', label: 'Checkpoints', desc: 'Restaure qualquer estado financeiro' },
                { icon: '📱', label: 'App no celular', desc: 'PWA — instala sem loja de apps' },
              ].map((f) => (
                <div key={f.label} style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 10, padding: '10px 12px',
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                }}>
                  <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0, marginTop: 1 }}>{f.icon}</span>
                  <div>
                    <p style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 600, margin: 0 }}>{f.label}</p>
                    <p style={{ color: '#475569', fontSize: 11, margin: '2px 0 0', lineHeight: 1.4 }}>{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tabela comparativa */}
        <div style={{ maxWidth: 780, margin: '0 auto' }}>
          <h3 style={{ fontFamily: "'Sora', sans-serif", fontSize: 22, fontWeight: 800, color: '#0f172a', textAlign: 'center', marginBottom: 24 }}>
            Comparativo dos planos
          </h3>
          <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.06)', border: '1px solid rgba(20,184,166,0.15)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 140px' }}>
              <div style={{ padding: '14px 20px', background: '#f8fefd', borderBottom: '2px solid rgba(20,184,166,0.15)' }}>
                <span style={{ color: '#475569', fontSize: 13, fontWeight: 600 }}>Recurso</span>
              </div>
              <div style={{ padding: '14px 20px', background: '#f8fefd', borderBottom: '2px solid rgba(20,184,166,0.15)', textAlign: 'center' }}>
                <span style={{ color: '#64748b', fontSize: 13, fontWeight: 600 }}>Grátis</span>
              </div>
              <div style={{ padding: '14px 20px', background: 'linear-gradient(135deg, #14b8a6, #10b981)', borderBottom: '2px solid rgba(20,184,166,0.15)', textAlign: 'center' }}>
                <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>Gestão Pro</span>
              </div>
            </div>
            {COMPARE_ROWS.map((r, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 140px', background: i % 2 === 0 ? '#fff' : '#f8fefd', borderBottom: i < COMPARE_ROWS.length - 1 ? '1px solid rgba(20,184,166,0.08)' : 'none' }}>
                <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center' }}>
                  <span style={{ color: '#1e293b', fontSize: 13 }}>{r.feature}</span>
                </div>
                <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: r.free === 'Add-on' ? '#f59e0b' : r.free === 'R$0' ? '#14b8a6' : '#475569', fontSize: 13, fontWeight: r.free === 'R$0' ? 700 : 400 }}>{r.free}</span>
                </div>
                <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: r.pro === 'Add-on' ? '#f59e0b' : r.pro === 'R$39,90/mês' ? '#14b8a6' : '#475569', fontSize: 13, fontWeight: r.pro === 'R$39,90/mês' ? 700 : 400 }}>{r.pro}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
