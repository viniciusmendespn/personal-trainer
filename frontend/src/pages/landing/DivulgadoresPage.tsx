import { useEffect } from 'react'
import {
  ArrowRight,
  Check,
  Users,
  Share2,
  DollarSign,
  TrendingUp,
} from 'lucide-react'
import LandingNavbar from './LandingNavbar'
import LandingFooter from './LandingFooter'
import './public-site.css'
const WA_DIVULGADOR =
  'https://wa.me/5514996906105?text=Oi%2C%20quero%20ser%20divulgador%20do%20CoachPilot'
const WA_EMBAIXADOR =
  'https://wa.me/5514996906105?text=Oi%2C%20quero%20conversar%20sobre%20ser%20Embaixador%20CoachPilot'
const WA_ENTRAR =
  'https://wa.me/5514996906105?text=Oi%2C%20quero%20entrar%20no%20programa%20de%20divulgadores%20do%20CoachPilot'

const NIVEIS = [
  {
    nivel: 'Divulgador Inicial',
    clientes: '1 a 4 clientes ativos',
    comissao: '20%',
    turbo: '25% no mês com 2+ vendas novas',
    cor: '#64748b',
  },
  {
    nivel: 'Divulgador Oficial',
    clientes: '5 a 14 clientes ativos',
    comissao: '25%',
    turbo: '30% no mês com 2+ vendas novas',
    cor: '#14b8a6',
  },
  {
    nivel: 'Divulgador Master',
    clientes: '15+ clientes ativos',
    comissao: '30%',
    turbo: '+R$100 no mês com 4+ vendas novas',
    cor: '#10b981',
  },
  {
    nivel: 'Embaixador da Marca',
    clientes: 'Somente por convite',
    comissao: '35%',
    turbo: 'produção de conteúdo + benefícios exclusivos',
    cor: '#0d9488',
  },
]

const SIMULACAO = [
  { clientes: 5, comissao: '25% → 30%', ganho: 'até R$59,85/mês' },
  { clientes: 10, comissao: '25% → 30%', ganho: 'até R$119,70/mês' },
  { clientes: 15, comissao: '30%', ganho: 'R$179,55/mês' },
  { clientes: 30, comissao: '30%', ganho: 'R$359,10/mês' },
  { clientes: 50, comissao: '35% (Embaixador)', ganho: 'R$698,25/mês' },
]

const PASSOS = [
  {
    icon: <Share2 size={24} />,
    titulo: 'Você recebe um cupom ou link exclusivo',
    desc: 'Cada divulgador recebe um identificador próprio para acompanhar suas indicações.',
  },
  {
    icon: <Users size={24} />,
    titulo: 'Você divulga o CoachPilot',
    desc: 'Nos stories, reels, grupos, alunos, colegas de profissão ou conteúdos educativos.',
  },
  {
    icon: <Check size={24} />,
    titulo: 'O personal indicado assina o Gestão Pro',
    desc: 'A comissão é calculada sobre o plano Gestão Pro de R$39,90/mês.',
  },
  {
    icon: <DollarSign size={24} />,
    titulo: 'Você recebe comissão recorrente',
    desc: 'A comissão-base da sua faixa é paga todo mês — e sobe 5 pontos percentuais nos meses em que você fizer 2 ou mais vendas novas.',
  },
]

const REGRAS = [
  'A comissão é paga somente sobre assinaturas ativas do plano Gestão Pro',
  'O plano grátis não gera comissão',
  'Add-ons de WhatsApp, IA e serviços extras não geram comissão',
  'A comissão-base começa em 20% e sobe para 25% (5+ clientes ativos) e 30% (15+ clientes ativos)',
  'Acelerador de performance: +5 pontos percentuais em todo mês com 2 ou mais vendas novas',
  'A comissão de 35% é exclusiva do programa Embaixador da Marca, por convite',
  'A comissão é recorrente enquanto o cliente indicado permanecer ativo',
  'Cancelamentos deixam de gerar comissão',
  'Não é permitido usar o próprio cupom em conta própria (auto-indicação)',
  'O divulgador deve usar uma comunicação clara e honesta sobre o CoachPilot',
  'Não é permitido prometer funcionalidades que não existem',
  'Não é permitido anunciar valores diferentes dos preços oficiais sem autorização',
]

