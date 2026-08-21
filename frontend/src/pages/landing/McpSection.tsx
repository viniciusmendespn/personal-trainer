import { Link } from 'react-router-dom'
import { Plug, ArrowRight, Check, ShieldCheck, Undo2, Wallet, MessageSquare } from 'lucide-react'

const CHAT = [
  { from: 'user', text: 'Quem dos meus alunos não treina há mais de 10 dias?' },
  { from: 'ai', text: 'Quatro: Pedro (14 dias), Júlia (12), Rafael (11) e Bianca (10). O Rafael também está sem treino novo desde maio — quer que eu monte um?' },
  { from: 'user', text: 'Monta e aplica pro Rafael, com foco em costas.' },
  { from: 'ai', text: 'Aplicado ✓ O programa do Rafael já está atualizado no CoachPilot. Você recebeu o aviso no portal e pode desfazer quando quiser.' },
]

const PEDIDOS = [
  {
    pergunta: '"Me dá o resumo da Júlia antes da sessão de amanhã"',
    retorno: 'Perfil, anamnese, avaliações e últimos treinos numa resposta só.',
  },
  {
    pergunta: '"Como está a evolução do agachamento da Carla?"',
    retorno: 'Carga, repetições, volume e recordes ao longo do tempo.',
  },
  {
    pergunta: '"Quem está parado e quem está sem treino montado?"',
    retorno: 'Panorama da carteira inteira, sem abrir uma tela.',
  },
  {
    pergunta: '"Adapta o treino do Pedro pra dor no ombro e aplica"',
    retorno: 'A IA reescreve o programa e grava direto no CoachPilot.',
  },
  {
    pergunta: '"O que eu tenho na agenda de quinta?"',
    retorno: 'Seus compromissos do período, na hora.',
  },
  {
    pergunta: '"Desfaz a última alteração no treino do Pedro"',
    retorno: 'Volta como estava antes, num comando.',
  },
]

const BENEFICIOS = [
  {
    icon: <MessageSquare size={20} />,
    title: 'Você para de operar o sistema',
    desc: 'Sem abrir tela, filtrar lista e clicar em dez lugares. Você pergunta em português e a resposta vem — do computador ou do celular, entre um atendimento e outro.',
  },
  {
    icon: <ShieldCheck size={20} />,
    title: 'A resposta vem do seu dado, não do chute',
    desc: 'A IA lê o que está de fato no seu CoachPilot naquele segundo. Não inventa aluno, não inventa carga, não confunde histórico.',
  },
  {
    icon: <Undo2 size={20} />,
    title: 'Você continua no comando',
    desc: 'Na hora de conectar, você escolhe se a IA só consulta ou se também pode alterar treinos. Toda alteração te avisa no portal e tem botão de desfazer.',
  },
  {
    icon: <Wallet size={20} />,
    title: 'Sem custo extra',
    desc: 'Roda na assinatura de IA que você já paga — ChatGPT, Claude ou Gemini. A conexão está incluída nos dois planos, inclusive no grátis.',
  },
]

