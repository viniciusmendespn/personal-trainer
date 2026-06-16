import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { alunosApi, type AlunoUpdate } from '../api/alunos'
import type { AlunoCreate } from '../types'

const KEY = ['alunos']

export function useAlunos() {
  return useQuery({ queryKey: KEY, queryFn: alunosApi.list })
}

export function useAluno(id: string) {
  return useQuery({ queryKey: ['aluno', id], queryFn: () => alunosApi.get(id), enabled: !!id })
}

export function useCreateAluno() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: AlunoCreate) => alunosApi.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useUpdateAluno(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: AlunoUpdate) => alunosApi.update(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
      qc.invalidateQueries({ queryKey: ['aluno', id] })
    },
  })
}

export function useDeleteAluno() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => alunosApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}
