import { Link } from 'react-router-dom'
import { Sparkles, Mic, Users, Package, RefreshCw, ArrowRight, Check } from 'lucide-react'

const FLOWS = [
  {
    icon: <Users size={22} />,
    title: 'Cadastre e migre alunos',
    desc: 'Jogue uma planilha, PDF ou print da sua lista de alunos no ChatGPT. Ele organiza tudo e você importa de uma vez — sem digitar aluno por aluno.',
  },
  {
    icon: <Package size={22} />,
    title: 'Monte treinos completos',
    desc: 'Peça um ABC, ABCDE ou um treino específico. A IA gera exercícios, séries, repetições, cargas e intervalos prontos para aplicar nos seus alunos.',
  },
  {
    icon: <RefreshCw size={22} />,
    title: 'Ajuste o treino de um aluno',
    desc: '"Aumenta o volume de pernas", "troca o supino por máquina", "adapta pra dor no ombro". Descreva o ajuste e a IA reescreve o treino inteiro.',
  },
]

const CHAT = [
  { from: 'user', text: 'Monta um ABCDE de hipertrofia pra academia completa, evitando sobrecarga no bíceps esquerdo (tendinite).' },
  { from: 'ai', text: 'Pronto! Gerei o pacote ABCDE com 33 exercícios, ajustando pegadas e usando máquinas onde o bíceps esquerdo seria exigido. É só copiar o JSON e importar. 💪' },
  { from: 'user', text: 'Manda o JSON.' },
]

export default function IaOperacaoSection() {
  return (
    <section id="ia" style={{
      background: 'linear-gradient(160deg, #0f172a 0%, #0a0e1a 50%, #060a14 100%)',
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
        position: 'absolute', top: '10%', right: '0%',
        width: 460, height: 460, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)',
        filter: 'blur(40px)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '0%', left: '0%',
        width: 400, height: 400, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(20,184,166,0.1) 0%, transparent 70%)',
        filter: 'blur(40px)', pointerEvents: 'none',
      }} />

      <div style={{ maxWidth: 1280, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(20,184,166,0.12)', border: '1px solid rgba(20,184,166,0.3)',
            borderRadius: 20, padding: '6px 14px', marginBottom: 18,
          }}>
            <Sparkles size={14} color="#14b8a6" />
            <span style={{ color: '#14b8a6', fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Operação com IA · incluído e grátis</span>
          </div>

          <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: 'clamp(28px, 4.5vw, 48px)', fontWeight: 800, color: '#fff', lineHeight: 1.15, letterSpacing: '-1px', marginBottom: 18, maxWidth: 860, margin: '0 auto 18px' }}>
            Pare de digitar série a série.{' '}
            <span style={{ background: 'linear-gradient(135deg, #14b8a6, #10b981)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Converse com a IA — ela cadastra por você.
            </span>
          </h2>

          <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, maxWidth: 680, margin: '0 auto' }}>
            O maior gargalo do personal é o trabalho braçal: montar e digitar o treino de cada aluno,
            exercício por exercício. O CoachPilot resolve isso por <strong style={{ color: 'rgba(255,255,255,0.9)' }}>linguagem
            natural</strong> — você conversa, por <strong style={{ color: 'rgba(255,255,255,0.9)' }}>texto ou voz</strong>,
            com o <strong style={{ color: 'rgba(255,255,255,0.9)' }}>seu próprio ChatGPT, Claude ou Gemini</strong>,
            ele entende o CoachPilot e devolve tudo pronto para importar com 1 clique.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 48, alignItems: 'center', marginBottom: 56 }}>
          {/* Mock de conversa */}
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(20,184,166,0.2)',
            borderRadius: 20,
            padding: 22,
            backdropFilter: 'blur(10px)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #14b8a6, #10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Sparkles size={18} color="#fff" />
              </div>
              <div>
                <div style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>ChatGPT + CoachPilot</div>
                <div style={{ color: '#14b8a6', fontSize: 12 }}>● por texto ou voz</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {CHAT.map((m, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: m.from === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '85%',
                    background: m.from === 'user' ? 'linear-gradient(135deg, #14b8a6, #10b981)' : 'rgba(255,255,255,0.06)',
                    color: m.from === 'user' ? '#fff' : 'rgba(255,255,255,0.85)',
                    border: m.from === 'user' ? 'none' : '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 14,
                    borderBottomRightRadius: m.from === 'user' ? 4 : 14,
                    borderBottomLeftRadius: m.from === 'ai' ? 4 : 14,
                    padding: '10px 14px',
                    fontSize: 13.5,
                    lineHeight: 1.55,
                  }}>
                    {m.text}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '10px 12px' }}>
              <Mic size={16} color="#14b8a6" />
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, flex: 1 }}>Fale ou digite seu pedido…</span>
              <div style={{ background: 'rgba(20,184,166,0.15)', borderRadius: 8, padding: '4px 10px', color: '#14b8a6', fontSize: 12, fontWeight: 700 }}>Importar ✓</div>
            </div>
          </div>

          {/* 3 fluxos */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {FLOWS.map((f, i) => (
              <div key={i} style={{
                display: 'flex', gap: 16, alignItems: 'flex-start',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 16,
                padding: 20,
              }}>
                <div style={{ width: 46, height: 46, borderRadius: 12, background: 'rgba(20,184,166,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#14b8a6', flexShrink: 0 }}>
                  {f.icon}
                </div>
                <div>
                  <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{f.title}</h3>
                  <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 1.6 }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Faixa de credibilidade + CTA */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 20,
          alignItems: 'center', justifyContent: 'center',
          background: 'rgba(20,184,166,0.06)',
          border: '1px solid rgba(20,184,166,0.2)',
          borderRadius: 16,
          padding: '24px 28px',
        }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, flex: 1, minWidth: 280 }}>
            {[
              'Funciona com ChatGPT, Claude, Gemini ou qualquer IA',
              'Você revisa tudo antes de importar',
              'Sem custo extra — use a IA que você já tem',
            ].map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.7)' }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(20,184,166,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Check size={12} color="#14b8a6" strokeWidth={2.5} />
                </div>
                <span style={{ fontSize: 13.5, fontWeight: 500 }}>{t}</span>
              </div>
            ))}
          </div>
          <Link
            to="/signup"
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
            Começar grátis agora <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </section>
  )
}
