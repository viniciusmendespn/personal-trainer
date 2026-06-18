import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { alunoApi } from '../../api/alunoApp'
import { AvatarUpload, Button, Input, Modal, Textarea, useToast } from '../ui'

interface Props {
  isOpen: boolean
  onClose: () => void
  nome?: string
  descricao?: string
  foto_url?: string
}

export function AlunoPerfilModal({ isOpen, onClose, nome: nomeProp, descricao: descricaoProp, foto_url }: Props) {
  const qc = useQueryClient()
  const { show } = useToast()

  const [nome, setNome] = useState(nomeProp ?? '')
  const [descricao, setDescricao] = useState(descricaoProp ?? '')

  useEffect(() => {
    if (isOpen) {
      setNome(nomeProp ?? '')
      setDescricao(descricaoProp ?? '')
    }
  }, [isOpen, nomeProp, descricaoProp])

  const saveAvatar = useMutation({
    mutationFn: (s3Key: string) => alunoApi.updateMe({ foto_s3_key: s3Key }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['aluno-me'] })
      show('Foto atualizada.', 'success')
    },
    onError: () => show('Erro ao salvar foto.', 'error'),
  })

  const update = useMutation({
    mutationFn: () => alunoApi.updateMe({ nome: nome.trim() || undefined, descricao: descricao.trim() || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['aluno-me'] })
      show('Perfil atualizado.', 'success')
      onClose()
    },
    onError: () => show('Erro ao salvar perfil.', 'error'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    update.mutate()
  }

  return (
    <Modal open={isOpen} onClose={onClose} title="Meu Perfil">
      <form onSubmit={handleSubmit} className="flex flex-col items-center gap-4">
        <AvatarUpload
          name={nome || 'Aluno'}
          currentUrl={foto_url}
          size="lg"
          getUploadUrl={(filename, contentType) => alunoApi.meAvatarUploadUrl(filename, contentType)}
          onSuccess={(s3Key) => saveAvatar.mutate(s3Key)}
          onError={() => show('Erro ao enviar foto.', 'error')}
        />
        <p className="text-xs text-text-muted -mt-2">Toque na foto para alterar</p>

        <div className="w-full space-y-3">
          <Input
            label="Nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
          />
          <Textarea
            label="Descrição"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Uma frase sobre você (opcional)"
            rows={2}
          />
        </div>

        <div className="flex gap-2 w-full pt-1">
          <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" className="flex-1" disabled={update.isPending || !nome.trim()}>
            {update.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
