import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { personalChatApi, type ChatPage } from '../api/personalChat'
import { treinosApi } from '../api/treinos'
import type { ChatMensagem } from '../types'
import { prepareMediaForUpload, MEDIA_CACHE_CONTROL } from '../utils/media'

export function usePersonalChat(alunoId: string | null) {
  const query = useInfiniteQuery({
    queryKey: ['personal-chat', alunoId],
    queryFn: ({ pageParam }: { pageParam?: string }) => personalChatApi.history(alunoId!, { cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    enabled: !!alunoId,
    refetchInterval: alunoId ? 15_000 : false,
  })
  // páginas vêm da mais recente p/ a mais antiga; inverter p/ exibir a thread em ordem cronológica
  const messages = query.data?.pages.slice().reverse().flatMap((p) => p.items)
  // agente_habilitado vem sempre da página mais recente (primeira carregada = mais recente)
  const agenteHabilitado = query.data?.pages[0]?.agente_habilitado ?? false
  return { ...query, messages, agenteHabilitado }
}

export function useToggleAgenteHabilitado(alunoId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (habilitado: boolean) => personalChatApi.setAgenteHabilitado(alunoId!, habilitado),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['personal-chat', alunoId] })
      qc.invalidateQueries({ queryKey: ['aluno', alunoId] })
      qc.invalidateQueries({ queryKey: ['alunos'] })
    },
  })
}

export function useSendPersonalChat(alunoId: string | null) {
  const qc = useQueryClient()
  const key = ['personal-chat', alunoId]
  return useMutation({
    mutationFn: (text: string) => personalChatApi.send(alunoId!, text),
    onMutate: (text: string) => {
      const optimistic: ChatMensagem = {
        mensagem_id: `optimistic-${Date.now()}`,
        aluno_id: alunoId ?? '',
        role: 'user',
        texto: text,
        ator: 'PERSONAL',
        canal_origem: 'PORTAL',
        data_hora: new Date().toISOString(),
        direto: true,
      }
      qc.setQueryData<{ pages: ChatPage[]; pageParams: unknown[] }>(key, (old) => {
        if (!old) return old
        const [mostRecent, ...rest] = old.pages
        return { ...old, pages: [{ ...mostRecent, items: [...mostRecent.items, optimistic] }, ...rest] }
      })
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })
}

export function useEnviarCorrecao(alunoId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      file, exercicioId, exercicioNome, texto,
    }: { file: File; exercicioId: string; exercicioNome?: string; texto?: string }) => {
      const prepared = await prepareMediaForUpload(file)
      const tipo = prepared.type.startsWith('video') ? 'video_correcao' : 'foto_correcao'
      const { upload_url, s3_key } = await treinosApi.uploadUrlMidia(alunoId!, prepared.name, prepared.type)
      await fetch(upload_url, { method: 'PUT', body: prepared, headers: { 'Content-Type': prepared.type, 'Cache-Control': MEDIA_CACHE_CONTROL } })
      return treinosApi.enviarCorrecao(alunoId!, {
        s3_key, tipo, exercicio_id: exercicioId, exercicio_nome: exercicioNome, texto,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['personal-chat', alunoId] })
      qc.invalidateQueries({ queryKey: ['midia-exercicio', alunoId] })
    },
  })
}
