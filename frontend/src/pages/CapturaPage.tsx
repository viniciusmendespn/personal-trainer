import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { CheckCircle, Loader2 } from 'lucide-react'
import { capturaApi, type CapturaPerfil } from '../api/captura'
import { Button, Input, Spinner, SocialLinks } from '../components/ui'
import { PhoneInput } from '../components/PhoneInput'
import { RodapeFormPublico } from '../components/RodapeFormPublico'
import { useNoIndex } from '../hooks/useNoIndex'

const OBJETIVOS = [
  'Emagrecimento', 'Hipertrofia', 'Ganho de força',
  'Condicionamento físico', 'Saúde geral', 'Outro',
]

export function CapturaPage() {
  const { handle = '' } = useParams()
  const [params] = useSearchParams()
  const fonte = params.get('fonte') ?? ''
  // No topo da rota, não dentro do CapturaFlow: vale também para o estado de erro. Como esta
  // rota é o catch-all de 1 segmento, isso também tira do índice o soft-404 de /qualquer-coisa.
  useNoIndex()

  // A rota é um catch-all de 1 segmento; só tratamos como captação URLs iniciadas por '@'.
  const isHandle = handle.startsWith('@')
  const slug = isHandle ? handle.slice(1).toLowerCase() : ''

  const { data, isLoading, isError } = useQuery({
    queryKey: ['captura-perfil', slug],
    queryFn: () => capturaApi.getPerfil(slug),
    enabled: !!slug,
    retry: false,
  })

  if (!isHandle) return <Centered><p className="text-text-secondary">Página não encontrada.</p></Centered>
  if (isLoading) return <Centered><Spinner /></Centered>
  if (isError || !data) return <Centered><p className="text-text-secondary">Página não encontrada. Verifique o link.</p></Centered>

  return <CapturaFlow slug={slug} perfil={data} fonte={fonte} />
}

function CapturaFlow({ slug, perfil, fonte }: { slug: string; perfil: CapturaPerfil; fonte: string }) {
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [objetivos, setObjetivos] = useState<string[]>([])
  const [mensagem, setMensagem] = useState('')
  const [enviado, setEnviado] = useState(false)

  const enviar = useMutation({
    mutationFn: () =>
      capturaApi.enviarLead(slug, {
        nome,
        telefone,
        objetivos: objetivos.length ? objetivos : undefined,
        mensagem: mensagem || undefined,
        fonte: fonte || undefined,
      }),
    onSuccess: () => setEnviado(true),
  })

  function toggleObjetivo(o: string) {
    setObjetivos((cur) => (cur.includes(o) ? cur.filter((x) => x !== o) : [...cur, o]))
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nome || !telefone) return
    enviar.mutate()
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center py-8 px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Perfil do personal */}
        <div className="flex flex-col items-center gap-3 text-center">
          {perfil.personal_foto_url ? (
            <img src={perfil.personal_foto_url} alt={perfil.personal_nome} className="w-20 h-20 rounded-full object-cover border-2 border-energy" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-accent/15 flex items-center justify-center text-3xl">💪</div>
          )}
          <div>
            <h1 className="font-display text-xl font-bold text-text">{perfil.personal_nome}</h1>
            {perfil.descricao && <p className="text-sm text-text-secondary mt-0.5">{perfil.descricao}</p>}
          </div>
          <SocialLinks
            instagramUrl={perfil.instagram_url}
            tiktokUrl={perfil.tiktok_url}
            youtubeUrl={perfil.youtube_url}
            linkedinUrl={perfil.linkedin_url}
            facebookUrl={perfil.facebook_url}
            xUrl={perfil.x_url}
            siteUrl={perfil.site_url}
          />
        </div>

        {enviado ? (
          <div className="flex flex-col items-center gap-4 text-center py-8">
            <CheckCircle size={48} className="text-success" />
            <h2 className="font-display text-xl font-semibold text-text">Recebemos seu contato!</h2>
            <p className="text-sm text-text-secondary">
              {perfil.personal_nome} vai falar com você em breve para montar seu plano.
            </p>
            {perfil.instagram_url && (
              <a href={perfil.instagram_url} target="_blank" rel="noopener noreferrer nofollow ugc" className="text-sm text-accent-hover hover:underline">
                Enquanto isso, siga no Instagram →
              </a>
            )}
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <h2 className="font-semibold text-text text-center">Quero começar a treinar</h2>
            <Input label="Nome completo *" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" required />
            <PhoneInput label="WhatsApp" value={telefone} onChange={setTelefone} required />
            <div>
              <span className="block text-xs font-medium text-text-secondary mb-1.5">Objetivos (opcional)</span>
              <div className="flex flex-wrap gap-2">
                {OBJETIVOS.map((o) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => toggleObjetivo(o)}
                    className={`px-3 py-1.5 text-sm rounded-lg border transition ${
                      objetivos.includes(o)
                        ? 'bg-accent text-white border-accent'
                        : 'border-border text-text-secondary hover:border-border-strong'
                    }`}
                  >{o}</button>
                ))}
              </div>
            </div>
            <div>
              <span className="block text-xs font-medium text-text-secondary mb-1.5">Mensagem (opcional)</span>
              <textarea
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                rows={3}
                placeholder="Conte um pouco sobre você, sua rotina, disponibilidade…"
                className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-text placeholder-text-muted text-sm transition-colors focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
              />
            </div>
            <Button type="submit" variant="energy" className="w-full text-base py-3" disabled={!nome || !telefone || enviar.isPending}>
              {enviar.isPending ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Quero começar'}
            </Button>
            {enviar.isError && (
              <p className="text-sm text-danger text-center">Erro ao enviar. Tente novamente.</p>
            )}
          </form>
        )}

        <RodapeFormPublico personalNome={perfil.personal_nome} tipo="lead" />
      </div>
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center p-6 text-center">{children}</div>
}
