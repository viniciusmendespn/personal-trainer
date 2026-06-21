import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, ChevronDown, ChevronUp, Users, Share2, DollarSign, TrendingUp } from 'lucide-react'
import LandingNavbar from './LandingNavbar'
import LandingFooter from './LandingFooter'

const WA_DIVULGADOR = 'https://wa.me/5513988088204?text=Oi%2C%20quero%20ser%20divulgador%20do%20CoachPilot'
const WA_EMBAIXADOR = 'https://wa.me/5513988088204?text=Oi%2C%20quero%20conversar%20sobre%20ser%20Embaixador%20CoachPilot'
const WA_ENTRAR = 'https://wa.me/5513988088204?text=Oi%2C%20quero%20entrar%20no%20programa%20de%20divulgadores%20do%20CoachPilot'

const NIVEIS = [
  { nivel: 'Divulgador Inicial', clientes: '1 a 4 clientes ativos', comissao: '25%', cor: '#64748b' },
  { nivel: 'Divulgador Oficial', clientes: '5 a 14 clientes ativos', comissao: '30%', cor: '#14b8a6' },
  { nivel: 'Divulgador Master', clientes: '15+ clientes ativos', comissao: '35%', cor: '#10b981' },
]

const SIMULACAO = [
  { clientes: 5, comissao: '30%', ganho: 'R$59,85/mês' },
  { clientes: 10, comissao: '30%', ganho: 'R$119,70/mês' },
  { clientes: 15, comissao: '35%', ganho: 'R$209,48/mês' },
  { clientes: 30, comissao: '35%', ganho: 'R$418,95/mês' },
  { clientes: 50, comissao: '35%', ganho: 'R$698,25/mês' },
]

const PASSOS = [
  { icon: <Share2 size={24} />, titulo: 'Você recebe um cupom ou link exclusivo', desc: 'Cada divulgador recebe um identificador próprio para acompanhar suas indicações.' },
  { icon: <Users size={24} />, titulo: 'Você divulga o CoachPilot', desc: 'Nos stories, reels, grupos, alunos, colegas de profissão ou conteúdos educativos.' },
  { icon: <Check size={24} />, titulo: 'O personal indicado assina o Gestão Pro', desc: 'A comissão é calculada sobre o plano Gestão Pro de R$39,90/mês.' },
  { icon: <DollarSign size={24} />, titulo: 'Você recebe comissão recorrente', desc: 'Enquanto o cliente indicado permanecer ativo, você continua recebendo sua comissão.' },
]

const REGRAS = [
  'A comissão é paga somente sobre assinaturas ativas do plano Gestão Pro',
  'O plano grátis não gera comissão',
  'Add-ons de WhatsApp, IA e serviços extras não geram comissão',
  'A comissão começa em 25%',
  'A comissão pode subir para 30% ou 35% conforme a quantidade de clientes ativos indicados',
  'A comissão é recorrente enquanto o cliente indicado permanecer ativo',
  'Cancelamentos deixam de gerar comissão',
  'O divulgador deve usar uma comunicação clara e honesta sobre o CoachPilot',
  'Não é permitido prometer funcionalidades que não existem',
  'Não é permitido anunciar valores diferentes dos preços oficiais sem autorização',
]

const FAQS = [
  {
    pergunta: 'Preciso ser personal trainer para divulgar?',
    resposta: 'Não obrigatoriamente, mas o programa é ideal para personal trainers, donos de studio, criadores de conteúdo fitness e profissionais que falam com outros personal trainers.',
  },
  {
    pergunta: 'A comissão é sobre todos os produtos?',
    resposta: 'Não. A comissão é calculada somente sobre o plano Gestão Pro. Add-ons de WhatsApp, Assistente IA e serviços extras não entram na comissão.',
  },
  {
    pergunta: 'O plano grátis gera comissão?',
    resposta: 'Não. A comissão é gerada quando o indicado assina o plano Gestão Pro.',
  },
  {
    pergunta: 'Por quanto tempo recebo comissão?',
    resposta: 'Você recebe comissão enquanto o cliente indicado permanecer ativo no plano Gestão Pro, de acordo com as regras do programa.',
  },
  {
    pergunta: 'Como entro no programa?',
    resposta: 'Basta falar com a equipe pelo WhatsApp e solicitar sua entrada como divulgador CoachPilot.',
  },
]

