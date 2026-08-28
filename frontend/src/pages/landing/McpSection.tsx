import { Link } from 'react-router-dom'
import { Plug, ArrowRight, Check, FileSpreadsheet } from 'lucide-react'

const OUTRAS_IAS = [
  'Mesma conexão, mesmos dados, mesmo desfazer',
  'No Claude funciona até no plano grátis',
  'Endereço em Configurações → Conexões',
]

const SEM_CONECTAR = [
  'Prompts prontos para treino e migração de carteira',
  'A IA devolve o pacote e você importa com 1 clique',
  'Serve para planilha, PDF ou print da sua lista de alunos',
]

export default function McpSection() {
  return (
    <section id="mcp" style={{
      background: 'linear-gradient(160deg, #0f172a 0%, #0a0e1a 55%, #060a14 100%)',
      padding: '72px 24px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.12,
        backgroundImage: 'radial-gradient(rgba(20,184,166,0.6) 1px, transparent 1px)',
        backgroundSize: '30px 30px',
      }} />
      <div style={{
        position: 'absolute', top: '10%', right: '0%',
        width: 420, height: 420, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)',
        filter: 'blur(40px)', pointerEvents: 'none',
      }} />

      <div style={{ maxWidth: 1080, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(20,184,166,0.12)', border: '1px solid rgba(20,184,166,0.3)',
            borderRadius: 20, padding: '6px 14px', marginBottom: 18,
          }}>
            <Plug size={14} color="#14b8a6" />
            <span style={{ color: '#14b8a6', fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Não usa ChatGPT?</span>
          </div>

          <h2 style={{
            fontFamily: "'Sora', sans-serif",
            fontSize: 'clamp(26px, 4vw, 38px)',
            fontWeight: 800, color: '#fff',
            lineHeight: 1.2, letterSpacing: '-0.5px',
            maxWidth: 780, margin: '0 auto 16px',
          }}>
            Tem outros dois caminhos — e os dois são grátis
          </h2>

          <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.62)', lineHeight: 1.7, maxWidth: 660, margin: '0 auto' }}>
            O app no ChatGPT é o caminho mais fácil, mas não é o único. O CoachPilot fala{' '}
            <strong style={{ color: 'rgba(255,255,255,0.9)' }}>MCP</strong>, o padrão aberto de
            conexão entre IAs e sistemas — e também funciona sem conectar nada.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginBottom: 32 }}>
          {[
            {
              icon: <Plug size={22} />,
              titulo: 'Claude ou Gemini',
              desc: 'A mesma conexão MCP vale para o Claude e para o Gemini: você autoriza uma vez e conversa com os seus dados do mesmo jeito, com escrita de treino, aviso no portal e desfazer.',
              itens: OUTRAS_IAS,
            },
            {
              icon: <FileSpreadsheet size={22} />,
              titulo: 'Sem conectar nada',
              desc: 'Prefere não ligar a sua IA à plataforma? Use os prompts prontos: você conversa com qualquer IA, ela devolve o treino ou a lista de alunos no formato certo e você revisa antes de importar.',
              itens: SEM_CONECTAR,
            },
          ].map((c, i) => (
            <div key={i} style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 18,
              padding: 26,
            }}>
              <div style={{ width: 46, height: 46, borderRadius: 12, background: 'rgba(20,184,166,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#14b8a6', marginBottom: 16 }}>
                {c.icon}
              </div>
              <h3 style={{ color: '#fff', fontSize: 17.5, fontWeight: 700, marginBottom: 10 }}>{c.titulo}</h3>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14.5, lineHeight: 1.65, marginBottom: 16 }}>{c.desc}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {c.itens.map((t, j) => (
                  <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(20,184,166,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                      <Check size={11} color="#14b8a6" strokeWidth={3} />
                    </div>
                    <span style={{ color: 'rgba(255,255,255,0.72)', fontSize: 13.5, lineHeight: 1.5 }}>{t}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p style={{ textAlign: 'center', fontSize: 14.5, color: 'rgba(255,255,255,0.55)' }}>
          <Link to="/chatgpt-para-personal-trainer" style={{ color: '#14b8a6', fontWeight: 700 }}>
            Ver como funciona a conexão em cada IA
          </Link>
          <span style={{ margin: '0 8px', color: 'rgba(255,255,255,0.25)' }}>·</span>
          <Link to="/signup" style={{ color: '#14b8a6', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            Começar grátis <ArrowRight size={15} />
          </Link>
        </p>
      </div>
    </section>
  )
}