export default function McpSection() {
  return (
    <section id="mcp" style={{ background: '#f0fdfa', padding: '80px 24px' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(20,184,166,0.12)', border: '1px solid rgba(20,184,166,0.3)',
            borderRadius: 20, padding: '6px 14px', marginBottom: 18,
          }}>
            <Plug size={14} color="#0d9488" />
            <span style={{ color: '#0d9488', fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Novo · Conexão MCP</span>
          </div>

          <h2 style={{
            fontFamily: "'Sora', sans-serif",
            fontSize: 'clamp(28px, 4.5vw, 44px)',
            fontWeight: 800, color: '#0f172a',
            lineHeight: 1.15, letterSpacing: '-1px',
            maxWidth: 860, margin: '0 auto 18px',
          }}>
            Conecte a sua IA ao CoachPilot e{' '}
            <span style={{ background: 'linear-gradient(135deg, #14b8a6, #10b981)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              pergunte o que quiser sobre seus alunos
            </span>
          </h2>

          <p style={{ fontSize: 17.5, color: '#475569', lineHeight: 1.7, maxWidth: 720, margin: '0 auto' }}>
            O CoachPilot tem um <strong style={{ color: '#0f172a' }}>servidor MCP</strong> — o padrão que o ChatGPT,
            o Claude e o Gemini usam para se conectar a sistemas de fora. Na prática: você autoriza uma vez e a
            sua IA passa a enxergar os seus dados aqui dentro.{' '}
            <strong style={{ color: '#0f172a' }}>Sem copiar, sem colar, sem baixar arquivo.</strong>{' '}
            Você pergunta, ela responde com o dado real. Você pede, ela faz.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: 40, alignItems: 'center', marginBottom: 56 }}>
          {/* Conversa */}
          <div style={{
            background: 'linear-gradient(160deg, #0f172a 0%, #0a0e1a 100%)',
            border: '1px solid rgba(20,184,166,0.25)',
            borderRadius: 20,
            padding: 22,
            boxShadow: '0 18px 45px rgba(15,23,42,0.18)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #14b8a6, #10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Plug size={17} color="#fff" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>Sua IA · conectada ao CoachPilot</div>
                <div style={{ color: '#14b8a6', fontSize: 12 }}>● lendo os seus dados agora</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {CHAT.map((m, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: m.from === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '86%',
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

            <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(20,184,166,0.1)', border: '1px solid rgba(20,184,166,0.25)', borderRadius: 12, padding: '10px 12px' }}>
              <Check size={15} color="#14b8a6" strokeWidth={3} />
              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12.5, lineHeight: 1.5 }}>
                Nenhum arquivo, nenhum copiar e colar — a IA falou direto com o CoachPilot.
              </span>
            </div>
          </div>

          {/* O que você pode pedir */}
          <div>
            <h3 style={{ fontFamily: "'Sora', sans-serif", fontSize: 19, fontWeight: 800, color: '#0f172a', marginBottom: 16 }}>
              O que você pode pedir
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {PEDIDOS.map((p, i) => (
                <div key={i} style={{
                  background: '#fff',
                  border: '1.5px solid rgba(20,184,166,0.14)',
                  borderRadius: 12,
                  padding: '13px 16px',
                }}>
                  <div style={{ color: '#0f172a', fontSize: 14.5, fontWeight: 700, lineHeight: 1.45, marginBottom: 4 }}>
                    {p.pergunta}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                    <ArrowRight size={13} color="#14b8a6" style={{ flexShrink: 0, marginTop: 4 }} />
                    <span style={{ color: '#64748b', fontSize: 13.5, lineHeight: 1.5 }}>{p.retorno}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Benefícios */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 20, marginBottom: 44 }}>
          {BENEFICIOS.map((b, i) => (
            <div key={i} style={{
              background: '#fff',
              border: '1.5px solid rgba(20,184,166,0.12)',
              borderRadius: 16,
              padding: 22,
            }}>
              <div style={{ width: 42, height: 42, borderRadius: 11, background: 'rgba(20,184,166,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0d9488', marginBottom: 14 }}>
                {b.icon}
              </div>
              <h3 style={{ color: '#0f172a', fontSize: 15.5, fontWeight: 700, lineHeight: 1.35, marginBottom: 8 }}>{b.title}</h3>
              <p style={{ color: '#64748b', fontSize: 14, lineHeight: 1.6 }}>{b.desc}</p>
            </div>
          ))}
        </div>

        {/* Faixa de confiança + CTA */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 20,
          alignItems: 'center', justifyContent: 'center',
          background: 'rgba(20,184,166,0.08)',
          border: '1px solid rgba(20,184,166,0.25)',
          borderRadius: 16,
          padding: '24px 28px',
        }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, flex: 1, minWidth: 280 }}>
            {[
              'Só os seus alunos — uma conexão nunca vê dado de outro personal',
              'Você autoriza, e revoga quando quiser em Configurações → Conexões',
              'Incluído nos dois planos, inclusive no grátis',
            ].map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#334155' }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(20,184,166,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Check size={12} color="#0d9488" strokeWidth={2.5} />
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
              boxShadow: '0 8px 25px rgba(20,184,166,0.3)',
              whiteSpace: 'nowrap',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 30px rgba(20,184,166,0.4)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 8px 25px rgba(20,184,166,0.3)' }}
          >
            Conectar minha IA <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </section>
  )
}
