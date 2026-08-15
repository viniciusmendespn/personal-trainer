import { useQuery } from '@tanstack/react-query'
import { pendenciasApi } from '../api/pendencias'

export const PENDENCIAS_KEY = (alunoId: string) => ['pendencias', alunoId]

/** Pendências do aluno (aba do cadastro + badge da aba). São derivadas no backend a cada
 *  leitura, então não há invalidação a fazer além das ações que mudam a causa. */
export function usePendenciasAluno(alunoId: string) {
  return useQuery({
    queryKey: PENDENCIAS_KEY(alunoId),
    queryFn: () => pendenciasApi.doAluno(alunoId),
    enabled: !!alunoId,
  })
}
