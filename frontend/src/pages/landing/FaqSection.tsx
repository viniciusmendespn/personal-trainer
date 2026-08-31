import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

const FAQS = [
  {
    q: 'Como eu instalo o plugin do CoachPilot no ChatGPT?',
    a: 'No ChatGPT, abra "Plugins" no menu lateral, busque por "coachpilot" e clique no + para adicionar. Em seguida a tela do CoachPilot abre sozinha para você entrar com a sua conta e autorizar o acesso — sua senha nunca passa pelo ChatGPT. A partir daí é só conversar: "quem não treina há 10 dias?", "me dá o resumo da Júlia", "monta um ABC pro Rafael e aplica".',
  },
  {
    q: 'Preciso pagar o ChatGPT para usar o app?',
    a: 'Não. O app do CoachPilot está no diretório público do ChatGPT e funciona também na conta gratuita. Do lado do CoachPilot, ele é gratuito nos dois planos, inclusive no grátis de até 3 alunos — não existe custo de IA embutido na mensalidade, porque o modelo é o da sua própria conta.',
  },
  {
    q: 'O que dá para fazer pelo chat?',
    a: 'Consultar a carteira (quem está parado, quem está sem treino montado, quem tem mensalidade em atraso), preparar a sessão (resumo do aluno com anamnese, avaliações e últimos treinos), acompanhar evolução por exercício, ver a agenda do período e, se você autorizar a escrita, montar e aplicar programas de treino, ajustar um treino específico ("adapta pra dor no ombro") e desfazer a última alteração.',
  },
  {
    q: 'O CoachPilot é gratuito?',
    a: 'Sim. O plano gratuito permite gerenciar até 3 alunos com todas as funcionalidades essenciais: cadastro de treinos, avaliações físicas, agenda, app do aluno e dashboard. Para alunos ilimitados, o Gestão Pro custa R$39,90/mês (preço de lançamento).',
  },
  {
    q: 'O preço sobe conforme eu tenho mais alunos?',
    a: 'Não. No Gestão Pro os alunos são ilimitados pelo mesmo preço — R$39,90/mês, tenha você 10 ou 200 alunos. É diferente de concorrentes que cobram por faixa de alunos e ficam mais caros conforme você cresce. Seu software não deveria custar mais só porque você trabalhou mais.',
  },
  {
    q: 'Tem pegadinha ou limite escondido?',
    a: 'Não. É um plano único: alunos ilimitados, treinos e templates ilimitados, e o cadastro por IA (montar treinos e importar alunos conversando com o ChatGPT) já incluso e sem custo extra. Os únicos itens à parte são add-ons claramente opcionais — o Canal WhatsApp e o Assistente IA do aluno — que você só ativa, e só paga, se quiser.',
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
    q: 'Uso Claude ou Gemini. Dá para conectar também?',
    a: 'Dá. O app do ChatGPT é a porta mais fácil, mas por baixo o CoachPilot fala MCP, o padrão aberto de conexão entre IAs e sistemas. Em Configurações → Conexões você copia o endereço do servidor e adiciona no Claude ou no Gemini — mesmos dados, mesma autorização, mesmo desfazer. No Claude a conexão funciona até no plano grátis.',
  },
  {
    q: 'E se eu não quiser conectar minha IA à plataforma?',
    a: 'Você continua operando por conversa sem conectar nada: a plataforma tem prompts prontos que fazem qualquer IA devolver um pacote de treino completo (exercícios, séries, repetições, cargas e intervalos) ou a lista de alunos para migrar. Você revisa e importa com 1 clique. Também é grátis em todos os planos.',
  },
  {
    q: 'A IA vai ter acesso aos dados dos meus alunos? É seguro?',
    a: 'A conexão só existe se você autorizar, e só alcança os seus alunos — nenhuma conexão enxerga dado de outro personal. Na hora de instalar o app você faz login no próprio CoachPilot (sua senha nunca passa pela IA) e escolhe se ela apenas consulta ou se também pode alterar treinos. Toda alteração feita pela IA gera aviso no portal e tem botão de desfazer, e você revoga o acesso quando quiser em Configurações → Conexões. Não existe apagar aluno nem operação em massa pela IA.',
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
