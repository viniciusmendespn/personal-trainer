import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, Copy, ShieldCheck, Undo2, Wallet, Sparkles } from 'lucide-react'

const PASSOS = [
  { titulo: 'Abra os Plugins no ChatGPT', desc: 'No menu lateral do ChatGPT, clique em "Plugins".' },
  { titulo: 'Busque por CoachPilot', desc: 'Digite "coachpilot" na busca — ele aparece na lista de apps públicos.' },
  { titulo: 'Clique no + para adicionar', desc: 'O app entra na sua conta do ChatGPT na hora.' },
  { titulo: 'Entre e autorize', desc: 'A tela do CoachPilot abre sozinha para você fazer login e liberar o acesso. Sua senha nunca passa pelo ChatGPT.' },
]

const COMANDOS = [
  { grupo: 'Consultar', texto: 'Quem dos meus alunos não treina há mais de 10 dias?' },
  { grupo: 'Preparar a sessão', texto: 'Me dá o resumo da Júlia antes da sessão de amanhã' },
  { grupo: 'Prescrever', texto: 'Monta um ABC de hipertrofia pro Rafael e aplica no CoachPilot' },
  { grupo: 'Ajustar', texto: 'Adapta o treino do Pedro pra dor no ombro e aplica' },
  { grupo: 'Evolução', texto: 'Como está a evolução do agachamento da Carla nos últimos 3 meses?' },
  { grupo: 'Agenda', texto: 'O que eu tenho na agenda de quinta?' },
  { grupo: 'Carteira', texto: 'Quem está sem treino montado e quem está com mensalidade atrasada?' },
  { grupo: 'Desfazer', texto: 'Desfaz a última alteração no treino do Pedro' },
]

const CHAT = [
  { from: 'user', text: 'Quem dos meus alunos não treina há mais de 10 dias?' },
  { from: 'ai', text: 'Quatro: Pedro (14 dias), Júlia (12), Rafael (11) e Bianca (10). O Rafael também está sem treino novo desde maio — quer que eu monte um?' },
  { from: 'user', text: 'Monta e aplica pro Rafael, com foco em costas.' },
  { from: 'ai', text: 'Aplicado ✓ O programa do Rafael já está no CoachPilot e o app dele já mostra o treino novo. Você recebeu o aviso no portal e pode desfazer quando quiser.' },
]

const GARANTIAS = [
  {
    icon: <Wallet size={20} />,
    title: 'Não custa nada a mais',
    desc: 'O app é gratuito nos dois planos do CoachPilot, inclusive no grátis — e funciona até na conta gratuita do ChatGPT.',
  },
  {
    icon: <ShieldCheck size={20} />,
    title: 'A resposta vem do seu dado',
    desc: 'O ChatGPT lê o que está de fato na sua conta naquele segundo. Não inventa aluno, não inventa carga, não confunde histórico.',
  },
  {
    icon: <Undo2 size={20} />,
    title: 'Você continua no comando',
    desc: 'Na autorização você escolhe se ele só consulta ou também altera treinos. Toda alteração avisa no portal e tem botão de desfazer.',
  },
  {
    icon: <Sparkles size={20} />,
    title: 'Sem copiar e colar',
    desc: 'Nada de baixar arquivo, colar JSON ou reimportar. O que você pede na conversa já entra no CoachPilot.',
  },
]

function ComandoCard({ grupo, texto }: { grupo: string; texto: string }) {
  const [copiado, setCopiado] = useState(false)

  function copiar() {
    navigator.clipboard?.writeText(texto).then(
      () => {
        setCopiado(true)
        setTimeout(() => setCopiado(false), 1800)
      },
      () => {},
    )
  }

  return (
    <button
      onClick={copiar}
      title="Copiar comando"
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 12,
        background: '#fff',
        border: `1.5px solid ${copiado ? 'rgba(20,184,166,0.55)' : 'rgba(20,184,166,0.16)'}`,
        borderRadius: 12,
        padding: '13px 15px',
        textAlign: 'left',
        cursor: 'pointer',
        width: '100%',
        transition: 'border-color 0.2s, transform 0.2s',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none' }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: '#0d9488', fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 5 }}>
          {grupo}
        </div>
        <div style={{ color: '#0f172a', fontSize: 14.5, fontWeight: 600, lineHeight: 1.45 }}>
          “{texto}”
        </div>
      </div>
      <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: copiado ? '#0d9488' : '#94a3b8', fontSize: 11.5, fontWeight: 700, flexShrink: 0, marginTop: 2 }}>
        {copiado ? <Check size={14} strokeWidth={3} /> : <Copy size={14} />}
        {copiado ? 'Copiado' : 'Copiar'}
      </span>
    </button>
  )
}

