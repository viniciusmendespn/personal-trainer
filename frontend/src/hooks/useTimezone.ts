import { useQuery } from '@tanstack/react-query'
import { personalApi } from '../api/personal'
import { fusoDoAparelho } from '../utils/datetime'

/** Fuso IANA configurado pelo personal, com o do aparelho como fallback.
 *
 * Reaproveita a chave `['personal-profile']` que o AppLayout já mantém quente — o hook não
 * adiciona request nenhum às telas que o usarem.
 *
 * Por que o configurado e não o do aparelho: quando o personal viaja, o compromisso das 8h
 * continua sendo às 8h do fuso em que ele atende, e é assim que ele quer ver a agenda.
 * Detalhes em `docs/TIMEZONE.md` §4. */
export function useTimezone(): string {
  const { data } = useQuery({
    queryKey: ['personal-profile'],
    queryFn: personalApi.getProfile,
    staleTime: 300_000,
  })
  return data?.timezone || fusoDoAparelho()
}
