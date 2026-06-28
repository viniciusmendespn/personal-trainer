import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { rotinasApi } from '../api/rotinas'
import type { RotinaCreate, AplicarRotinaModo } from '../types'

const KEY = ['rotinas']

export function useRotinas(includeInactive = false) {
  return useQuery({
    queryKey: [...KEY, { includeInactive }],
    queryFn: () => rotinasApi.list(includeInactive),
  })
}

export function useCreateRotina() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: RotinaCreate) => rotinasApi.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useCreateRotinaFromAluno() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ alunoId, nome, salvarTemplates }: { alunoId: string; nome?: string; salvarTemplates?: boolean }) =>
      rotinasApi.fromAluno(alunoId, nome, salvarTemplates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
      qc.invalidateQueries({ queryKey: ['templates'] })
    },
  })
}

export function useCreateRotinaFromTemplates() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ nome, templateIds, descricao }: { nome: string; templateIds: string[]; descricao?: string }) =>
      rotinasApi.fromTemplates(nome, templateIds, descricao),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useUpdateRotina() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: RotinaCreate }) => rotinasApi.update(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeleteRotina() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => rotinasApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useAplicarRotina() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, alunoIds, modo }: { id: string; alunoIds: string[]; modo: AplicarRotinaModo }) =>
      rotinasApi.aplicar(id, alunoIds, modo),
    onSuccess: (_r, vars) => {
      vars.alunoIds.forEach((alunoId) => qc.invalidateQueries({ queryKey: ['treinos', alunoId] }))
    },
  })
}
