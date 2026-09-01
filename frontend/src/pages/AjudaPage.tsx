import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { HelpCircle, ChevronDown, Download, Bot, MessageSquare, Lightbulb, Send, LifeBuoy, Plug, ExternalLink } from 'lucide-react'
import { feedbackApi } from '../api/feedback'
import { CHATGPT_APP_URL } from '../lib/links'
import { Button, useToast } from '../components/ui'

interface FaqItem {
  q: string
  a: string
}

const FAQ_PORTAL: FaqItem[] = [
  {
    q: 'Como cadastrar um novo aluno?',
    a: 'Acesse Alunos no menu → clique em "+ Novo Aluno" → preencha nome, telefone (WhatsApp), data de nascimento e objetivo → Salvar. O sistema sincroniza a foto do WhatsApp automaticamente.',
  },
  {
    q: 'Como criar um treino para o aluno?',
    a: 'Abra a página do aluno → clique em "+ Novo Treino" → preencha nome e datas de vigência → Salvar. Depois clique no treino para adicionar exercícios (séries, repetições, carga e vídeo de referência).',
  },
  {
    q: 'Como cadastrar/migrar alunos em massa com IA?',
    a: 'Na página Alunos, clique em "Importar alunos" e copie o prompt. Cole no ChatGPT (ou Claude/Gemini) junto com sua lista — planilha, CSV, PDF ou até um print. A IA devolve os dados em CSV; cole no campo do modal, confira a prévia e clique em "Importar". Telefones duplicados são pulados e linhas sem nome/telefone viram erro, sem abortar o resto.',
  },
  {
    q: 'Como atualizar o treino de um aluno com IA?',
    a: 'Na aba Treinos do aluno, clique em "Atualizar treino com IA". Baixe o JSON do treino atual e o prompt, cole ambos no ChatGPT e descreva o ajuste ("aumenta o volume de pernas", "adapta para dor no ombro" etc.). Cole o JSON atualizado de volta no modal e confirme. Atenção: a importação substitui o programa de treinos inteiro do aluno (o histórico e a evolução por exercício são preservados).',
  },
  {
    q: 'Como instalar o app do CoachPilot no ChatGPT?',
    a: 'Use o botão "Instalar no ChatGPT" no topo desta página (ou em Configurações → Conexões): ele abre o app do CoachPilot no ChatGPT, você clica no + para adicionar e autoriza com a sua conta — a senha nunca passa pelo ChatGPT. Na autorização você escolhe entre somente leitura ou leitura e escrita de treinos. Funciona também na conta gratuita do ChatGPT e no aplicativo de celular. Para usar Claude ou Gemini, copie o endereço em Configurações → Conexões e cole no aplicativo. Para cortar o acesso, use Revogar na mesma tela.',
  },
  {
    q: 'Qual a diferença entre o cadastro por IA (grátis) e o Assistente IA do aluno (add-on)?',
    a: 'São coisas diferentes. O cadastro por IA é uma ferramenta do PERSONAL: você usa o seu próprio ChatGPT para montar treinos, criar pacotes e importar alunos por linguagem natural — está incluído e é grátis. Já o Assistente IA do aluno é um add-on pago (+R$4,90/aluno/mês, "Em breve" na página Plano): é o agente que responde o ALUNO automaticamente no WhatsApp para tirar dúvidas e registrar treino. O chat do app do aluno é sempre direto com você, sem IA.',
  },
  {
    q: 'Como gerar o link de acesso do aluno ao app?',
    a: 'Na página do aluno, clique em "Gerar Link" ou "Enviar via WhatsApp". O link é único por aluno — ao abrir no celular, ele acessa o app sem precisar criar conta.',
  },
  {
    q: 'Como ver o histórico de sessões do aluno?',
    a: 'Acesse a página do aluno e role para baixo — o histórico de sessões aparece com data, exercícios e séries registradas. Clique em uma sessão para ver o detalhe completo.',
  },
  {
    q: 'Como criar uma avaliação física?',
    a: 'Acesse a página do aluno → aba "Avaliações" → "+ Nova Avaliação". Preencha peso, medidas corporais, % gordura e fotos. Com 2 ou mais avaliações, gráficos de evolução são gerados automaticamente.',
  },
  {
    q: 'Como comparar fotos before/after do aluno?',
    a: 'Na aba de avaliações do aluno, clique em "Comparar Fotos" → selecione a foto "antes" → selecione a foto "depois" → visualize as duas lado a lado.',
  },
  {
    q: 'Como criar e acompanhar metas do aluno?',
    a: 'Acesse a página do aluno → aba "Metas" → "+ Nova Meta". Escolha o tipo (Carga, Peso, Medida ou Livre), defina o valor alvo e clique em "Aprovar". A verificação é automática ao registrar PR ou nova avaliação.',
  },
  {
    q: 'Como funciona o sistema de pontos e ranking?',
    a: 'Os alunos ganham pontos por série (1pt), sessão finalizada (8pt), sessão 100% completa (+7pt), novo PR (10pt), post no feed (3pt) e meta atingida (50pt). O multiplicador de streak aumenta os pontos: 3–8 semanas = 2x, 9+ semanas = 3x. Veja o ranking em "Ranking" no menu.',
  },
  {
    q: 'Como configurar a integração com o WhatsApp?',
    a: 'Acesse Configurações → aba "WhatsApp" → insira o ID da instância e o token da W-API → clique em Conectar → escaneie o QR Code com o celular do número que ficará conectado. Esse número envia os lembretes automáticos e recebe as mensagens dos seus alunos — você é notificado de cada mensagem.',
  },
  {
    q: 'Como usar a Base de IA (Conhecimento)?',
    a: 'Acesse "Base de IA" no menu e faça upload de arquivos (PDFs, protocolos, orientações). Esses arquivos são usados como contexto pelo Assistente IA do aluno nas conversas do WhatsApp (add-on, quando ativo na sua conta).',
  },
  {
    q: 'Como funciona a anamnese (ficha de saúde)?',
    a: 'Acesse Configurações → aba "Anamnese" para criar ou editar o questionário. Um link público é gerado — envie para o aluno preencher antes do primeiro treino. As respostas ficam na página do aluno.',
  },
  {
    q: 'Como responder relatos de dor ou dúvidas do aluno?',
    a: 'Acesse "Notificações" no menu → clique na notificação de dor ou dúvida → escreva sua resposta na thread. O aluno recebe uma notificação push com a sua resposta.',
  },
  {
    q: 'Como exportar relatório em PDF do aluno?',
    a: 'Na página do aluno, clique em "Exportar PDF" (ícone de impressora). O relatório inclui avaliações com gráficos, badges conquistados e histórico de sessões recentes.',
  },
  {
    q: 'O que é o Assistente IA do aluno?',
    a: 'O Assistente IA do aluno (add-on pago, +R$4,90/aluno/mês) responde automaticamente às mensagens do aluno no WhatsApp, registra séries, responde dúvidas e alerta o personal quando necessário. Ainda não está disponível para contratação — aparece como "Em breve" na página Plano. É diferente do cadastro por IA do personal (grátis).',
  },
  {
    q: 'O aluno precisa instalar algum aplicativo?',
    a: 'Não. O app do aluno é um PWA — abre direto no navegador do celular pelo link enviado. Opcionalmente, o aluno pode "instalar" na tela inicial, mas não é obrigatório e não passa pela loja de apps.',
  },
  {
    q: 'Como funciona o campo % 1RM na prescrição?',
    a: 'Ao cadastrar um exercício de Força, preencha "1RM (kg)" com o máximo do aluno e "% 1RM" com o percentual desejado. A carga prescrita é calculada automaticamente (ex: 1RM = 100kg, % 1RM = 75 → carga = 75kg). O aluno verá a carga calculada e o percentual entre parênteses.',
  },
  {
    q: 'O que são os tipos de exercício (Força e Performance)?',
    a: 'Força: carga em kg/lb + repetições, com 1RM/%1RM e IRM. Performance: qualquer exercício medido por uma métrica numérica livre (cardio, tempo, distância, peso corporal, voltas) — você define a unidade (ex.: min, km, voltas, reps) e a direção da evolução (maior é melhor, ou menor é melhor para tempo/pace). O tipo define os campos de prescrição e como o PR/volume é calculado.',
  },
  {
    q: 'O que é o IRM e onde vejo?',
    a: 'IRM (Intensidade Relativa Média) é o percentual médio do 1RM utilizado pelo aluno em uma sessão. Aparece como gráfico na aba Evolução → Carga do aluno, quando o exercício tem 1RM cadastrado. Serve para monitorar se o aluno está treinando na intensidade prescrita.',
  },
  {
    q: 'O portal do personal pode ser instalado como app?',
    a: 'Sim. O portal também é um PWA. Clique no ícone de instalação (exibido no canto superior do portal ou na barra de endereço do navegador) para adicionar o portal na tela inicial do celular ou como app no desktop.',
  },
  {
    q: 'Como usar um código promocional?',
    a: 'Na tela de bloqueio (quando atinge o limite de 3 alunos no plano grátis) ou no modal de renovação, clique em "Tenho um código promocional", cole o código e confirme. Um código válido concede 1 mês grátis do Gestão Pro. Cada código só pode ser usado uma vez.',
  },
]