function FaqItem({ pergunta, resposta }: { pergunta: string; resposta: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ border: '1px solid rgba(20,184,166,0.15)', borderRadius: 12, overflow: 'hidden', marginBottom: 8 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 20px', background: open ? 'rgba(20,184,166,0.05)' : '#fff',
          border: 'none', cursor: 'pointer', textAlign: 'left', gap: 12,
          transition: 'background 0.2s',
        }}
      >
        <span style={{ color: '#0f172a', fontWeight: 600, fontSize: 15 }}>{pergunta}</span>
        {open ? <ChevronUp size={18} color="#14b8a6" /> : <ChevronDown size={18} color="#94a3b8" />}
      </button>
      {open && (
        <div style={{ padding: '0 20px 16px', background: 'rgba(20,184,166,0.03)' }}>
          <p style={{ color: '#475569', fontSize: 14, lineHeight: 1.65 }}>{resposta}</p>
          {pergunta.includes('Como entro') && (
            <a
              href={WA_ENTRAR}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#14b8a6', fontWeight: 600, fontSize: 14, textDecoration: 'none', marginTop: 10 }}
            >
              Falar no WhatsApp <ArrowRight size={14} />
            </a>
          )}
        </div>
      )}
    </div>
  )
}

export function DivulgadoresPage() {
  return (
    <div style={{ fontFamily: "'Sora', sans-serif", background: '#fff', minHeight: '100vh' }}>
      <LandingNavbar />

      {/* Hero */}
      <section style={{
        minHeight: '70vh',
        background: 'linear-gradient(160deg, #0f172a 0%, #0a0e1a 50%, #060a14 100%)',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
        paddingTop: 68,
      }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.12, backgroundImage: 'radial-gradient(rgba(20,184,166,0.6) 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
        <div style={{ position: 'absolute', top: '15%', left: '5%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(20,184,166,0.12) 0%, transparent 70%)', filter: 'blur(40px)' }} />

        <div style={{ maxWidth: 860, margin: '0 auto', padding: '80px 24px', position: 'relative', zIndex: 1, width: '100%', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(20,184,166,0.12)', border: '1px solid rgba(20,184,166,0.3)', borderRadius: 20, padding: '6px 14px', marginBottom: 24 }}>
            <TrendingUp size={14} color="#14b8a6" />
            <span style={{ color: '#14b8a6', fontSize: 13, fontWeight: 600 }}>Comissão recorrente · Até 35%</span>
          </div>

          <h1 style={{ fontFamily: "'Sora', sans-serif", fontSize: 'clamp(28px, 5vw, 52px)', fontWeight: 800, color: '#fff', lineHeight: 1.15, marginBottom: 20, letterSpacing: '-1px' }}>
            Ganhe comissão indicando o{' '}
            <span style={{ background: 'linear-gradient(135deg, #14b8a6, #10b981)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              CoachPilot
            </span>
            {' '}para outros personal trainers
          </h1>

          <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, marginBottom: 36, maxWidth: 600, margin: '0 auto 36px' }}>
            Seja um divulgador CoachPilot, indique a plataforma para outros profissionais e receba comissão recorrente sobre cada assinatura Gestão Pro ativa.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12 }}>
            <a
              href={WA_DIVULGADOR}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: 'linear-gradient(135deg, #14b8a6, #10b981)',
                color: '#fff', fontWeight: 700, fontSize: 16, textDecoration: 'none',
                padding: '14px 28px', borderRadius: 12,
                boxShadow: '0 8px 25px rgba(20,184,166,0.35)',
              }}
            >
              Quero ser divulgador <ArrowRight size={18} />
            </a>
            <Link
              to="/"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: 'transparent', border: '1.5px solid rgba(255,255,255,0.25)',
                color: 'rgba(255,255,255,0.85)', fontWeight: 600, fontSize: 16, textDecoration: 'none',
                padding: '14px 28px', borderRadius: 12,
              }}
            >
              Conhecer o CoachPilot
            </Link>
          </div>
        </div>
      </section>

      {/* Como funciona */}
      <section style={{ background: '#f0fdfa', padding: '80px 24px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ display: 'inline-block', background: 'rgba(20,184,166,0.12)', border: '1px solid rgba(20,184,166,0.3)', borderRadius: 20, padding: '5px 14px', marginBottom: 16 }}>
              <span style={{ color: '#0d9488', fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Programa</span>
            </div>
            <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: 'clamp(24px, 4vw, 38px)', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px', marginBottom: 12 }}>
              Como funciona
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 24 }}>
            {PASSOS.map((p, i) => (
              <div key={i} style={{ background: '#fff', border: '1.5px solid rgba(20,184,166,0.12)', borderRadius: 16, padding: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(20,184,166,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#14b8a6', flexShrink: 0 }}>
                    {p.icon}
                  </div>
                  <span style={{ background: 'linear-gradient(135deg, #14b8a6, #10b981)', color: '#fff', fontSize: 12, fontWeight: 700, borderRadius: 20, padding: '2px 10px' }}>Passo {i + 1}</span>
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>{p.titulo}</h3>
                <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.6 }}>{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Níveis de comissão */}
      <section style={{ background: '#fff', padding: '80px 24px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: 'clamp(24px, 4vw, 38px)', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px', marginBottom: 12 }}>
              Quanto você pode ganhar
            </h2>
            <p style={{ color: '#475569', fontSize: 16, maxWidth: 480, margin: '0 auto' }}>
              Comece com 25% de comissão e aumente conforme o volume de indicações ativas.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20, marginBottom: 40 }}>
            {NIVEIS.map((n, i) => (
              <div key={i} style={{ background: i === 2 ? 'linear-gradient(135deg, #14b8a6, #10b981)' : '#f8fafc', border: `1.5px solid ${i === 2 ? 'transparent' : '#e2e8f0'}`, borderRadius: 16, padding: 28, textAlign: 'center' }}>
                <div style={{ color: i === 2 ? 'rgba(255,255,255,0.8)' : '#64748b', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>{n.nivel}</div>
                <div style={{ color: i === 2 ? '#fff' : '#0f172a', fontSize: 48, fontWeight: 800, lineHeight: 1, letterSpacing: '-2px', marginBottom: 8 }}>{n.comissao}</div>
                <div style={{ color: i === 2 ? 'rgba(255,255,255,0.75)' : '#64748b', fontSize: 14 }}>{n.clientes}</div>
              </div>
            ))}
          </div>

          <div style={{ background: 'rgba(20,184,166,0.06)', border: '1px solid rgba(20,184,166,0.15)', borderRadius: 12, padding: '14px 20px', textAlign: 'center' }}>
            <p style={{ color: '#475569', fontSize: 13 }}>
              A comissão é calculada somente sobre o plano Gestão Pro. Add-ons como WhatsApp, Assistente IA e serviços extras não entram no cálculo da comissão.
            </p>
          </div>
        </div>
      </section>

      {/* Simulação de ganhos */}
      <section style={{ background: '#f0fdfa', padding: '80px 24px' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: 'clamp(22px, 3vw, 34px)', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px', marginBottom: 12 }}>
              Exemplo de ganhos mensais
            </h2>
            <p style={{ color: '#475569', fontSize: 15 }}>
              Considerando o plano Gestão Pro de R$39,90/mês
            </p>
          </div>

          <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.06)', border: '1px solid rgba(20,184,166,0.15)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
              {['Clientes ativos', 'Comissão', 'Ganho mensal'].map((h, i) => (
                <div key={i} style={{ padding: '14px 20px', background: i === 2 ? 'linear-gradient(135deg, #14b8a6, #10b981)' : '#f8fefd', borderBottom: '2px solid rgba(20,184,166,0.15)', textAlign: 'center' }}>
                  <span style={{ color: i === 2 ? '#fff' : '#475569', fontSize: 13, fontWeight: 700 }}>{h}</span>
                </div>
              ))}
            </div>
            {SIMULACAO.map((s, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', background: i % 2 === 0 ? '#fff' : '#f8fefd', borderBottom: i < SIMULACAO.length - 1 ? '1px solid rgba(20,184,166,0.08)' : 'none' }}>
                <div style={{ padding: '12px 20px', textAlign: 'center' }}><span style={{ color: '#0f172a', fontWeight: 600 }}>{s.clientes}</span></div>
                <div style={{ padding: '12px 20px', textAlign: 'center' }}><span style={{ color: '#14b8a6', fontWeight: 600 }}>{s.comissao}</span></div>
                <div style={{ padding: '12px 20px', textAlign: 'center' }}><span style={{ color: '#0f172a', fontWeight: 700 }}>{s.ganho}</span></div>
              </div>
            ))}
          </div>
          <p style={{ textAlign: 'center', color: '#64748b', fontSize: 13, marginTop: 16 }}>
            Quanto mais clientes ativos você indicar, maior pode ser sua comissão mensal.
          </p>
        </div>
      </section>

      {/* Embaixadores */}
      <section style={{ background: 'linear-gradient(160deg, #0f172a 0%, #060a14 100%)', padding: '80px 24px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.08, backgroundImage: 'radial-gradient(rgba(20,184,166,0.8) 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
        <div style={{ maxWidth: 860, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 48, alignItems: 'start' }}>
            <div>
              <div style={{ display: 'inline-block', background: 'rgba(20,184,166,0.12)', border: '1px solid rgba(20,184,166,0.3)', borderRadius: 20, padding: '5px 14px', marginBottom: 20 }}>
                <span style={{ color: '#14b8a6', fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Embaixadores</span>
              </div>
              <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: 'clamp(22px, 3vw, 34px)', fontWeight: 800, color: '#fff', letterSpacing: '-0.5px', marginBottom: 16 }}>
                Quer ser um Embaixador CoachPilot?
              </h2>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, lineHeight: 1.7, marginBottom: 24 }}>
                Alguns divulgadores podem se tornar embaixadores oficiais, criando conteúdos, ajudando novos usuários e participando mais de perto da evolução da plataforma.
              </p>
              <a
                href={WA_EMBAIXADOR}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  background: 'linear-gradient(135deg, #14b8a6, #10b981)',
                  color: '#fff', fontWeight: 700, fontSize: 15, textDecoration: 'none',
                  padding: '13px 24px', borderRadius: 10,
                }}
              >
                Falar sobre parceria <ArrowRight size={16} />
              </a>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <div style={{ color: '#14b8a6', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Benefícios</div>
                {['Comissão recorrente', 'Cupom exclusivo', 'Acesso antecipado a novidades', 'Destaque como parceiro', 'Participação em conteúdos oficiais'].map((b, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                    <Check size={14} color="#14b8a6" style={{ marginTop: 2, flexShrink: 0 }} />
                    <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 1.5 }}>{b}</span>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ color: '#10b981', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Contrapartidas</div>
                {['Criar conteúdos sobre o CoachPilot', 'Usar a plataforma na prática', 'Ajudar indicados com dúvidas básicas', 'Dar feedbacks para o produto'].map((b, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                    <Check size={14} color="#10b981" style={{ marginTop: 2, flexShrink: 0 }} />
                    <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 1.5 }}>{b}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Regras */}
      <section style={{ background: '#fff', padding: '80px 24px' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: 'clamp(22px, 3vw, 34px)', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px', marginBottom: 12 }}>
              Regras principais
            </h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {REGRAS.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 20px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(20,184,166,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                  <span style={{ color: '#14b8a6', fontSize: 11, fontWeight: 700 }}>{i + 1}</span>
                </div>
                <span style={{ color: '#475569', fontSize: 14, lineHeight: 1.6 }}>{r}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ background: '#f0fdfa', padding: '80px 24px' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: 'clamp(22px, 3vw, 34px)', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px', marginBottom: 12 }}>
              Perguntas frequentes
            </h2>
          </div>
          {FAQS.map((f, i) => (
            <FaqItem key={i} pergunta={f.pergunta} resposta={f.resposta} />
          ))}
        </div>
      </section>

      {/* CTA Final */}
      <section style={{ background: 'linear-gradient(135deg, #0f172a 0%, #0d9488 50%, #14b8a6 100%)', padding: '80px 24px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.1, backgroundImage: 'radial-gradient(rgba(255,255,255,0.8) 1px, transparent 1px)', backgroundSize: '25px 25px' }} />
        <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: 'clamp(24px, 4vw, 42px)', fontWeight: 800, color: '#fff', lineHeight: 1.2, marginBottom: 16, letterSpacing: '-0.5px' }}>
            Pronto para ganhar indicando o CoachPilot?
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 17, lineHeight: 1.6, marginBottom: 32 }}>
            Fale com a gente no WhatsApp e solicite seu link ou cupom de divulgador.
          </p>
          <a
            href={WA_DIVULGADOR}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: '#fff',
              color: '#0d9488', fontWeight: 700, fontSize: 16, textDecoration: 'none',
              padding: '16px 32px', borderRadius: 12,
              boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
            }}
          >
            Quero ser divulgador <ArrowRight size={18} />
          </a>
        </div>
      </section>

      <LandingFooter />
    </div>
  )
}