const FAQS = [
  {
    pergunta: 'Preciso ser personal trainer para divulgar?',
    resposta:
      'Não obrigatoriamente, mas o programa é ideal para personal trainers, donos de studio, criadores de conteúdo fitness e profissionais que falam com outros personal trainers.',
  },
  {
    pergunta: 'A comissão é sobre todos os produtos?',
    resposta:
      'Não. A comissão é calculada somente sobre o plano Gestão Pro. Add-ons de WhatsApp, Assistente IA e serviços extras não entram na comissão.',
  },
  {
    pergunta: 'O plano grátis gera comissão?',
    resposta:
      'Não. A comissão é gerada quando o indicado assina o plano Gestão Pro.',
  },
  {
    pergunta: 'Por quanto tempo recebo comissão?',
    resposta:
      'Você recebe comissão enquanto o cliente indicado permanecer ativo no plano Gestão Pro, de acordo com as regras do programa.',
  },
  {
    pergunta: 'Como funciona o acelerador de performance?',
    resposta:
      'Todo mês em que você fizer 2 ou mais vendas novas, a comissão daquele mês sobe 5 pontos percentuais sobre toda a sua carteira (ex.: um Divulgador Oficial passa de 25% para 30%). No mês seguinte, basta vender de novo para manter o acelerador ativo.',
  },
  {
    pergunta: 'Como chego aos 35%?',
    resposta:
      'A comissão de 35% é exclusiva do programa Embaixador da Marca, que funciona por convite: além de indicar, o Embaixador produz conteúdos sobre a plataforma e acompanha seus indicados nos primeiros passos. Divulgadores com boa performance e presença digital no nicho são convidados.',
  },
  {
    pergunta: 'Como entro no programa?',
    resposta:
      'Basta falar com a equipe pelo WhatsApp e solicitar sua entrada como divulgador CoachPilot.',
  },
]

