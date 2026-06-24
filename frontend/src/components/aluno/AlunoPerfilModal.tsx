import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Sun, Moon, Monitor } from 'lucide-react'
import { alunoApi } from '../../api/alunoApp'
import { AvatarUpload, Button, Input, Modal, Textarea, useToast } from '../ui'
import { useTheme, type ThemeChoice } from '../../context/ThemeContext'

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

  const { theme, setTheme } = useTheme()
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

        <div className="w-full">
          <p className="text-xs text-text-muted mb-2">Tema</p>
          <div className="flex gap-2">
            {([
              { id: 'system' as ThemeChoice, icon: Monitor, label: 'Auto' },
              { id: 'light'  as ThemeChoice, icon: Sun,     label: 'Claro' },
              { id: 'dark'   as ThemeChoice, icon: Moon,    label: 'Escuro' },
            ]).map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTheme(id)}
                className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-lg border text-xs transition-all ${
                  theme === id
                    ? 'border-energy bg-energy/10 text-energy'
                    : 'border-border text-text-muted hover:border-border-strong hover:text-text'
                }`}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </div>
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
