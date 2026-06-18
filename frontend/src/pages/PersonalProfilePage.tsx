import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { personalApi, type PersonalProfile } from '../api/personal'
import { AvatarUpload, Button, Card, Input, Spinner, Textarea, useToast } from '../components/ui'

export function PersonalProfilePage() {
  const qc = useQueryClient()
  const { show } = useToast()

  const { data: profile, isLoading } = useQuery({
    queryKey: ['personal-profile'],
    queryFn: personalApi.getProfile,
  })

  const [editing, setEditing] = useState(false)
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [biografia, setBiografia] = useState('')
  const [experiencia, setExperiencia] = useState('')
  const [formacao, setFormacao] = useState('')

  const update = useMutation({
    mutationFn: (body: Omit<PersonalProfile, 'personal_id' | 'foto_url' | 'updated_at'>) =>
      personalApi.updateProfile(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['personal-profile'] })
      setEditing(false)
      show('Perfil atualizado.', 'success')
    },
    onError: () => show('Erro ao salvar perfil.', 'error'),
  })

  const saveAvatar = useMutation({
    mutationFn: (s3Key: string) => personalApi.updateProfile({ foto_s3_key: s3Key }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['personal-profile'] })
      show('Foto atualizada.', 'success')
    },
  })

  function startEdit() {
    setNome(profile?.nome ?? '')
    setDescricao(profile?.descricao ?? '')
    setBiografia(profile?.biografia ?? '')
    setExperiencia(profile?.experiencia_profissional ?? '')
    setFormacao(profile?.formacao ?? '')
    setEditing(true)
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    update.mutate({
      nome: nome || undefined,
      descricao: descricao || undefined,
      biografia: biografia || undefined,
      experiencia_profissional: experiencia || undefined,
      formacao: formacao || undefined,
    })
  }

  if (isLoading) return <div className="flex justify-center pt-12"><Spinner /></div>

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <h2 className="font-display text-xl font-semibold">Meu Perfil</h2>

      <Card variant="elevated" className="flex flex-col items-center gap-4 py-6">
        <AvatarUpload
          name={profile?.nome ?? 'Personal'}
          currentUrl={profile?.foto_url}
          size="lg"
          getUploadUrl={(filename, contentType) =>
            personalApi.avatarUploadUrl(filename, contentType)
          }
          onSuccess={(s3Key) => saveAvatar.mutate(s3Key)}
          onError={() => show('Erro ao enviar foto.', 'error')}
        />
        <div className="text-center">
          <p className="font-semibold text-text">{profile?.nome ?? '—'}</p>
          {profile?.descricao && (
            <p className="text-sm text-text-secondary mt-0.5">{profile.descricao}</p>
          )}
        </div>
        {!editing && (
          <Button variant="outline" size="sm" onClick={startEdit}>Editar perfil</Button>
        )}
      </Card>

      {editing && (
        <Card variant="elevated">
          <form onSubmit={handleSave} className="space-y-4">
            <Input label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} />
            <Input
              label="Descrição curta"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex.: Personal trainer especializado em emagrecimento"
            />
            <Textarea
              label="Sobre mim"
              rows={4}
              value={biografia}
              onChange={(e) => setBiografia(e.target.value)}
              placeholder="Conte um pouco sobre você..."
            />
            <Textarea
              label="Experiência profissional"
              rows={4}
              value={experiencia}
              onChange={(e) => setExperiencia(e.target.value)}
              placeholder="Sua trajetória, clientes atendidos, especializações..."
            />
            <Textarea
              label="Formação"
              rows={3}
              value={formacao}
              onChange={(e) => setFormacao(e.target.value)}
              placeholder="Graduações, certificações, cursos..."
            />
            <div className="flex gap-2 pt-1">
              <Button type="submit" disabled={update.isPending}>Salvar</Button>
              <Button type="button" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
            </div>
          </form>
        </Card>
      )}

      {!editing && (profile?.biografia || profile?.experiencia_profissional || profile?.formacao) && (
        <div className="space-y-4">
          {profile.biografia && (
            <Card variant="elevated">
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">Sobre mim</p>
              <p className="text-sm text-text whitespace-pre-wrap">{profile.biografia}</p>
            </Card>
          )}
          {profile.experiencia_profissional && (
            <Card variant="elevated">
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">Experiência profissional</p>
              <p className="text-sm text-text whitespace-pre-wrap">{profile.experiencia_profissional}</p>
            </Card>
          )}
          {profile.formacao && (
            <Card variant="elevated">
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">Formação</p>
              <p className="text-sm text-text whitespace-pre-wrap">{profile.formacao}</p>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
