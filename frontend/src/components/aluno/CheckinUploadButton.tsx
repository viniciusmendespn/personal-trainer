import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Camera, Loader2 } from 'lucide-react'
import { Button, useToast } from '../ui'
import { enviarCheckin } from '../../api/alunoApp'
import { MediaValidationError } from '../../utils/media'

/** Botão reutilizável de upload da foto de check-in de uma sessão (câmera ou galeria).
 * Serve tanto pro fluxo pós-treino quanto pro "enviar depois" (calendário/lista). */
export function CheckinUploadButton({
  sessaoId,
  label = 'Adicionar foto de check-in',
  variant = 'energy',
  className = 'w-full',
  onDone,
}: {
  sessaoId: string
  label?: string
  variant?: 'energy' | 'outline' | 'primary' | 'ghost'
  className?: string
  onDone?: () => void
}) {
  const qc = useQueryClient()
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleFile(file: File) {
    setUploading(true)
    try {
      await enviarCheckin(sessaoId, file)
      qc.invalidateQueries({ queryKey: ['aluno-sessoes'] })
      qc.invalidateQueries({ queryKey: ['aluno-historico-mes'] })
      setDone(true)
      toast.show('Check-in registrado! 📸', 'success')
      onDone?.()
    } catch (err) {
      const msg = err instanceof MediaValidationError ? err.message : 'Não consegui enviar a foto. Tenta de novo.'
      toast.show(msg, 'error')
    } finally {
      setUploading(false)
    }
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) handleFile(file)
  }

  return (
    <>
      <Button variant={variant} className={className} disabled={uploading || done} onClick={() => inputRef.current?.click()}>
        <span className="flex items-center justify-center gap-1.5">
          {uploading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
          {uploading ? 'Enviando…' : done ? 'Enviado!' : label}
        </span>
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onChange}
        disabled={uploading}
      />
    </>
  )
}
