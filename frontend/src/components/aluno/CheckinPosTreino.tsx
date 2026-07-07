import { Trophy, Dumbbell, Clock, PartyPopper, Timer } from 'lucide-react'
import { Modal } from '../ui'
import { type SessaoFinalizada } from '../../api/alunoApp'
import { CheckinUploadButton } from './CheckinUploadButton'
import { formatDuracao } from '../../utils/datetime'
import { fmtScoreWod, fmtScoreValor } from '../../utils/wod'

function formatVolume(v?: number): string | null {
  if (!v || v <= 0) return null
  if (v >= 1000) return `${(v / 1000).toFixed(1).replace('.', ',')} t`
  return `${Math.round(v)} kg`
}

/** Tela de comemoração ao finalizar o treino: mostra os destaques do dia e convida o aluno a
 * registrar uma foto de check-in (escolhida da galeria — o seletor do Android também oferece a
 * câmera) — combustível pro engajamento. Galeria evita o OOM da foto full-res da câmera no S23. */
export function CheckinPosTreino({ sessao, onClose }: { sessao: SessaoFinalizada; onClose: () => void }) {
  const duracao = formatDuracao(sessao.duracao_segundos)
  const volume = formatVolume(sessao.volume_total)
  const prs = sessao.novos_prs ?? []
  const scores = sessao.scores_blocos ?? []

  return (
    <Modal open onClose={onClose} title="">
      <div className="space-y-5 text-center">
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-energy/15 text-energy">
            <PartyPopper size={28} />
          </div>
          <h2 className="font-display text-lg font-semibold">Treino concluído! 💪</h2>
          <p className="text-sm text-text-muted">{sessao.treino_nome}</p>
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          {duracao && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-surface-elevated border border-border px-2.5 py-1.5 text-sm">
              <Clock size={14} className="text-info" /> {duracao}
            </span>
          )}
          {volume && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-surface-elevated border border-border px-2.5 py-1.5 text-sm">
              <Dumbbell size={14} className="text-accent" /> {volume}
            </span>
          )}
          {prs.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-warning/10 border border-warning/30 text-warning px-2.5 py-1.5 text-sm font-medium">
              <Trophy size={14} /> {prs.length} novo{prs.length > 1 ? 's' : ''} PR{prs.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {scores.length > 0 && (
          <ul className="text-left text-xs text-text-secondary space-y-1 max-w-xs mx-auto">
            {scores.map((sc, i) => (
              <li key={i} className="flex items-center gap-1.5 rounded-lg bg-energy/10 border border-energy/30 px-2.5 py-1.5">
                <Timer size={12} className="text-energy shrink-0" />
                <span className="truncate">{sc.bloco_nome || sc.nome}</span>
                <span className="ml-auto font-semibold text-text whitespace-nowrap">
                  {fmtScoreWod(sc)}
                  <span className={`ml-1.5 text-[10px] font-medium ${sc.rx ? 'text-energy' : 'text-text-muted'}`}>
                    {sc.rx ? 'RX' : 'Adaptado'}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}

        {prs.length > 0 && (
          <ul className="text-left text-xs text-text-secondary space-y-0.5 max-w-xs mx-auto">
            {prs.slice(0, 4).map((pr, i) => (
              <li key={i} className="flex items-center gap-1.5">
                <Trophy size={11} className="text-warning shrink-0" />
                <span className="truncate">{pr.exercicio_nome}</span>
                <span className="ml-auto font-medium text-text">
                  {pr.tipo === 'WOD'
                    ? fmtScoreValor(pr.formato, pr.carga)
                    : <>{pr.carga}{pr.unidade ? ` ${pr.unidade}` : (pr.tipo === 'PERFORMANCE' ? '' : ' kg')}</>}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="pt-1 space-y-2">
          <p className="text-sm text-text-secondary">Registre seu check-in de hoje pra acompanhar sua evolução e mostrar no seu histórico.</p>
          <CheckinUploadButton
            sessaoId={sessao.sessao_id}
            label="Escolher foto do check-in"
            onDone={() => setTimeout(onClose, 900)}
          />
          <button
            className="w-full text-sm text-text-muted hover:text-text transition-colors py-1"
            onClick={onClose}
          >
            Agora não
          </button>
        </div>
      </div>
    </Modal>
  )
}
