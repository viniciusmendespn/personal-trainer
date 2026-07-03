import { Link } from 'react-router-dom'
import { Store, Package, Zap, HandCoins, ArrowRight, Star, Dumbbell } from 'lucide-react'

const BULLETS = [
  {
    icon: <Package size={22} />,
    title: 'Pacotes completos, instalação em 1 clique',
    desc: 'Rotinas, treinos e exercícios prontos, criados por outros personais. Comprou, instalou — já aparece na sua conta CoachPilot para aplicar nos alunos.',
  },
  {
    icon: <Zap size={22} />,
    title: 'PIX com liberação imediata',
    desc: 'Pagamento via PIX e o pacote é liberado na hora, sem esperar aprovação manual. QR code, copia-e-cola e pronto.',
  },
  {
    icon: <HandCoins size={22} />,
    title: 'Venda seu método e crie renda extra',
    desc: 'Seu método de treino vira produto: publique na loja e venda para personais do Brasil inteiro, sem sair do CoachPilot.',
  },
]

/* Mock estático de um anúncio da loja — mesma linguagem visual dos cards reais */
function MockAnuncioCard() {
  return (
    <div style={{ position: 'relative', maxWidth: 380, margin: '0 auto', width: '100%' }}>
      {/* card de trás (profundidade) */}
      <div style={{
        position: 'absolute', inset: 0, transform: 'rotate(3deg) translate(10px, 10px)',
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 20,
      }} />
      <div style={{
        position: 'relative',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(20,184,166,0.25)',
        borderRadius: 20,
        overflow: 'hidden',
        backdropFilter: 'blur(10px)',
        boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
      }}>
        <div style={{
          aspectRatio: '16 / 9',
          background: 'linear-gradient(135deg, rgba(20,184,166,0.35), rgba(16,185,129,0.15))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Dumbbell size={44} color="rgba(255,255,255,0.85)" />
        </div>
        <div style={{ padding: '18px 20px 20px' }}>
          <div style={{ color: '#fff', fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 17, marginBottom: 4 }}>
            Hipertrofia ABCDE — 12 semanas
          </div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 10 }}>por Personal verificado no CoachPilot</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
            {[...Array(5)].map((_, i) => (
              <Star key={i} size={14} fill="#f59e0b" color="#f59e0b" />
            ))}
            <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12.5 }}>5,0 · 40 treinos · 180 exercícios</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: '#2dd4bf', fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: 22 }}>R$ 79,90</span>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'linear-gradient(135deg, #14b8a6, #10b981)',
              color: '#fff', fontWeight: 700, fontSize: 13,
              padding: '8px 14px', borderRadius: 10,
            }}>
              <Zap size={14} /> Comprar com PIX
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LojaSection() {
  return (
    <section id="loja" style={{
      background: 'linear-gradient(160deg, #060a14 0%, #0a0e1a 55%, #0f172a 100%)',
      padding: '88px 24px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* padrão pontilhado + glows (mesma linguagem do hero) */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.12,
        backgroundImage: 'radial-gradient(rgba(20,184,166,0.6) 1px, transparent 1px)',
        backgroundSize: '30px 30px',
      }} />
      <div style={{
        position: 'absolute', top: '5%', left: '0%',
        width: 420, height: 420, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(20,184,166,0.12) 0%, transparent 70%)',
        filter: 'blur(40px)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '0%', right: '0%',
        width: 460, height: 460, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 70%)',
        filter: 'blur(40px)', pointerEvents: 'none',
      }} />

      <div style={{ maxWidth: 1280, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(20,184,166,0.12)', border: '1px solid rgba(20,184,166,0.3)',
            borderRadius: 20, padding: '6px 14px', marginBottom: 18,
          }}>
            <Store size={14} color="#14b8a6" />
            <span style={{ color: '#14b8a6', fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Loja CoachPilot · Marketplace de treinos</span>
          </div>

          <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: 'clamp(28px, 4.5vw, 48px)', fontWeight: 800, color: '#fff', lineHeight: 1.15, letterSpacing: '-1px', maxWidth: 860, margin: '0 auto 18px' }}>
            Compre métodos prontos.{' '}
            <span style={{ background: 'linear-gradient(135deg, #14b8a6, #10b981)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Ou venda os seus.
            </span>
          </h2>

          <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, maxWidth: 680, margin: '0 auto' }}>
            A Loja CoachPilot é o marketplace onde personais compram e vendem pacotes de treino
            completos — <strong style={{ color: 'rgba(255,255,255,0.9)' }}>rotinas, treinos e exercícios</strong> criados
            por quem vive a área. Pagou com PIX, instalou na conta, aplicou nos alunos.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 48, alignItems: 'center', marginBottom: 56 }}>
          {/* 3 destaques */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {BULLETS.map((b, i) => (
              <div key={i} style={{
                display: 'flex', gap: 16, alignItems: 'flex-start',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 16,
                padding: 20,
              }}>
                <div style={{ width: 46, height: 46, borderRadius: 12, background: 'rgba(20,184,166,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#14b8a6', flexShrink: 0 }}>
                  {b.icon}
                </div>
                <div>
                  <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{b.title}</h3>
                  <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 1.6 }}>{b.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <MockAnuncioCard />
        </div>

        {/* CTAs */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'center' }}>
          <a
            href="https://loja.coachpilot.com.br"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'linear-gradient(135deg, #14b8a6, #10b981)',
              color: '#fff', fontWeight: 700, fontSize: 15, textDecoration: 'none',
              padding: '13px 26px', borderRadius: 12,
              boxShadow: '0 8px 25px rgba(20,184,166,0.35)',
              whiteSpace: 'nowrap',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 30px rgba(20,184,166,0.45)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 8px 25px rgba(20,184,166,0.35)' }}
          >
            Explorar a loja <ArrowRight size={18} />
          </a>
          <Link
            to="/loja-vendas"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'transparent',
              border: '1px solid rgba(20,184,166,0.4)',
              color: '#2dd4bf', fontWeight: 600, fontSize: 15, textDecoration: 'none',
              padding: '12px 24px', borderRadius: 12,
              whiteSpace: 'nowrap',
              transition: 'background 0.2s, border-color 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(20,184,166,0.08)'; e.currentTarget.style.borderColor = 'rgba(20,184,166,0.7)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(20,184,166,0.4)' }}
          >
            Quero vender meu método
          </Link>
        </div>
      </div>
    </section>
  )
}