export default function ChatGptSection() {
  return (
    <section id="chatgpt" style={{ background: '#fff', padding: '84px 24px' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        {/* Cabeçalho */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.35)',
            borderRadius: 20, padding: '6px 14px', marginBottom: 18,
          }}>
            <Check size={14} color="#059669" strokeWidth={3} />
            <span style={{ color: '#047857', fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
              Novo · App aprovado pela OpenAI
            </span>
          </div>

          <h2 style={{
            fontFamily: "'Sora', sans-serif",
            fontSize: 'clamp(28px, 4.5vw, 46px)',
            fontWeight: 800, color: '#0f172a',
            lineHeight: 1.15, letterSpacing: '-1px',
            maxWidth: 880, margin: '0 auto 18px',
          }}>
            O CoachPilot agora é um app dentro do ChatGPT —{' '}
            <span style={{ background: 'linear-gradient(135deg, #14b8a6, #10b981)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              gerencie tudo conversando
            </span>
          </h2>

          <p style={{ fontSize: 17.5, color: '#475569', lineHeight: 1.7, maxWidth: 730, margin: '0 auto' }}>
            Instale o app no seu ChatGPT em menos de um minuto e pronto: ele passa a enxergar os
            seus alunos, treinos, avaliações e agenda. Você{' '}
            <strong style={{ color: '#0f172a' }}>pergunta em português e ele responde com o seu dado real</strong>;
            pede um treino e ele grava direto no CoachPilot, com o aluno já vendo no app.
            Sem copiar, sem colar, sem abrir o portal.
          </p>
        </div>

        {/* Instalação: imagem + passos */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 40, alignItems: 'center', marginBottom: 64,
        }}>
          <div style={{
            borderRadius: 20,
            overflow: 'hidden',
            border: '1px solid rgba(20,184,166,0.25)',
            boxShadow: '0 22px 55px rgba(15,23,42,0.22)',
            lineHeight: 0,
          }}>
            <img
              src="/plugin-chatgpt.png"
              alt="Como instalar o CoachPilot no ChatGPT: abrir Plugins no menu lateral, buscar por CoachPilot e clicar no + para adicionar"
              width={1254}
              height={1009}
              loading="lazy"
              decoding="async"
              style={{ width: '100%', height: 'auto', display: 'block' }}
            />
          </div>

          <div>
            <h3 style={{ fontFamily: "'Sora', sans-serif", fontSize: 21, fontWeight: 800, color: '#0f172a', marginBottom: 20 }}>
              Instalar leva menos de um minuto
            </h3>

            <ol style={{ listStyle: 'none', padding: 0, margin: '0 0 26px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {PASSOS.map((p, i) => (
                <li key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                    background: 'linear-gradient(135deg, #14b8a6, #10b981)',
                    color: '#fff', fontWeight: 800, fontSize: 14,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(20,184,166,0.35)',
                  }}>
                    {i + 1}
                  </div>
                  <div>
                    <div style={{ color: '#0f172a', fontSize: 15.5, fontWeight: 700, marginBottom: 3 }}>{p.titulo}</div>
                    <div style={{ color: '#64748b', fontSize: 14, lineHeight: 1.6 }}>{p.desc}</div>
                  </div>
                </li>
              ))}
            </ol>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
              <Link
                to="/signup"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  background: 'linear-gradient(135deg, #14b8a6, #10b981)',
                  color: '#fff', fontWeight: 700, fontSize: 15.5, textDecoration: 'none',
                  padding: '14px 26px', borderRadius: 12,
                  boxShadow: '0 8px 25px rgba(20,184,166,0.32)',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 30px rgba(20,184,166,0.42)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 8px 25px rgba(20,184,166,0.32)' }}
              >
                Criar conta grátis e conectar <ArrowRight size={18} />
              </Link>
              <span style={{ color: '#64748b', fontSize: 13.5, lineHeight: 1.5 }}>
                Você precisa de uma conta CoachPilot para autorizar.
              </span>
            </div>
          </div>
        </div>

        {/* Conversa + comandos */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))',
          gap: 40, alignItems: 'start', marginBottom: 56,
        }}>
          <div style={{
            background: 'linear-gradient(160deg, #0f172a 0%, #0a0e1a 100%)',
            border: '1px solid rgba(20,184,166,0.25)',
            borderRadius: 20,
            padding: 22,
            boxShadow: '0 18px 45px rgba(15,23,42,0.18)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #14b8a6, #10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Sparkles size={17} color="#fff" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>ChatGPT · app CoachPilot ativo</div>
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
                Tudo isso por texto ou por voz — inclusive do celular, entre um atendimento e outro.
              </span>
            </div>
          </div>

          <div>
            <h3 style={{ fontFamily: "'Sora', sans-serif", fontSize: 19, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>
              O que você pode pedir
            </h3>
            <p style={{ color: '#64748b', fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
              Toque para copiar e cole no seu ChatGPT depois de instalar.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
              {COMANDOS.map((c, i) => (
                <ComandoCard key={i} grupo={c.grupo} texto={c.texto} />
              ))}
            </div>
          </div>
        </div>

        {/* Garantias */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 20, marginBottom: 40 }}>
          {GARANTIAS.map((b, i) => (
            <div key={i} style={{
              background: '#f8fefd',
              border: '1.5px solid rgba(20,184,166,0.14)',
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

        {/* Faixa final */}
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
              'Você revoga quando quiser em Configurações → Conexões',
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
            Começar grátis <ArrowRight size={18} />
          </Link>
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 14.5, color: '#475569' }}>
          Quer entender antes de criar a conta?{' '}
          <Link to="/chatgpt-para-personal-trainer" style={{ color: '#0d9488', fontWeight: 700 }}>
            Como funciona o app do CoachPilot no ChatGPT
          </Link>{' '}
          ·{' '}
          <Link to="/blog/gerenciar-alunos-e-treinos-pelo-chatgpt" style={{ color: '#0d9488', fontWeight: 700 }}>
            tudo o que dá para pedir
          </Link>
        </p>
      </div>
    </section>
  )
}
