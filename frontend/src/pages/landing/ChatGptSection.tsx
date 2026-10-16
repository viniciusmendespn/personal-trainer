import { ArrowRight, Check, Sparkles } from 'lucide-react'
import { CHATGPT_APP_URL } from '../../lib/links'
export default function ChatGptSection() {
  return (
    <section id="chatgpt" className="cp-section cp-dark">
      <div className="cp-container cp-split">
        <div>
          <p className="cp-eyebrow">Seu novo jeito de trabalhar</p>
          <h2 className="cp-heading">
            Sua gestão também
            <br />
            pode começar com
            <br />
            uma conversa.
          </h2>
          <p className="cp-subtitle">
            Conecte o CoachPilot ao ChatGPT e converse com os dados da sua
            própria carteira. Consulte alunos, prepare sessões e monte treinos
            com mais contexto.
          </p>
          <ul className="cp-check-list">
            <li>
              <Check /> Conexão incluída nos planos grátis e Gestão Pro
            </li>
            <li>
              <Check /> Alterações com histórico e opção de desfazer
            </li>
            <li>
              <Check /> Também funciona com Claude e Gemini
            </li>
          </ul>
          <a
            href={CHATGPT_APP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="cp-button"
          >
            Conhecer o app no ChatGPT <ArrowRight size={16} />
          </a>
          <p className="cp-caption">
            Crie sua conta CoachPilot, abra o app e autorize a conexão.
          </p>
        </div>
        <div>
          <div className="cp-chat">
            <div className="cp-chat-top">
              <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Sparkles size={15} color="#77e4bb" /> CoachPilot + sua IA
              </span>
              <span>Exemplo de conversa</span>
            </div>
            <div className="cp-chat-body">
              <div className="cp-chat-bubble">
                Como está a evolução da Carla no agachamento?
              </div>
              <div className="cp-chat-reply">
                <strong>
                  <Sparkles size={15} /> Vamos olhar o histórico da Carla.
                </strong>
                Aqui está uma visão das cargas registradas nas últimas sessões:
                <div className="cp-chat-data">
                  <div>
                    <span>Primeiro registro</span>
                    <b>30 kg</b>
                  </div>
                  <div>
                    <span>Registro mais recente</span>
                    <b>40 kg</b>
                  </div>
                  <div>
                    <span>Próximo passo</span>
                    <b>Revisar o planejamento</b>
                  </div>
                </div>
                Você pode consultar o treino atual e avaliar os próximos
                ajustes.
              </div>
              <p className="cp-caption">
                Conversa e dados ilustrativos. Você conduz a prescrição.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
