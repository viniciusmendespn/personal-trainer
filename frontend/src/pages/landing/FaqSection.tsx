import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

const FAQS = [
  {
    q: 'O CoachPilot é gratuito?',
    a: 'Sim. O plano gratuito permite gerenciar até 3 alunos com todas as funcionalidades essenciais: cadastro de treinos, avaliações físicas, agenda, app do aluno e dashboard. Para alunos ilimitados, o Gestão Pro custa R$39,90/mês (preço de lançamento).',
  },
  {
    q: 'Preciso instalar algum aplicativo?',
    a: 'Não. O CoachPilot é uma plataforma web (PWA). Você gerencia tudo pelo navegador, e seu aluno acessa os treinos direto pelo celular via link enviado no WhatsApp — sem instalar nada da loja de aplicativos.',
  },
  {
    q: 'Funciona para personal trainer online?',
    a: 'Sim. O CoachPilot foi desenvolvido para personal trainers presenciais e online. Você cria os treinos no portal e o aluno acessa de qualquer lugar pelo app, seja na academia ou em casa.',
  },
  {
    q: 'Como o aluno acessa os treinos?',
    a: 'O aluno recebe um link exclusivo pelo WhatsApp e abre o app do aluno diretamente no navegador do celular, sem cadastro nem senha. Pode salvar o app na tela inicial como qualquer aplicativo nativo.',
  },
  {
    q: 'Como o ChatGPT cadastra meus treinos e alunos?',
    a: 'O CoachPilot foi feito para você operar por linguagem natural. Você conversa — por texto ou voz — com o seu próprio ChatGPT, Claude ou Gemini usando os prompts prontos da plataforma, e ele devolve: a lista de alunos a importar, um pacote de treino completo (exercícios, séries, repetições, cargas e intervalos) ou o ajuste de um treino existente. Você revisa e importa com 1 clique. Isso está incluído e não tem custo extra — você usa a IA que já tem.',
  },
  {
    q: 'Posso migrar dados de outro software?',
    a: 'Sim. Você pode cadastrar seus alunos manualmente em poucos minutos ou, mais rápido, jogar sua planilha/lista no ChatGPT com o prompt da plataforma e importar todos de uma vez. Para bases maiores, a equipe auxilia na migração assistida sem custo adicional — fale pelo WhatsApp.',
  },
  {
    q: 'O CoachPilot tem integração com WhatsApp?',
    a: 'Sim, como add-on opcional por +R$29,90/mês. Conecte seu número de WhatsApp para enviar lembretes de treino, agendar sessões e, se quiser, ativar o assistente de IA do aluno, que responde dúvidas dos alunos automaticamente (cobrado por aluno habilitado). Atenção: esse assistente do aluno é diferente do cadastro por IA do personal, que é grátis.',
  },
  {
    q: 'Há fidelidade ou multa para cancelar?',
    a: 'Não. O CoachPilot não tem contrato de fidelidade. Você pode cancelar a assinatura quando quiser, sem multa, direto pelas configurações do portal.',
  },
]

export default function FaqSection() {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <section id="faq" style={{ background: '#f8fafc', padding: '80px 24px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <div style={{
            display: 'inline-block',
            background: 'rgba(20,184,166,0.12)',
            border: '1px solid rgba(20,184,166,0.3)',
            borderRadius: 20, padding: '5px 14px', marginBottom: 16,
          }}>
            <span style={{ color: '#0d9488', fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>FAQ</span>
          </div>
          <h2 style={{
            fontFamily: "'Sora', sans-serif",
            fontSize: 'clamp(26px, 4vw, 38px)',
            fontWeight: 800, color: '#0f172a',
            letterSpacing: '-0.5px', marginBottom: 14,
          }}>
            Perguntas{' '}
            <span style={{ background: 'linear-gradient(135deg, #14b8a6, #10b981)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              frequentes
            </span>
          </h2>
          <p style={{ color: '#475569', fontSize: 16, lineHeight: 1.6 }}>
            Tudo que você precisa saber antes de começar.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {FAQS.map((item, i) => (
            <div
              key={i}
              style={{
                background: '#fff',
                border: `1.5px solid ${open === i ? 'rgba(20,184,166,0.4)' : 'rgba(20,184,166,0.12)'}`,
                borderRadius: 14,
                overflow: 'hidden',
                transition: 'border-color 0.2s',
              }}
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', gap: 16,
                  padding: '20px 24px', background: 'none', border: 'none',
                  cursor: 'pointer', textAlign: 'left',
                }}
                aria-expanded={open === i}
              >
                <span style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', lineHeight: 1.4 }}>
                  {item.q}
                </span>
                <ChevronDown
                  size={20}
                  color="#14b8a6"
                  style={{
                    flexShrink: 0,
                    transform: open === i ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.25s',
                  }}
                />
              </button>
              {open === i && (
                <div style={{ padding: '0 24px 20px', color: '#475569', fontSize: 15, lineHeight: 1.7 }}>
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
