import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link2, Copy, Check } from 'lucide-react'
import { personalApi, type PersonalProfile } from '../api/personal'
import { AvatarUpload, Button, Card, Input, RichTextContent, RichTextEditor, SocialLinks, Spinner, useToast } from '../components/ui'

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
  const [instagram, setInstagram] = useState('')
  const [tiktok, setTiktok] = useState('')
  const [youtube, setYoutube] = useState('')
  const [linkedin, setLinkedin] = useState('')
  const [facebook, setFacebook] = useState('')
  const [x, setX] = useState('')
  const [site, setSite] = useState('')

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
    setInstagram(profile?.instagram_url ?? '')
    setTiktok(profile?.tiktok_url ?? '')
    setYoutube(profile?.youtube_url ?? '')
    setLinkedin(profile?.linkedin_url ?? '')
    setFacebook(profile?.facebook_url ?? '')
    setX(profile?.x_url ?? '')
    setSite(profile?.site_url ?? '')
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
      instagram_url: instagram || undefined,
      tiktok_url: tiktok || undefined,
      youtube_url: youtube || undefined,
      linkedin_url: linkedin || undefined,
      facebook_url: facebook || undefined,
      x_url: x || undefined,
      site_url: site || undefined,
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
          <SocialLinks
            instagramUrl={profile?.instagram_url}
            tiktokUrl={profile?.tiktok_url}
            youtubeUrl={profile?.youtube_url}
            linkedinUrl={profile?.linkedin_url}
            facebookUrl={profile?.facebook_url}
            xUrl={profile?.x_url}
            siteUrl={profile?.site_url}
          />
        )}
        {!editing && (
          <Button variant="outline" size="sm" onClick={startEdit}>Editar perfil</Button>
        )}
      </Card>

      {!editing && <LinkCaptacaoCard slug={profile?.slug} />}

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
            <RichTextEditor
              label="Sobre mim"
              value={biografia}
              onChange={setBiografia}
              placeholder="Conte um pouco sobre você..."
            />
            <RichTextEditor
              label="Experiência profissional"
              value={experiencia}
              onChange={setExperiencia}
              placeholder="Sua trajetória, clientes atendidos, especializações..."
            />
            <RichTextEditor
              label="Formação"
              value={formacao}
              onChange={setFormacao}
              placeholder="Graduações, certificações, cursos..."
            />
            <div className="pt-2">
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">Redes sociais</p>
              <div className="space-y-4">
                <Input label="Instagram" value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="https://instagram.com/seuusuario" />
                <Input label="TikTok" value={tiktok} onChange={(e) => setTiktok(e.target.value)} placeholder="https://tiktok.com/@seuusuario" />
                <Input label="YouTube" value={youtube} onChange={(e) => setYoutube(e.target.value)} placeholder="https://youtube.com/@seucanal" />
                <Input label="LinkedIn" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="https://linkedin.com/in/seuusuario" />
                <Input label="Facebook" value={facebook} onChange={(e) => setFacebook(e.target.value)} placeholder="https://facebook.com/suapagina" />
                <Input label="X (Twitter)" value={x} onChange={(e) => setX(e.target.value)} placeholder="https://x.com/seuusuario" />
                <Input label="Site / Linktree" value={site} onChange={(e) => setSite(e.target.value)} placeholder="https://seusite.com" />
              </div>
            </div>
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
              <RichTextContent html={profile.biografia} />
            </Card>
          )}
          {profile.experiencia_profissional && (
            <Card variant="elevated">
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">Experiência profissional</p>
              <RichTextContent html={profile.experiencia_profissional} />
            </Card>
          )}
          {profile.formacao && (
            <Card variant="elevated">
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">Formação</p>
              <RichTextContent html={profile.formacao} />
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

function CopyButton({ text, label = 'Copiar' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        navigator.clipboard?.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? 'Copiado' : label}
    </Button>
  )
}

function LinkCaptacaoCard({ slug }: { slug?: string }) {
  const qc = useQueryClient()
  const { show } = useToast()
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://coachpilot.com.br'

  const [editando, setEditando] = useState(!slug)
  const [valor, setValor] = useState(slug ?? '')
  const [fonte, setFonte] = useState('')

  const salvar = useMutation({
    mutationFn: (s: string) => personalApi.setSlug(s),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['personal-profile'] })
      setEditando(false)
      show('Link de captação salvo!', 'success')
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { detail?: { message?: string } | string } } }
      const detail = err.response?.data?.detail
      const msg = typeof detail === 'string' ? detail : detail?.message
      show(msg || 'Não foi possível salvar o link.', 'error')
    },
  })

  const link = slug ? `${origin}/@${slug}` : ''
  const linkComFonte = slug && fonte.trim()
    ? `${link}?fonte=${encodeURIComponent(fonte.trim().toLowerCase().replace(/\s+/g, '-'))}`
    : ''

  return (
    <Card variant="elevated" className="space-y-3">
      <div className="flex items-center gap-2">
        <Link2 size={16} className="text-accent-hover" />
        <p className="font-semibold text-text">Seu link de captação</p>
      </div>
      <p className="text-xs text-text-secondary">
        Divulgue este link (bio do Instagram, anúncios, WhatsApp). Quem preencher vira um lead
        na aba <span className="text-text">Captação</span> e você recebe uma notificação.
      </p>

      {editando ? (
        <form
          onSubmit={(e) => { e.preventDefault(); if (valor.trim()) salvar.mutate(valor.trim().toLowerCase()) }}
          className="space-y-2"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-muted shrink-0">{origin}/@</span>
            <div className="flex-1">
              <Input
                value={valor}
                onChange={(e) => setValor(e.target.value.toLowerCase())}
                placeholder="seunome"
              />
            </div>
          </div>
          <p className="text-[11px] text-text-muted">3 a 30 letras minúsculas, números ou hífen.</p>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={!valor.trim() || salvar.isPending}>
              {salvar.isPending ? 'Salvando…' : 'Salvar link'}
            </Button>
            {slug && (
              <Button type="button" variant="ghost" size="sm" onClick={() => { setValor(slug); setEditando(false) }}>
                Cancelar
              </Button>
            )}
          </div>
        </form>
      ) : (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <code className="text-sm text-accent-hover bg-accent/10 rounded px-2 py-1 break-all">{link}</code>
            <CopyButton text={link} />
            <Button variant="ghost" size="sm" onClick={() => setEditando(true)}>Editar</Button>
          </div>

          <div className="pt-2 border-t border-border">
            <p className="text-xs font-medium text-text-secondary mb-1.5">Gerar link com rastreamento de origem</p>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex-1 min-w-[160px]">
                <Input
                  value={fonte}
                  onChange={(e) => setFonte(e.target.value)}
                  placeholder="ex.: instagram, bio, anuncio-fb"
                />
              </div>
              {linkComFonte && <CopyButton text={linkComFonte} label="Copiar com fonte" />}
            </div>
            {linkComFonte && (
              <code className="block mt-2 text-xs text-text-muted break-all">{linkComFonte}</code>
            )}
          </div>
        </>
      )}
    </Card>
  )
}