export function DivulgadoresPage() {
  useEffect(() => {
    document.title = 'Divulgadores CoachPilot | Comissão recorrente'
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute(
        'content',
        'Indique o CoachPilot para personal trainers e receba comissão recorrente sobre assinaturas Gestão Pro ativas. Conheça os níveis e participe do programa.',
      )
    document
      .querySelector('link[rel="canonical"]')
      ?.setAttribute('href', 'https://coachpilot.com.br/divulgadores')
    window.scrollTo(0, 0)
  }, [])
  return (
    <div className="cp-public">
      <a className="cp-skip" href="#conteudo">
        Ir para o conteúdo
      </a>
      <LandingNavbar />
      <main id="conteudo">
        <section className="cp-hero cp-partner-hero">
          <div className="cp-container cp-hero-grid">
            <div className="cp-hero-copy">
              <p className="cp-eyebrow" style={{ color: '#77dfb9' }}>
                Programa de divulgadores
              </p>
              <h1>
                Boas conexões.
                <br />
                Novas oportunidades.
                <br />
                <em>Cresça com a gente.</em>
              </h1>
              <p>
                Indique uma plataforma que faz parte da rotina de personal
                trainers e receba comissão recorrente por cada assinatura Gestão
                Pro ativa.
              </p>
              <div className="cp-actions">
                <a
                  className="cp-button"
                  href={WA_DIVULGADOR}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Quero ser divulgador <ArrowRight size={16} />
                </a>
                <a className="cp-button cp-button-outline" href="#comissoes">
                  Entender as comissões
                </a>
              </div>
              <div className="cp-hero-note">
                <span>
                  <Check size={13} /> Link ou cupom exclusivo
                </span>
                <span>
                  <Check size={13} /> Comissão recorrente
                </span>
              </div>
            </div>
            <div className="cp-partner-visual">
              <img
                src="/images/coachpilot-coaching-v2.webp"
                width="1536"
                height="1024"
                alt="Profissionais conectando conhecimento, tecnologia e treinamento"
                fetchPriority="high"
              />
              <div className="cp-partner-highlight">
                <span>Sua parceria continua rendendo.</span>
                <strong>20% a 30%</strong>
                <span>de comissão-base para divulgadores</span>
                <small>
                  Embaixadores por convite: 35%. Consulte as regras e o
                  acelerador abaixo.
                </small>
              </div>
            </div>
          </div>
        </section>
        <section id="programa" className="cp-section">
          <div className="cp-container">
            <div className="cp-section-head">
              <div>
                <p className="cp-eyebrow">
                  Uma indicação, novas possibilidades
                </p>
                <h2 className="cp-heading">
                  Você abre a conversa.
                  <br />A parceria faz o resto.
                </h2>
              </div>
              <p
                className="cp-subtitle"
                style={{ maxWidth: 330, fontSize: 14 }}
              >
                Da primeira indicação ao acompanhamento da sua carteira: entenda
                o caminho.
              </p>
            </div>
            <div className="cp-steps">
              {PASSOS.map((passo, i) => (
                <div className="cp-step" key={passo.titulo}>
                  <div className="cp-step-number">
                    0{i + 1}
                    {passo.icon}
                  </div>
                  <h3>{passo.titulo}</h3>
                  <p>{passo.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section id="comissoes" className="cp-section cp-soft">
          <div className="cp-container">
            <p className="cp-eyebrow">Uma parceria que evolui</p>
            <div className="cp-section-head">
              <h2 className="cp-heading">
                Sua carteira cresce.
                <br />
                Sua comissão acompanha.
              </h2>
              <p
                className="cp-subtitle"
                style={{ maxWidth: 340, fontSize: 14 }}
              >
                Comece com 20% de comissão-base e avance conforme os clientes
                indicados permanecem ativos.
              </p>
            </div>
            <div className="cp-levels">
              {NIVEIS.map((nivel) => (
                <div className="cp-level" key={nivel.nivel}>
                  <h3>{nivel.nivel}</h3>
                  <strong>{nivel.comissao}</strong>
                  <p>{nivel.clientes}</p>
                  <small>{nivel.turbo}</small>
                </div>
              ))}
            </div>
            <p className="cp-fine-print">
              Comissões somente sobre assinaturas ativas do Gestão Pro. Plano
              grátis, WhatsApp, IA e outros serviços extras não entram no
              cálculo. A faixa Embaixador da Marca é exclusiva para convidados.
            </p>
          </div>
        </section>
        <section className="cp-section">
          <div className="cp-container cp-split">
            <div>
              <p className="cp-eyebrow">Veja na prática</p>
              <h2 className="cp-heading">
                Uma indicação pode
                <br />
                continuar gerando valor.
              </h2>
              <p className="cp-subtitle">
                A comissão é recorrente enquanto o personal indicado permanecer
                ativo no Gestão Pro. Estes exemplos consideram o plano mensal de
                R$39,90.
              </p>
              <a
                className="cp-text-link"
                href={WA_DIVULGADOR}
                target="_blank"
                rel="noopener noreferrer"
                style={{ marginTop: 25 }}
              >
                Converse com a equipe <ArrowRight size={15} />
              </a>
            </div>
            <div>
              <div
                className="cp-table-wrap"
                tabIndex={0}
                role="region"
                aria-label="Exemplos de comissão mensal"
              >
                <table className="cp-table">
                  <thead>
                    <tr>
                      <th scope="col">Clientes ativos</th>
                      <th scope="col">Comissão</th>
                      <th scope="col">Ganho mensal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SIMULACAO.map((item) => (
                      <tr key={item.clientes}>
                        <td>{item.clientes}</td>
                        <td>{item.comissao}</td>
                        <td>{item.ganho}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="cp-fine-print">
                Simulação ilustrativa, sem garantia de ganhos. A seta indica o
                acelerador de +5 pontos percentuais no mês com 2 ou mais vendas
                novas. A comissão de 35% exige convite para Embaixador.
              </p>
            </div>
          </div>
        </section>
        <section className="cp-section cp-dark">
          <div className="cp-container cp-split">
            <div>
              <p className="cp-eyebrow">Embaixadores da marca</p>
              <h2 className="cp-heading">
                Sua voz pode ir
                <br />
                ainda mais longe.
              </h2>
              <p className="cp-subtitle">
                Um programa por convite para quem cria conteúdo, acompanha os
                primeiros passos dos indicados e participa de perto da evolução
                do CoachPilot.
              </p>
              <a
                className="cp-button"
                href={WA_EMBAIXADOR}
                target="_blank"
                rel="noopener noreferrer"
                style={{ marginTop: 28 }}
              >
                Conversar sobre parceria <ArrowRight size={16} />
              </a>
            </div>
            <div>
              <h3 style={{ fontSize: 17, marginBottom: 20 }}>
                Mais proximidade. Mais possibilidades.
              </h3>
              <ul className="cp-check-list">
                {[
                  'Comissão de 35%, a maior do programa',
                  'Assinatura Gestão Pro bonificada e cupom exclusivo',
                  'Acesso antecipado a novidades e destaque como parceiro',
                  'Produção de 2 conteúdos por mês sobre o CoachPilot',
                  'Uso da plataforma, apoio aos indicados e feedbacks',
                ].map((item) => (
                  <li key={item}>
                    <Check />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="cp-caption">
                Benefícios e contrapartidas do programa Embaixador da Marca.
              </p>
            </div>
          </div>
        </section>
        <section className="cp-section">
          <div className="cp-container">
            <p className="cp-eyebrow">Transparência desde o início</p>
            <h2 className="cp-heading">Uma parceria com regras claras.</h2>
            <ol className="cp-rules">
              {REGRAS.map((regra, i) => (
                <li key={regra}>
                  <span>{String(i + 1).padStart(2, '0')}</span>
                  {regra}
                </li>
              ))}
            </ol>
          </div>
        </section>
        <section className="cp-section cp-soft">
          <div className="cp-container cp-faq-layout">
            <div>
              <p className="cp-eyebrow">Ficou alguma dúvida?</p>
              <h2 className="cp-heading">
                Vamos esclarecer
                <br />
                antes de começar.
              </h2>
              <a
                className="cp-text-link"
                href={WA_ENTRAR}
                target="_blank"
                rel="noopener noreferrer"
              >
                Falar com a equipe <ArrowRight size={15} />
              </a>
            </div>
            <div className="cp-faq-list">
              {FAQS.map((faq) => (
                <details key={faq.pergunta}>
                  <summary>{faq.pergunta}</summary>
                  <p>{faq.resposta}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
        <section className="cp-final">
          <div className="cp-container cp-final-inner">
            <div>
              <p className="cp-eyebrow">Vamos dar o primeiro passo</p>
              <h2 className="cp-heading">
                Conecte sua rede
                <br />a novas possibilidades.
              </h2>
              <p>
                Converse com a equipe e solicite seu link ou cupom de
                divulgação.
              </p>
            </div>
            <div>
              <a
                className="cp-button"
                href={WA_DIVULGADOR}
                target="_blank"
                rel="noopener noreferrer"
              >
                Quero fazer parte <ArrowRight size={17} />
              </a>
              <a
                href="https://divulgador.coachpilot.com.br"
                className="cp-text-link"
                style={{ display: 'flex', marginTop: 17, fontSize: 12 }}
              >
                Já sou divulgador: acessar meu painel <TrendingUp size={14} />
              </a>
            </div>
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  )
}