function FaqSection({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="rounded-xl border border-border bg-surface-elevated overflow-hidden">
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full flex items-start justify-between gap-3 px-4 py-3.5 text-left hover:bg-white/5 transition-colors"
          >
            <span className="text-sm font-medium text-text leading-snug">{item.q}</span>
            <ChevronDown
              size={16}
              className={`shrink-0 mt-0.5 text-text-muted transition-transform duration-200 ${open === i ? 'rotate-180' : ''}`}
            />
          </button>
          {open === i && (
            <div className="px-4 pb-4">
              <p className="text-sm text-text-secondary leading-relaxed">{item.a}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function FeedbackCard() {
  const toast = useToast()
  const [mensagem, setMensagem] = useState('')

  const enviar = useMutation({
    mutationFn: () => feedbackApi.enviar(mensagem.trim()),
    onSuccess: () => {
      setMensagem('')
      toast.show('Mensagem enviada! Obrigado pela contribuição.', 'success')
    },
    onError: () => toast.show('Não foi possível enviar. Tente novamente.', 'error'),
  })

  return (
    <section className="rounded-2xl border border-border bg-surface-elevated p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-accent/15 flex items-center justify-center shrink-0 mt-0.5">
          <Lightbulb size={18} className="text-accent-hover" />
        </div>
        <div>
          <h2 className="font-semibold text-text text-sm">Sugestões, feedback e melhorias</h2>
          <p className="text-xs text-text-secondary mt-1 leading-relaxed">
            Tem uma ideia de funcionalidade, um feedback ou uma reclamação sobre o sistema? Escreva
            abaixo — sua mensagem vai direto para a nossa equipe. <strong>Ideias boas podem ser
            premiadas com dias grátis</strong> no seu plano.
          </p>
        </div>
      </div>

      <textarea
        value={mensagem}
        onChange={(e) => setMensagem(e.target.value)}
        rows={4}
        maxLength={2000}
        placeholder="Escreva sua sugestão, feedback ou reclamação..."
        className="w-full px-3 py-2.5 text-sm bg-bg border border-border rounded-xl text-text placeholder-text-muted outline-none focus:ring-1 focus:ring-accent resize-y"
      />

      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] text-text-muted">{mensagem.length}/2000</span>
        <Button
          type="button"
          variant="primary"
          onClick={() => enviar.mutate()}
          disabled={enviar.isPending || !mensagem.trim()}
        >
          <Send size={15} className="mr-1.5" />
          {enviar.isPending ? 'Enviando…' : 'Enviar'}
        </Button>
      </div>
    </section>
  )
}

export function AjudaPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
          <HelpCircle size={20} className="text-accent-hover" />
        </div>
        <div>
          <h1 className="font-display text-xl font-bold text-text">Central de Ajuda</h1>
          <p className="text-sm text-text-secondary">Perguntas frequentes e guias completos</p>
        </div>
      </div>

      <FeedbackCard />

      {/* Atalho de instalação do app no ChatGPT */}
      <section className="rounded-2xl border border-accent/30 bg-accent/5 p-5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-accent/15 flex items-center justify-center shrink-0 mt-0.5">
            <Plug size={18} className="text-accent-hover" />
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold text-text text-sm">Converse com seus dados no ChatGPT</h2>
            <p className="text-xs text-text-secondary mt-1 leading-relaxed">
              Instale o app do CoachPilot no ChatGPT e pergunte direto: <em>“quem não treina há mais
              de 10 dias?”</em>, <em>“me dá o resumo da Júlia antes da sessão”</em>, <em>“adapta o
              treino do Pedro pra dor no ombro e aplica”</em>. Funciona também na conta gratuita e no
              aplicativo de celular, e é grátis nos dois planos.
            </p>
            <div className="flex flex-wrap items-center gap-3 mt-3">
              <a href={CHATGPT_APP_URL} target="_blank" rel="noopener noreferrer">
                <Button size="sm">
                  <span className="flex items-center gap-2">
                    <ExternalLink size={14} /> Instalar no ChatGPT
                  </span>
                </Button>
              </a>
              <Link
                to="/settings?tab=conexoes"
                className="text-xs text-text-secondary hover:text-text underline"
              >
                Conexões: usar Claude ou Gemini, e revogar acesso
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="space-y-4">
        <h2 className="font-semibold text-text flex items-center gap-2">
          <MessageSquare size={16} className="text-accent-hover" />
          Perguntas frequentes — Portal do Personal
        </h2>
        <FaqSection items={FAQ_PORTAL} />
      </section>

      {/* Download section */}
      <section className="rounded-2xl border border-border bg-surface-elevated p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-energy/10 flex items-center justify-center shrink-0 mt-0.5">
            <Bot size={18} className="text-energy" />
          </div>
          <div>
            <h2 className="font-semibold text-text text-sm">Não encontrou sua dúvida?</h2>
            <p className="text-xs text-text-secondary mt-1 leading-relaxed">
              Baixe o guia completo em formato <strong>.md</strong>, abra o ChatGPT e cole o arquivo junto com sua pergunta. O guia contém instruções específicas para que o ChatGPT responda com precisão e não invente informações.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <a
            href="/ajuda-portal.md"
            download="coachpilot-guia-portal.md"
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-accent/15 hover:bg-accent/25 text-accent-hover text-sm font-medium transition-colors"
          >
            <Download size={15} />
            Guia do Portal (.md)
          </a>
          <a
            href="/ajuda-aluno.md"
            download="coachpilot-guia-aluno.md"
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-text-secondary text-sm font-medium transition-colors"
          >
            <Download size={15} />
            Guia do App do Aluno (.md)
          </a>
        </div>

        <p className="text-[11px] text-text-muted">
          Como usar: baixe o arquivo → acesse chatgpt.com → inicie uma conversa nova → arraste o arquivo para o chat → faça sua pergunta.
        </p>
      </section>

      {/* Suporte humano — discreto, no rodapé */}
      <div className="pt-2 flex justify-center">
        <a
          href="https://wa.me/5513988088204?text=Ol%C3%A1!%20Preciso%20de%20ajuda%20com%20o%20CoachPilot"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] text-text-muted hover:text-text-secondary hover:bg-white/5 transition-colors"
        >
          <LifeBuoy size={13} />
          Falar com o suporte no WhatsApp
        </a>
      </div>
    </div>
  )
}
