# Modelo de Arquitetura — Fullstack Serverless AWS

> Documento de referência para replicar este padrão arquitetural em outros projetos.
> Stack: **React 19 + FastAPI + DynamoDB + Cognito + CloudFront + AWS SAM**
> Meta de custo: **< $5/mês** em uso pessoal/baixo volume (tipicamente $0–$1/mês no free tier permanente).
>
> **Para iniciar um projeto novo:** copiar este arquivo para `docs/ARCHITECTURE.md` do projeto,
> seguir o **checklist do §11** e criar o `CLAUDE.md` na raiz a partir do **template do §22** —
> ele condensa estas regras em formato de instrução, que é o que faz a IA seguir os padrões
> sem reler o documento inteiro a cada tarefa.
>
> **O que este documento é:** o destilado de sistemas reais que foram ao ar com esta stack —
> um portal multi-tenant com pagamento, SEO, PWA e área autenticada. Cada aviso marcado com ⚠️
> corresponde a um bug que já custou depuração; nenhum é precaução teórica. As medições
> (memória de Lambda, custo, bundle) são de produção, não de estimativa.
>
> **O que ele não é:** um framework. Não há código compartilhado entre projetos — o que se
> copia é o desenho e as decisões. Divergir é permitido; divergir sem escrever o motivo, não.

### Índice

| § | Assunto | Ler quando |
|---|---|---|
| **0** | **Princípios — os quatro guardrails** | Sempre. É o que resolve conflito entre regras |
| 1–2 | Visão geral, stack, mapa de custos | Ao começar o projeto |
| 3 | Estrutura de diretórios e regras de dependência | Ao começar, e ao criar pasta nova |
| 4 | Backend: FastAPI, auth, repositório, paginação, rate limit, jobs, webhook | Ao escrever endpoint |
| 5 | DynamoDB: chaves, GSIs, agregados, concorrência, armadilhas | Antes de modelar qualquer dado |
| 6 | Infra: CloudFront como fachada, edge functions, deploy, duas contas | Ao mexer em `template.yaml` |
| 7 | Frontend: rotas, bundles, **telas de autenticação**, estado, guardas | Ao mexer em rota ou tela |
| 8–9 | Fluxo de deploy · padrões obrigatórios (dinheiro, enums, erros, espelhos) | Sempre à mão |
| 10 | Custo e performance: decisões tomadas, anti-patterns, medições | Ao propor otimização |
| 11 | **Checklist de projeto novo** | No dia 1, e como conferência antes do go-live |
| 12 | Separação de custos (tags + AppRegistry) | Ao subir a primeira stack |
| 13 | **SEO: prerender, sitemap, preview de link, landings** | Antes de publicar qualquer página pública |
| 14–16 | Mídia/uploads · PWA · design system e temas | Ao tocar em imagem, SW ou cor |
| 17 | Testes e guardas automáticas | Ao duplicar informação entre camadas |
| 18 | Ambiente Windows/PowerShell | Quando algo quebrar sem explicação |
| **19** | **Armadilhas já pagas — índice por sintoma** | Quando algo "funciona mas está estranho" |
| **20** | **Tempo e fuso horário — as quatro categorias e a trava** | Antes de gravar a primeira data, e antes de agregar por dia |
| 21 | Servidor MCP — a LLM do usuário falando com o sistema | No dia 1 (nasce com o projeto, não é fase 2) |
| 22 | Template de `CLAUDE.md` | No dia 1 |

---

## 0. Princípios — os quatro guardrails de decisão

Tudo o que vem depois é consequência destes quatro princípios. Quando uma regra específica
deste documento conflitar com uma necessidade real do projeto, é aqui que se resolve.

### 0.1 Ordem de prioridade: correção → escala → custo

> **1º Viabilidade e correção → 2º Performance e escalabilidade → 3º Custo.**

Custo baixo é **meta**, não restrição absoluta. Otimização de custo só vale se **não** degrada
as duas primeiras. Economia que vira latência ruim, leitura desatualizada, `Scan` que não
escala ou feature inviável é **prejuízo**, não economia. Detalhes e os pontos onde o custo
cede em §10.0.

### 0.2 Conhecimento duplicado vira teste automático

Todo sistema desta stack acaba com a mesma informação escrita em dois ou mais lugares — são
sete espelhos previsíveis, catalogados em §9.6, e nenhum deles é opcional: existem porque as
camadas falam linguagens diferentes. **Espelho sem teste diverge — é questão de tempo, não de
disciplina.**

A regra é: **duplicou, escreveu o teste que compara as cópias**. Um teste do frontend pode
ler um `.py` e um `.yaml` e reprovar o build quando divergirem (§17.3). É barato e é a única
coisa que funciona a longo prazo.

### 0.3 Falha silenciosa é o inimigo — a guarda que aborta vale mais que a que avisa

Os piores bugs desta stack não quebram nada visivelmente:

| Falha | Sintoma para quem olha | Como só aparece |
|---|---|---|
| Bundle público passa a importar o SDK de auth | Nenhum | 130 kB a mais no celular do visitante |
| Prerender cai para render no cliente | Nenhum — a página abre | Auditoria de SERP semanas depois |
| `og:image` sem dimensão declarada | Nenhum | Preview pequeno no WhatsApp |
| HTML de SEO subiu com `max-age=31536000` | Nenhum | Conteúdo preso no edge por um ano |
| `Parameter` do SAM mudou de `Default` numa stack existente | Changeset verde | Lambda seguiu com o valor velho |
| Meta tag da rota anterior sobrevive à navegação SPA | Nenhum | Preview de link com dado de outra página |

Por isso o build **aborta**, e não avisa: `npm run build` falha se o bundle do público
referenciar o SDK de auth, se uma rota prerenderizar sem `<h1>`, se o `<head>` sair com dois
`<title>`, se um asset citado não existir no build. Guarda que só imprime aviso é ignorada no
terceiro deploy.

### 0.4 Número que decide arquitetura é medido, nunca estimado

A intuição erra em ambas as direções, e este documento tem as duas provas:

- "App DynamoDB é I/O-bound, 256 MB basta" — **falso** para FastAPI+Pydantic. Medido: 1024 MB
  é 4× mais rápido pelo **mesmo** GB-s (§10.2).
- "Mais memória sempre custa mais" — **falso** no caso acima, **verdadeiro** para o cron, que
  nunca está quente (§4.9).

Vale igual para contraste de cor (medir com script, não olhar), tamanho de bundle (somar os
chunks, não confiar no nome do arquivo) e TTL de cache (o `MaxTTL` do CloudFront **trunca** o
`s-maxage` do origin — o comentário dizia 5 min e o edge entregava 60 s).

---

## 1. Visão Geral

SPA serverless com backend em Lambda, autenticação gerenciada e banco NoSQL. **O CloudFront é a
fachada única**: site, API, mídia e rotas de crawler saem do mesmo domínio, o que elimina CORS
de produção, permite cachear resposta de API na borda e é o que torna PWA e cookies triviais.

```
                        ┌───────────────────────────────┐
                        │   Navegador · Bot · Crawler   │
                        └───────────────┬───────────────┘
                                        │  HTTPS, um único domínio
                        ┌───────────────▼───────────────┐
                        │        CloudFront (CDN)       │
                        │  + Functions em viewer-request│
                        │    · fallback da SPA          │
                        │    · bot de preview → /c/*    │
                        │    · www → apex (301)         │
                        └──┬────────┬────────┬──────────┘
        /  /_ssg/*  /assets│        │/m/*    │/v1/*  /c/*
                    ┌──────▼─────┐ ┌▼───────┐ ┌──────▼──────────┐
                    │ S3 frontend│ │S3 mídia│ │ API Gateway v2  │
                    │ (OAC)      │ │ (OAC)  │ │ + JWT authorizer│
                    └────────────┘ └────────┘ └──────┬──────────┘
                                                     │
   ┌──────────────┐   idToken RS256    ┌──────────────▼─────────────┐
   │ AWS Cognito  ├───────────────────►│  Lambda arm64 (FastAPI)    │
   │  (SRP + JWT) │                    │  claims já verificadas     │
   └──────────────┘                    └──────┬─────────────┬───────┘
                                              │             │
                              ┌───────────────▼──┐   ┌──────▼─────────────┐
                              │ DynamoDB         │   │ Serviços externos  │
                              │ (single-table)   │   │ pagamento, e-mail, │
                              └──────────────────┘   │ LLM — via webhook  │
                                       ▲             └────────────────────┘
                              ┌────────┴─────────┐
                              │ Lambda agendada  │  (EventBridge ScheduleV2)
                              │ jobs de manutenção│
                              └──────────────────┘
```

**Três audiências, e a arquitetura inteira é organizada por elas** (§7.0):

| Audiência | Rota | Autenticação | Entrega | Bundle |
|---|---|---|---|---|
| Visitante anônimo (marketing/SEO) | `/`, `/institucional…` | nenhuma | **HTML prerenderizado** | entry |
| Público dinâmico (conteúdo por tenant/recurso) | `/{slug}/*` | nenhuma | shell + API cacheada | chunk próprio, **sem SDK de auth** |
| Usuário logado (portal) | `/app/*` | Cognito | shell | chunk `lazy`, único com o SDK |

---

## 2. Stack Tecnológico

| Camada | Tecnologia | Versão | Motivo |
|---|---|---|---|
| Frontend Framework | React | 19 | Ecosystem, `useSyncExternalStore`, SSR estável |
| Frontend Build | Vite | 6 | DX rápido, HMR, build de SSR embutido (`--ssr`) |
| Linguagem Frontend | TypeScript | 5 | Type safety end-to-end |
| Estilização | TailwindCSS | 4 | Utility-first, zero runtime, tokens CSS nativos |
| Roteamento | react-router-dom | 7 | `createBrowserRouter` (data router) + `StaticRouter` no build |
| Estado servidor | TanStack React Query | 5 | Cache, invalidation, `useInfiniteQuery` |
| HTTP Client | Axios | 1.x | Interceptors, instância configurável |
| Auth SDK Frontend | AWS Amplify | 6 | SRP nativo, refresh automático — **só no chunk do portal** |
| PWA | vite-plugin-pwa (workbox) | 1.x | SW gerado no build, `navigateFallback` |
| Testes frontend | Vitest | 4 | Funções puras e **testes de espelho** (§17.3) |
| Backend Framework | FastAPI | 0.115+ | Async, Pydantic, OpenAPI automático |
| Runtime Backend | Python | 3.12 | AWS Lambda support |
| Adaptador Lambda | Mangum | 0.19+ | ASGI → Lambda sem overhead |
| Validação Backend | Pydantic | 2.x | Data validation, serialization |
| Auth Backend | authorizer JWT do API Gateway | — | Verificação fora da Lambda; `python-jose` só p/ local |
| Banco de Dados | DynamoDB | — | Serverless, escala, sem ops |
| Autenticação | AWS Cognito | — | SRP, tokens gerenciados, e-mail de confirmação |
| Infraestrutura | AWS SAM | 1.155+ | IaC, build, deploy, local test |
| CDN / borda | CloudFront + CloudFront Functions | — | Fachada única, cache de API, roteamento de SPA |
| Hospedagem Frontend | S3 (OAC) | — | Custo mínimo, sem bucket público |

**Deliberadamente fora da stack:**

| Não usado | Por quê |
|---|---|
| Puppeteer / prerender headless | `renderToString` roda o mesmo React do cliente; headless captura DOM **pós-efeito**, que é a causa de divergência de hidratação, e custa ~150 MB de Chromium no build (§13.4.1) |
| `react-helmet` e afins | O `<head>` já vem completo do HTML; o que falta é sobrescrever por rota, e isso é 100 linhas imperativas em vez de peso novo no bundle público (§7.13) |
| Lambda@Edge | CloudFront Functions resolvem roteamento/redirect por ~1/6 do preço e sem cold start |
| Lambda de transcode de imagem | A compressão acontece no navegador antes do upload (§14.2) |
| API REST v1 do API Gateway | HTTP API v2 é 71% mais barata e tem authorizer JWT nativo |
| DynamoDB Streams (por padrão) | Só quando a agregação síncrona não serve (§5.5, Nível B) |

---

## 2.1 Mapa de Custos AWS — o que é grátis **para sempre** e o que não é

> ⚠️ **Esta distinção muda o planejamento inteiro.** Muita conta "quase de graça" vira cobrança
> no 13º mês porque metade do free tier era temporário. A coluna **Tipo** é a que importa.

| Serviço | Free tier/mês | Tipo | Custo depois |
|---|---|---|---|
| **Lambda** | 1M requests + 400k GB-s | **Sempre** | $0.20/M req + $0.0000167/GB-s |
| **CloudFront** | 1 TB saída + 10M req | **Sempre** | ~$0.085–0.110/GB (varia por região) |
| **CloudFront Functions** | 2M invocações | **Sempre** | $0.10/M |
| **DynamoDB** | 25 GB de **storage** | **Sempre** | $0.25/GB-mês |
| **CloudWatch Logs** | 5 GB de ingestão | **Sempre** | ~$0.50/GB |
| **Cognito** | 10.000 MAU | **Sempre** | ~$0.0055/MAU |
| API Gateway HTTP | 1M requests | **12 meses** | $1.00/M req |
| S3 | 5 GB + 20k GET + 2k PUT | **12 meses** | $0.023/GB + por request |
| SES | 3.000 mensagens | **12 meses** | ~$0.10/mil |
| **Route 53** | — | **Nunca grátis** | **$0.50/mês por hosted zone** |

⚠️ **O free tier de requisições do DynamoDB é de capacidade PROVISIONADA (25 WCU + 25 RCU).**
Numa tabela `PAY_PER_REQUEST` — que é o que este padrão usa — **cada requisição é cobrada desde
a primeira**. Só os 25 GB de storage se aproveitam. Planejar assumindo "200M requisições grátis"
é o erro de conta mais comum desta stack.

⚠️ **A AWS mudou o Free Tier em 2025:** contas novas recebem **créditos** (US$ 100 na abertura,
mais até US$ 100 por atividades, válidos por 6 meses) em vez dos 12 meses do modelo antigo.
Conferir em **Billing → Free tier** antes de usar qualquer número para planejamento.

**O piso real de um projeto novo é ~US$ 0,50/mês, e quase tudo isso é a hosted zone do
Route 53.** Com poucos usuários, o DNS é ~96% da fatura — o resto some no free tier permanente.
Isso é bom e é o ponto: **o custo variável desta arquitetura é praticamente ruído até a casa das
centenas de tenants.**

⚠️ **O que estoura a conta não está nesta tabela** — é o que roda sem ninguém pedir: LogGroup
sem retenção (§6.3), invalidação `/*` a cada deploy (§10.2), cron de 1 minuto que poderia ser
de 5, presigned GET em imagem pública (§14.1). Todos custam pouco por evento e nunca param.

---

## 3. Estrutura de Diretórios

A estrutura reflete o §7.0: `pages/` é o público estático, `tenant/` é o público dinâmico,
`portal/` é o autenticado. Essa separação não é cosmética — ela é o que a guarda de bundle
verifica (§17.2).

```
project-root/
├── CLAUDE.md                      # instruções para a IA (template no §22)
├── deploy.ps1                     # build → sync com 3 políticas de cache → invalidação (§6.10)
├── destruir-ambiente.ps1          # apaga o que o delete-stack RETÉM (§6.7)
├── docs/
│   ├── ARCHITECTURE.md            # este arquivo — padrão genérico
│   ├── ESPEC_TECNICA.md           # modelo de dados, API e tenancy DESTE produto
│   ├── FUNCIONAL.md               # produto: atores, jornadas, regras de negócio
│   ├── ROADMAP.md                 # fases, cada uma uma tarefa executável
│   └── especificacoes/*.md        # specs fechadas por assunto
├── backend/
│   ├── template.yaml              # SAM — infraestrutura completa
│   ├── samconfig.toml             # ASCII puro (§18)
│   ├── requirements.txt
│   ├── app/
│   │   ├── main.py                # FastAPI app + Mangum handler
│   │   ├── config.py              # Settings via pydantic-settings
│   │   ├── dependencies.py        # claims → user_id · admin · hash de IP
│   │   ├── utils.py               # ttl_em(), agora_iso(), helpers puros
│   │   ├── models/                # Pydantic por entidade + enums.py
│   │   ├── routers/               # um arquivo por recurso REST
│   │   ├── services/              # lógica de negócio (nada de boto3 cru)
│   │   ├── repositories/
│   │   │   ├── dynamo_repo.py     # primitivos DynamoDB (singleton)
│   │   │   └── keys.py            # ⚠️ ÚNICO lugar que monta string de PK/SK
│   │   └── jobs/                  # handlers de cron/stream — fora da API
│   └── scripts/                   # verificação manual contra a infra REAL (§17.5)
└── frontend/
    ├── scripts/
    │   ├── prerender.mjs          # SSG + sitemap, com guardas que abortam (§13.4.1)
    │   ├── verificar-bundle.mjs   # grafo de imports do bundle público (§17.2)
    │   └── verificar-contraste.mjs# AA medido nos temas (§16.3)
    └── src/
        ├── main.tsx               # hidrata OU monta, decidido pela ROTA (§13.4.1)
        ├── App.tsx                # createBrowserRouter — único módulo que toca `document` no import
        ├── Shell.tsx              # a árvore SEM roteador: cliente e prerender compartilham
        ├── entry-ssg.tsx          # entry do build --ssr (roda em Node)
        ├── pages/                 # público estático → prerenderizado
        ├── tenant/                # público dinâmico → chunk sem SDK de auth
        ├── portal/                # autenticado → chunk lazy, único com Amplify
        ├── auth/                  # login, signup+confirmação, forgot (§7.7–7.9)
        ├── api/
        │   ├── client.ts          # axios autenticado (puxa Amplify)
        │   ├── publicClient.ts    # axios sem auth — o que `tenant/` pode importar
        │   └── {recurso}.ts
        ├── data/                  # tabelas que geram código E build (rotas, catálogos)
        ├── brand/                 # logo, tokens de marca, temas
        ├── styles/                # tokens.css + temas.css
        ├── components/{ui,…}/     # primitivos compartilhados
        ├── hooks/                 # React Query por recurso
        ├── utils/                 # slug, meta, imagem — puros e testáveis
        └── types/                 # espelho dos enums do backend
```

**Regras de dependência entre pastas** (o que a guarda de bundle verifica):

```
pages/    →  components/, brand/, data/           (sem api/, sem auth/)
tenant/   →  api/publicClient, components/, utils/ (⚠️ NUNCA api/client)
portal/   →  tudo, inclusive auth/ e api/client
auth/     →  aws-amplify                          (só alcançável a partir de portal/)
```

⚠️ **Contrato entre camadas mora em arquivo só de tipo.** É o que permite `tenant/` e
`portal/` compartilharem a forma do dado sem que o `import` arraste o cliente autenticado
junto (`import type` some no build; `import` de um módulo que exporta função, não).

---

## 4. Backend

### 4.1 main.py — FastAPI + Mangum

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum
from app.config import settings
from app.routers import contas, itens, publico, webhook

app = FastAPI(title="Project Name", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],       # o JWT protege; em produção tudo é same-origin via CDN
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(contas.router, prefix="/v1")
app.include_router(itens.router, prefix="/v1")
app.include_router(publico.router, prefix="/v1/public")
app.include_router(webhook.router, prefix="/v1")

@app.get("/v1/health")
def health():
    return {"status": "ok"}

# ⚠️ Com stage nomeado (`StageName: !Ref Stage`), o HTTP API v2 entrega o path com
# prefixo `/{stage}` — inclusive quando vem do CloudFront com `OriginPath`. Sem
# `api_gateway_base_path`, toda rota responde 404.
handler = Mangum(app, lifespan="off", api_gateway_base_path=f"/{settings.stage}")
```

**Monolambda, não uma função por rota.** Uma Lambda serve toda a API via `{proxy+}`. Motivos:
um cold start em vez de N, um pacote para versionar, e o roteamento fica no FastAPI (onde é
testável) em vez de no CloudFormation. Funções separadas só quando o perfil é genuinamente
diferente — cron (§4.9) e consumidor de stream (§5.5).

### 4.2 config.py — Settings via pydantic-settings

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    table_name: str
    cognito_user_pool_id: str
    cognito_client_id: str = ""
    cognito_region: str = "us-east-1"
    stage: str = "dev"
    media_bucket_name: str = ""
    public_base_url: str = ""          # base absoluta p/ og:image, e-mail, webhook
    admin_emails: str = ""             # allowlist separada por vírgula

    @property
    def admins(self) -> set[str]:
        return {e.strip().lower() for e in self.admin_emails.split(",") if e.strip()}

    class Config:
        env_file = ".env"

settings = Settings()
```

⚠️ **Nada em env var da Lambda pode referenciar o CloudFront** — fecha o ciclo
Lambda → CDN → API Gateway → Lambda no CloudFormation. URL de mídia é **relativa** (`/m/...`);
a base absoluta entra por um `Parameter` (`PublicBaseUrl`) que o deploy preenche.

### 4.3 dependencies.py — quem verifica o JWT é o API Gateway

⚠️ **A Lambda não deve verificar assinatura de token em produção.** O authorizer JWT nativo do
HTTP API v2 já validou assinatura, `issuer`, `audience` e expiração antes de invocar — pagar
JWKS + verificação criptográfica por request é trabalho repetido, e a versão "busca o JWKS na
Lambda" que aparece em tutoriais adiciona uma chamada de rede no caminho quente.

O fallback local existe porque `sam local start-api` **não** executa o authorizer. Ele faz a
verificação completa, não um atalho.

```python
import hashlib, json, logging, urllib.request
from functools import lru_cache
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from app.config import settings

logger = logging.getLogger(__name__)
seguranca = HTTPBearer(auto_error=False)


def _claims_do_authorizer(request: Request) -> dict | None:
    evento = request.scope.get("aws.event")
    if not evento:
        return None
    autorizador = (evento.get("requestContext") or {}).get("authorizer") or {}
    return (autorizador.get("jwt") or {}).get("claims")


@lru_cache(maxsize=1)
def _jwks() -> dict:
    url = (f"https://cognito-idp.{settings.cognito_region}.amazonaws.com"
           f"/{settings.cognito_user_pool_id}/.well-known/jwks.json")
    with urllib.request.urlopen(url, timeout=5) as resp:
        return json.loads(resp.read())


def _verificar_token(token: str) -> dict:
    from jose import jwk, jwt                      # import tardio: só o caminho local usa
    cabecalho = jwt.get_unverified_header(token)
    chave = next(k for k in _jwks()["keys"] if k["kid"] == cabecalho["kid"])
    return jwt.decode(
        token, jwk.construct(chave), algorithms=["RS256"],
        audience=settings.cognito_client_id or None,
        issuer=(f"https://cognito-idp.{settings.cognito_region}.amazonaws.com"
                f"/{settings.cognito_user_pool_id}"),
        options={"verify_aud": bool(settings.cognito_client_id)},
    )


def get_claims(request: Request,
               credenciais: HTTPAuthorizationCredentials | None = Depends(seguranca)) -> dict:
    claims = _claims_do_authorizer(request)
    if claims:
        return claims
    if not credenciais:
        raise HTTPException(401, "Não autenticado")
    try:
        return _verificar_token(credenciais.credentials)
    except Exception:
        logger.info("[auth] token rejeitado no fallback local")
        raise HTTPException(401, "Token inválido")


def get_current_user_id(claims: dict = Depends(get_claims)) -> str:
    """⚠️ Única origem legítima de `user_id`. Nunca aceitar do body ou do path."""
    user_id = claims.get("sub")
    if not user_id:
        raise HTTPException(401, "Token sem sub")
    return user_id


def exigir_admin(claims: dict = Depends(get_claims)) -> str:
    """Admin da plataforma — allowlist por env var.

    ⚠️ Responde **404**, não 403: o painel não confirma a própria existência para
    quem não é admin. Mesma regra que faz recurso de outro dono responder 404.
    ⚠️ Exige `email_verified` — é o que impede que um pool reconfigurado no futuro
    transforme "digitei o e-mail do dono" em acesso administrativo.
    """
    email = (claims.get("email") or "").strip().lower()
    verificado = str(claims.get("email_verified", "true")).lower() in ("true", "1")
    if not email or not verificado or email not in settings.admins:
        logger.info("[admin] acesso negado")
        raise HTTPException(404, "Não encontrado")
    return email


def ip_hash(request: Request) -> str:
    """Identidade do visitante anônimo p/ rate limit. ⚠️ O IP nunca é persistido em claro.

    `CloudFront-Viewer-Address` traz o IP real (vem pela OriginRequestPolicy do
    behavior público); o `sourceIp` do API Gateway seria o IP do edge do CloudFront.
    """
    endereco = request.headers.get("cloudfront-viewer-address")
    if endereco:
        ip = endereco.rsplit(":", 1)[0]                    # "203.0.113.7:52000"
    else:
        ip = (request.headers.get("x-forwarded-for", "").split(",")[0].strip()
              or (request.client.host if request.client else "?"))
    return hashlib.sha256(ip.encode()).hexdigest()[:16]
```

**Admin por env var, não por flag no banco.** Zero leitura extra por request, zero risco de
escalonamento por escrita indevida, e a mudança exige deploy — que é exatamente a fricção que
se quer para conceder poder administrativo. O preço é explícito: **trocar admin exige redeploy
do backend**. Anotar isso no `CLAUDE.md` do projeto.

### 4.4 repositories/ — `keys.py` antes de `dynamo_repo.py`

#### 4.4.1 `keys.py` — nenhuma string de chave é montada fora daqui

O erro que este módulo previne não é de digitação: é o mesmo prefixo escrito com grafias
levemente diferentes em dois serviços, o que produz itens que **existem** e nunca são
encontrados. O docstring do módulo vira o mapa do modelo de dados:

```python
"""Chaves do single-table design.

⚠️ Nenhuma string de PK/SK é montada fora deste módulo.

    USER#{user_id}          PROFILE · CONFIG#{nome} · RECURSO#{id}
    RECURSO#{id}            CONF#{META,STATS} · FILHO#{id}
                            EVENTO#{epoch_ms}#{id}
    SLUG#{slug}             REF
    LOCK#{externo_id}       lock de idempotência
    RATE#{escopo}#{chave}   {janela}          (TTL)
    PLATAFORMA              STATS#{aaaa-MM}   agregado global
"""

def pk_user(user_id: str) -> str:      return f"USER#{user_id}"
def pk_recurso(rid: str) -> str:       return f"RECURSO#{rid}"
def pk_slug(slug: str) -> str:         return f"SLUG#{slug}"
def pk_rate(escopo: str, k: str)->str: return f"RATE#{escopo}#{k}"

def sk_evento(criado_ms: int, eid: str) -> str:
    """⚠️ SK composta com `#`. Ver §5.7 — não interpolar cru em URL."""
    return f"EVENTO#{criado_ms}#{eid}"
```

#### 4.4.2 `dynamo_repo.py` — primitivos

```python
import boto3
from boto3.dynamodb.conditions import Key
from app.config import settings

_table = None

def _get_table():
    global _table
    if _table is None:
        _table = boto3.resource("dynamodb", region_name=settings.cognito_region) \
                      .Table(settings.table_name)
    return _table


def put_item(pk: str, sk: str, data: dict) -> None:
    _get_table().put_item(Item={"PK": pk, "SK": sk, **data})


def get_item(pk: str, sk: str, consistente: bool = False) -> dict | None:
    resp = _get_table().get_item(Key={"PK": pk, "SK": sk}, ConsistentRead=consistente)
    return resp.get("Item")


def query_pk(pk: str, sk_prefix: str | None = None) -> list[dict]:
    cond = Key("PK").eq(pk)
    # ⚠️ `begins_with(SK, "")` é ValidationException. Para varrer a partição
    # inteira a condição de SK precisa SUMIR, não virar string vazia.
    if sk_prefix:
        cond &= Key("SK").begins_with(sk_prefix)
    return _get_table().query(KeyConditionExpression=cond).get("Items", [])


def update_item(pk: str, sk: str, campos: dict, *, somar: dict | None = None,
                condicao: str | None = None, retornar: bool = False) -> dict:
    """SET dos `campos` + ADD atômico de `somar`.

    ⚠️ `condicao` é STRING, nunca `Attr(...)` — ver §5.7.
    ⚠️ Prefixos `#u`/`:u` para não colidir com placeholders de condição escritos à mão.
    ⚠️ `ReturnValues="ALL_NEW"` consome RCU além do WCU: opt-in explícito.
    """
    partes, nomes, valores = [], {}, {}
    if campos:
        partes.append("SET " + ", ".join(f"#u{k} = :u{k}" for k in campos))
        nomes.update({f"#u{k}": k for k in campos})
        valores.update({f":u{k}": v for k, v in campos.items()})
    if somar:
        partes.append("ADD " + ", ".join(f"#u{k} :u{k}" for k in somar))
        nomes.update({f"#u{k}": k for k in somar})
        valores.update({f":u{k}": v for k, v in somar.items()})

    kwargs = dict(
        Key={"PK": pk, "SK": sk},
        UpdateExpression=" ".join(partes),
        ExpressionAttributeNames=nomes,
        ExpressionAttributeValues=valores,
        ReturnValues="ALL_NEW" if retornar else "NONE",
    )
    if condicao:
        kwargs["ConditionExpression"] = condicao
    return _get_table().update_item(**kwargs).get("Attributes", {})


def transact_write(itens: list[dict]) -> bool:
    """TransactWriteItems. Devolve False quando alguma condição falhou.

    ⚠️ É aqui que lock de idempotência e agregado `ADD` andam JUNTOS (§4.10).
    """
    cliente = _get_table().meta.client
    try:
        cliente.transact_write_items(TransactItems=itens)
        return True
    except cliente.exceptions.TransactionCanceledException:
        return False


def batch_write(puts: list[dict] | None = None, deletes: list[tuple] | None = None) -> None:
    tabela = _get_table()
    reqs = [{"PutRequest": {"Item": i}} for i in (puts or [])]
    reqs += [{"DeleteRequest": {"Key": {"PK": pk, "SK": sk}}} for pk, sk in (deletes or [])]
    for i in range(0, len(reqs), 25):
        tabela.meta.client.batch_write_item(RequestItems={settings.table_name: reqs[i:i + 25]})
```

### 4.5 routers/{resource}.py — padrão de router

```python
from uuid import uuid4
from botocore.exceptions import ClientError
from fastapi import APIRouter, Depends, HTTPException
from app.dependencies import get_current_user_id
from app.models.item import Item, ItemCreate
from app.repositories import dynamo_repo as repo, keys

router = APIRouter(prefix="/itens", tags=["itens"])

@router.get("", response_model=list[Item])
def listar(user_id: str = Depends(get_current_user_id)):
    return [Item(**i) for i in repo.query_pk(keys.pk_user(user_id), "ITEM#")]

@router.post("", response_model=Item, status_code=201)
def criar(body: ItemCreate, user_id: str = Depends(get_current_user_id)):
    item = Item(item_id=str(uuid4()), user_id=user_id, **body.model_dump())
    repo.put_item(keys.pk_user(user_id), keys.sk_item(item.item_id), item.model_dump())
    return item

@router.patch("/{item_id}", response_model=Item)
def atualizar(item_id: str, body: ItemCreate, user_id: str = Depends(get_current_user_id)):
    # 1 operação condicional em vez de get + update (2 operações, e com corrida no meio)
    try:
        novo = repo.update_item(
            keys.pk_user(user_id), keys.sk_item(item_id),
            body.model_dump(exclude_none=True),
            condicao="attribute_exists(PK)", retornar=True,
        )
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            raise HTTPException(404, "Item não encontrado")
        raise
    return Item(**novo)
```

**Camadas:** `router` valida entrada e traduz exceção em HTTP; `service` tem a regra de
negócio; `repository` fala com o DynamoDB. Nenhum `boto3` em router, nenhum `HTTPException`
em repository. Serviço lança exceção de domínio própria (`ListaIndisponivel`,
`RateLimitExcedido`), e o router decide o status.

### 4.6 models/{entity}.py — Pydantic

```python
from enum import Enum
from pydantic import BaseModel, Field

class ItemStatus(str, Enum):
    ATIVO = "ATIVO"
    INATIVO = "INATIVO"

class ItemCreate(BaseModel):
    nome: str = Field(min_length=1, max_length=120)
    preco_centavos: int = Field(ge=0)          # dinheiro é INTEIRO (§9.1)
    status: ItemStatus = ItemStatus.ATIVO
    descricao: str | None = None

class Item(ItemCreate):
    item_id: str
    user_id: str
    criado_em: str
    atualizado_em: str
```

⚠️ **Enum é espelho** — a cópia TypeScript vive em `frontend/src/types/` e a divergência é
teste (§0.2). ⚠️ **`Field(max_length=...)` em todo texto que o usuário digita**: item de
DynamoDB tem teto de 400 KB e o custo de escrita é por KB.

### 4.7 Paginação cursor-based — coleções que escalam

> **REGRA OBRIGATÓRIA — toda lista que cresce sem limite é paginada de ponta a ponta.**
> Cursor no backend (`query_pk_page`) **e** consumo com `useInfiniteQuery` + "carregar mais"/
> scroll infinito no frontend (§7.4.1). Nunca devolver uma coleção ilimitada inteira, nem parar
> na 1ª página sem fiar `fetchNextPage`/`hasNextPage` na tela — isso trava o usuário nas N mais
> recentes e mascara sobrecarga de front. Se há paginação no backend, a tela **tem** que puxar
> as páginas seguintes.

Usar quando a coleção cresce sem limite (séries temporais: pedidos, recados, notificações,
chat). Coleções pequenas e limitadas por natureza (itens de um catálogo, seções de uma página)
continuam em `query_pk` sem paginação — não vale a complexidade.

```python
def query_pk_page(
    pk: str, sk_prefix: str, limit: int, cursor: str | None = None, forward: bool = True,
    filters: dict | None = None, max_scans: int = 8,
) -> tuple[list[dict], str | None]:
    """Cursor opaco (chave do último item retornado, base64). Retorna (items, next_cursor)."""
```

**Filtro é SEMPRE no servidor, nunca no cliente depois de paginar.** Filtrar em memória após
`query_pk_page` (`[r for r in result if r.tipo == x]`) é bug: uma página de N pode voltar quase
vazia porque o filtro corta itens que vieram na página, escondendo matches que estão adiante —
e o "carregar mais" fica furado. Passe as igualdades em `filters`, que viram `FilterExpression`.
Como o `FilterExpression` é aplicado **depois** do `Limit`, `query_pk_page` encadeia até
`max_scans` páginas para preencher a página lógica; o cursor retorna a chave do último item
**incluído** (não o `LastEvaluatedKey` cru, que pularia matches). `max_scans` limita o RCU de
pior caso — filtro raro numa partição enorme devolve página parcial + cursor, sem varrer tudo.

O router devolve `{"items": [...], "next_cursor": str | None}`. Toda entidade nova com esse
perfil de crescimento segue o mesmo formato.

### 4.8 Rate limit de endpoint público — contador atômico com TTL

Endpoint sem autenticação precisa de limite **antes** de qualquer trabalho caro, e sempre antes
de falar com serviço externo pago. O padrão é um item por (escopo, chave, janela), com `ADD`
atômico e TTL — o DynamoDB apaga sozinho, sem job de limpeza.

```python
LIMITE_IP, JANELA_IP_MIN = 5, 10          # 5 tentativas por IP a cada 10 min
LIMITE_RECURSO, JANELA_RECURSO_MIN = 60, 60

def _janela(minutos: int) -> str:
    agora = datetime.now(timezone.utc)
    bloco = (agora.minute // minutos) * minutos
    return agora.strftime(f"%Y%m%d%H{bloco:02d}")

def _contar(escopo: str, chave: str, janela_min: int, limite: int) -> None:
    try:
        r = repo.update_item(
            keys.pk_rate(escopo, chave), _janela(janela_min),
            {"ttl": ttl_em(minutos=janela_min * 2)},
            somar={"contador": 1},
            # Exceção consciente ao "não usar ALL_NEW": sem o valor de volta seria
            # preciso um GetItem extra só para saber se estourou.
            retornar=True,
        )
    except Exception as exc:
        # ⚠️ Rate limit é proteção, não caminho crítico: falha aqui NÃO bloqueia a
        # operação legítima. Indisponibilidade do limitador não pode virar
        # indisponibilidade do produto.
        logger.warning("[rate] falha ao contar %s/%s: %s", escopo, chave, exc)
        return
    if int(r.get("contador", 0)) > limite:
        raise RateLimitExcedido(escopo, janela_min * 60)
```

**Escolha da chave:** endpoint anônimo limita por **hash de IP** (§4.3) *e* por recurso — o
segundo balde é o que impede um atacante distribuído de esgotar um recurso específico.
Endpoint autenticado limita por **`user_id`**, que é mais estreito que IP (um NAT corporativo
inteiro compartilha o mesmo IP).

### 4.9 Jobs agendados — Lambda separada, memória mínima

```yaml
  ExpirarPendentesFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: !Sub "${ProjectName}-expirar-${Stage}"
      Handler: app.jobs.expirar.handler
      CodeUri: ./
      # ⚠️ 256 MB de propósito: roda a cada 5 min e NUNCA está quente, então o tempo
      # é dominado pelo init — que não encolhe com memória. E ninguém espera a
      # resposta, então não há latência para comprar. É o caso OPOSTO ao da API (§10.2).
      MemorySize: 256
      Policies:
        - DynamoDBCrudPolicy: { TableName: !Ref MainTable }
      Events:
        Agendamento:
          Type: ScheduleV2                      # EventBridge Scheduler, não o Events legado
          Properties:
            ScheduleExpression: "rate(5 minutes)"
```

**O job precisa de um índice que o torne barato quando não há trabalho.** O padrão: **GSI
sparse** com bucket temporal — o job consulta a hora atual e a anterior, e quase toda invocação
faz duas queries **vazias** e sai. Sem isso, um cron de 5 minutos vira um `Scan` a cada 5
minutos.

⚠️ **Handler de job vive em `app/jobs/`, fora do router.** Ele não pode ser alcançável por HTTP,
e ter o próprio arquivo é o que permite dar a ele memória, timeout e política de IAM diferentes.

### 4.10 Integração com serviço externo — webhook idempotente

Todo sistema desta stack acaba integrando algo assíncrono (pagamento, e-mail, LLM). O desenho
é sempre o mesmo, e os quatro pontos abaixo não são negociáveis:

**1. Nunca confiar no payload do webhook.** Ele diz *o que* mudou, não *qual é* o estado. Sempre
re-consultar o recurso na API do provedor (`GET /pagamentos/{id}`) antes de aplicar efeito.
Payload de webhook é forjável e chega fora de ordem.

**2. Lock de idempotência gravado ANTES do efeito, na mesma transação.**

```python
aplicado = repo.transact_write([
    # 1) o lock: falha se este evento já foi processado
    {"Put": {"TableName": T, "Item": {"PK": f"LOCK#{evento_id}", "SK": "lock", "ttl": ...},
             "ConditionExpression": "attribute_not_exists(PK)"}},
    # 2) o efeito de domínio
    {"Update": {"TableName": T, "Key": {...},
                "UpdateExpression": "SET #s = :pago", ...}},
    # 3) o agregado — ⚠️ `ADD` SÓ é idempotente dentro da transação que carrega o lock.
    #    Fora dela, uma reentrega contabiliza duas vezes e o número infla em silêncio.
    #    `SET` perdoa reentrega; `ADD` não.
    {"Update": {"TableName": T, "Key": {"PK": "PLATAFORMA", "SK": f"STATS#{mes}"},
                "UpdateExpression": "ADD total_centavos :v, quantidade :um", ...}},
])
if not aplicado:
    return {"ok": True}          # reentrega: 200, sem efeito
```

**3. A chave de idempotência enviada ao provedor tem que conter o VALOR, não só o alvo.**
⚠️ Um `X-Idempotency-Key` do tipo `PEDIDO:{id}` é bug de dinheiro esperando acontecer: o
usuário gera a cobrança, aplica um desconto e tenta de novo — o provedor devolve **o mesmo
pagamento, com o preço velho**, e a tela mostra o novo. É `PEDIDO:{id}:{valor_centavos}`.

**4. Responder 200 rápido.** Provedor que recebe erro ou timeout reenvia — e reenvio é
exatamente o que o lock existe para absorver, não o que se quer provocar. Trabalho pesado sai
da rota do webhook.

⚠️ **Segredo do provedor tem contexto.** Se o produto é multi-tenant e o dinheiro/recurso é do
tenant, o token é **do tenant** (item `USER#{uid} / CONFIG#{PROVEDOR}`); o token da plataforma
serve só para o que a plataforma cobra. **Nunca misturar os dois** — e o token do tenant nunca
volta ao frontend: a API responde `{configurado: bool, apelido, mascarado}`.

---

## 5. DynamoDB — Single-Table Design

### 5.1 Estrutura de Chaves

```
Tabela única: {project}-{stage}
Billing: PAY_PER_REQUEST (serverless)

Chave Primária:
  PK (partition): a ENTIDADE que dona o dado — "USER#{id}", "RECURSO#{id}", "PLATAFORMA"
  SK (sort):      tipo + identificador, com prefixo que permita begins_with
```

**A PK é a unidade de isolamento e a unidade de leitura.** A pergunta que decide a modelagem é
sempre "quem lê isto junto?". Num produto multi-tenant, o tenant costuma ser o **recurso**
(a lista, o projeto, a loja), não o usuário — um usuário tem N recursos, e cada recurso é lido
inteiro numa Query.

⚠️ **Toda escrita autenticada valida a posse antes de qualquer efeito**, e há só duas formas
aceitáveis: um item ponteiro (`USER#{uid} / RECURSO#{rid}`, 1 GetItem) ou
`ConditionExpression: owner_id = :uid` na própria escrita. **Nunca** confiar no id que veio do
path. Recurso de outro dono responde **404**, não 403 (não confirma a existência).

### 5.2 SK Patterns por Tipo de Item

```
PROFILE          → PROFILE                 (singleton da partição)
CONFIGURAÇÃO     → CONF#{NOME}             (blocos de um mesmo recurso, lidos juntos)
FILHO            → FILHO#{id}
SÉRIE TEMPORAL   → EVENTO#{epoch_ms}#{id}  (ordenação natural por SK, sem GSI)
AGREGADO         → STATS  ·  STATS#{aaaa-MM}
UNICIDADE        → PK própria: SLUG#{slug} / SK REF
LOCK             → PK própria: LOCK#{externo_id}
QUOTA/RATE       → RATE#{escopo}#{chave} / SK {janela}   (com TTL)
CREDENCIAL       → PK própria: TOKEN#{token} / SK REF     (com TTL)
```

**Sufixo com `epoch_ms` resolve ordenação sem índice.** `EVENTO#{epoch_ms}#{id}` dá lista
cronológica com `query` + `ScanIndexForward=False` e paginação por cursor — de graça. É o
padrão para pedidos, mensagens, logs.

### 5.3 Global Secondary Indexes — poucos, e sparse

**GSI1 — recorte temporal / fila de trabalho (sparse):**
```yaml
GSI1PK: "PENDENTE#{aaaa-MM-ddTHH}"   # o atributo só existe enquanto pendente
GSI1SK: "{expira_em}#{id}"
```
Sparse = o atributo de índice **só é escrito enquanto o item pertence à consulta**, e é
**removido** (`REMOVE`) quando sai. O índice fica minúsculo, o job de manutenção (§4.9)
consulta dois buckets e sai, e não se paga escrita de índice pelo ciclo de vida inteiro do item.

**GSI2 — busca administrativa / agrupamento (sparse):**
```yaml
GSI2PK: "PUBLICADO"                  # partição única e pequena, só p/ o que o admin lista
GSI2SK: "{criado_em}#{id}"
```

⚠️ **Dois GSIs é o teto default.** O terceiro só entra com o access pattern real escrito na
spec técnica do projeto. Mas — e isto é o §0.1 em ação — **access pattern real que não é
servível por query direta recebe índice**: 1 WRU extra é infinitamente melhor que um `Scan`
que não escala. `Scan` é proibido em produção, sem exceção.

**Projeção:** `ALL` quando o índice serve a leitura completa; `KEYS_ONLY` quando ele só
descobre quais itens existem e o código faz `BatchGetItem` depois (reduz ~33% do custo de
escrita do índice).

### 5.4 Template DynamoDB (SAM)

```yaml
MainTable:
  Type: AWS::DynamoDB::Table
  DeletionPolicy: Retain              # ⚠️ e UpdateReplacePolicy — ver §6.7
  UpdateReplacePolicy: Retain
  Properties:
    TableName: !Sub "${ProjectName}-${Stage}"
    BillingMode: PAY_PER_REQUEST
    PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: true }
    AttributeDefinitions:
      - { AttributeName: PK, AttributeType: S }
      - { AttributeName: SK, AttributeType: S }
      - { AttributeName: GSI1PK, AttributeType: S }
      - { AttributeName: GSI1SK, AttributeType: S }
      - { AttributeName: GSI2PK, AttributeType: S }
      - { AttributeName: GSI2SK, AttributeType: S }
    KeySchema:
      - { AttributeName: PK, KeyType: HASH }
      - { AttributeName: SK, KeyType: RANGE }
    GlobalSecondaryIndexes:
      - IndexName: GSI1
        KeySchema:
          - { AttributeName: GSI1PK, KeyType: HASH }
          - { AttributeName: GSI1SK, KeyType: RANGE }
        Projection: { ProjectionType: ALL }
      - IndexName: GSI2
        KeySchema:
          - { AttributeName: GSI2PK, KeyType: HASH }
          - { AttributeName: GSI2SK, KeyType: RANGE }
        Projection: { ProjectionType: KEYS_ONLY }
    TimeToLiveSpecification:
      AttributeName: ttl
      Enabled: true
    Tags: [...]                        # §12
```

### 5.5 Indicadores e Agregação Cumulativa (agregar na escrita, nunca varrer na leitura)

**Regra:** indicadores, métricas e dashboards são servidos por **itens agregados pré-computados**,
lidos em **1 GetItem ou query curta**. **Nunca** calcular indicador com `Scan` ou `Query` de N itens
somados em memória no caminho de leitura — não escala: custo e latência crescem com o histórico.

O agregado é mantido **no momento da escrita**, em dois níveis conforme a métrica:

**Nível A — contador atômico síncrono** (métrica simples, imediata, baixa cardinalidade):
- `update_item` com `ADD` (incremento atômico) num item `STATS`. 1 write, sem read prévio.
- ⚠️ `ADD` **não** é idempotente: se a escrita puder ser reentregue/retried, o incremento vai na
  **mesma `TransactWriteItems`** que grava o marcador de idempotência condicional (§4.10) — ou
  ambos, ou nada.

**Nível B — agregação assíncrona via DynamoDB Streams** (métrica analítica / série temporal / volume):
- Habilitar **Streams**; uma **Lambda agregadora** consome os eventos e atualiza `STATS#{periodo}`.
- O **write quente fica mínimo (1 item)**; a agregação sai do caminho crítico e o Stream absorve picos.
- **Idempotência:** guardar a sequence do último evento aplicado, ou usar **set-state** (recalcular
  o bucket a partir do valor do item) em vez de incremento cego.

**Onde mora o agregado:** na partição de **quem lê** (mesma PK que serve o dashboard). Buckets por
período (`all`/dia/mês) dão série temporal sem tocar os itens-fonte.

**Backfill/reparo:** um script de recálculo reconstrói os agregados a partir dos itens-fonte
(`backend/scripts/recalcular_stats.py`). É caminho de **manutenção**, nunca de leitura em produção
— mas ele precisa existir desde o começo: sem ele, o primeiro bug na agregação não tem conserto.

> Escolha A vs B: métrica que precisa estar **certa na hora e é barata de contar** → A (transacional).
> Métrica **analítica/volumosa** → B (Streams). Na dúvida, A — é muito mais simples, e migrar para B
> depois é local.

```yaml
  MainTable:
    Properties:
      StreamSpecification:
        StreamViewType: NEW_AND_OLD_IMAGES

  AggregatorFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: app.jobs.agregador.handler
      Policies: [ DynamoDBCrudPolicy: { TableName: !Ref MainTable } ]
      Events:
        Stream:
          Type: DynamoDB
          Properties:
            Stream: !GetAtt MainTable.StreamArn
            StartingPosition: LATEST
            BatchSize: 100
            MaximumBatchingWindowInSeconds: 5   # coalesce: menos invocações e menos writes
```

### 5.6 Concorrência — a escrita condicional é a única trava que existe

Não há transação de leitura-modificação-escrita neste banco. Toda invariante vira
`ConditionExpression`.

| Invariante | Como se escreve |
|---|---|
| Slug/handle único | `Put` em `SLUG#{slug}` com `attribute_not_exists(PK)` |
| Estoque não negativo | `ADD disponivel :neg` com `ConditionExpression: disponivel >= :n` |
| Só o dono altera | `ConditionExpression: owner_id = :uid` na própria escrita |
| Evento processado 1× | `Put` no lock com `attribute_not_exists(PK)`, dentro da transação (§4.10) |
| Resgate único por usuário | `Put` em `CUPOM#{cod} / USO#{uid}` com `attribute_not_exists(PK)` |

⚠️ **Nunca** `get_item` → checar em Python → `put_item`. São duas operações e uma corrida no meio.

⚠️ **Atributo NULO não satisfaz condição numérica — o caso "sem limite" pula a reserva, nunca a
relaxa.** Um item com `disponivel = None` (estoque ilimitado) faz `disponivel >= :n` falhar
**sempre**: todo checkout com item ilimitado dá 409. E "resolver" com sentinela numérica grande é
pior — o `ADD` decrementa sem fim. A correção é um predicado explícito (`_controla_estoque(item)`)
que **pula** a operação condicional para esses itens, espelhado no frontend (nunca
`disponivel ?? 0`, que trata nulo como esgotado).

**Read-after-write no caminho quente usa `ConsistentRead=True`.** Leitura eventual custa metade,
mas reler o que se acabou de escrever e receber o estado velho quebra a lógica — e o custo extra
é irrelevante perto do dano (§10.0).

### 5.7 Armadilhas de DynamoDB já pagas

- **Condição é STRING, nunca `Attr(...)`.** O boto3 traduz objetos de condição gerando
  placeholders `#n0`/`:v0` e os **mescla** no `ExpressionAttributeNames`, sobrescrevendo os
  nossos. Por isso `update_item` usa prefixo `#u`/`:u` e as condições são escritas à mão.
  `Attr(...)` só em `FilterExpression`/`KeyConditionExpression`.
- **`begins_with(SK, "")` é `ValidationException`.** Para varrer a partição inteira, a condição
  de SK precisa **sumir**, não virar string vazia.
- **SK com `#` não entra num segmento de URL.** `EVENTO#{epoch_ms}#{id}` interpolado cru na URL
  faz o `#` abrir o **fragmento**: o browser manda só `PATCH /eventos/{epoch_ms}` e a rota
  responde 404 em todo item. A rota recebe **dois segmentos** (`/eventos/{criado_ms}/{id}`) e o
  backend remonta a SK com o módulo `keys`. `encodeURIComponent` foi descartado de propósito:
  `%23` no path ainda depende de CloudFront e API Gateway repassarem o encode.
- **`agora.replace(year=agora.year + 1)` estoura em 29/02.** Prazo se soma com `timedelta`,
  nunca trocando o campo `year`.
- **`ReturnValues="ALL_NEW"` consome RCU.** Opt-in explícito; a exceção legítima é o contador de
  rate limit, onde a alternativa seria um GetItem extra (§4.8).
- **Item > 400 KB é erro; item > 4 KB já custa mais.** Lista que cresce dentro de um item
  (histórico, coleção de filhos) vira itens separados. Blob vai para o S3 com referência.
- **Hot key:** PK fixa global (`"CONFIG"`, `"TODOS"`) concentra escrita. Aceitável só quando a
  partição é pequena **e** de leitura (catálogo de cupons, feature flags) — e nesse caso os
  **eventos** relacionados ficam em outra partição, para não concentrar escrita ali.

---

## 6. Infraestrutura — `template.yaml`

### 6.0 Uma distribution como fachada de tudo

O desenho que mais paga por si nesta stack: **um domínio, uma distribution, quatro origins.**

| Path | Origin | Cache | Por quê |
|---|---|---|---|
| `/` e demais rotas de SPA | S3 frontend (OAC) | `CachingOptimized` | assets com hash |
| `/_ssg/*` | S3 frontend (OAC) | otimizado, mas **sem** `immutable` no S3 | HTML de SEO (§13.4.1) |
| `/m/*` | S3 mídia (OAC) | `max-age=31536000, immutable` | imagem content-addressed |
| `/v1/public/*` | API Gateway | **TTL 60 s** | leitura pública, cacheável |
| `/c/*` | API Gateway | **TTL 300 s** | HTML de Open Graph para bots |
| `/v1/*` | API Gateway | `CachingDisabled` | resto da API |

Consequências que valem mais que o CDN em si: **zero CORS em produção** (tudo same-origin),
**PWA e cookies triviais**, e um pico de tráfego público (link viralizando) vira dezenas de
origin hits, não milhares.

⚠️ **A ORDEM dos `CacheBehaviors` importa** — o CloudFront usa o **primeiro** `PathPattern` que
casa. `/v1/public/*` tem que vir **antes** de `/v1/*`, senão nunca é cacheado.

⚠️ **O `PathPattern` NÃO é removido do caminho enviado ao origin.** `/m/*` apontando para o
bucket de mídia faz `GET /m/tenant/{id}/{uuid}.webp` pedir ao S3 a chave `m/tenant/...`, enquanto
o upload grava em `tenant/...` — **403 em toda imagem**. Corrige-se com uma CloudFront Function
de uma linha (`request.uri = request.uri.substring(2)`), não colocando o `m/` dentro da key
(isso põe roteamento na chave de storage). O bug ficou escondido porque o OAC não concede
`ListBucket`: "não existe" vira `AccessDenied`, não `404`.

⚠️ **`PriceClass` segue a geografia do público, e o default engana.** `PriceClass_100` é
**EUA + Canadá + Europa** — a América do Sul, a Ásia e a Oceania **não estão nele**. Um produto
com público no Brasil rodando em `_100` é servido por Miami, com **+100–150 ms em cada asset**,
para economizar ~US$ 0,025/GB. Pela ordem de prioridade (§0.1), isso é regressão de performance
comprada com centavos: **público no Brasil → `PriceClass_All`**.

> Este é o exemplo canônico de otimização de custo que **não** vale (§10.0). O erro é fácil de
> cometer porque o nome sugere "classe econômica", não "metade do mundo de fora", e porque
> ninguém percebe: o site **funciona**, só é mais lento para todo mundo, o tempo todo.

### 6.1 Roteamento de SPA — CloudFront Function, nunca `CustomErrorResponses`

⚠️ **`CustomErrorResponses` é de nível de DISTRIBUIÇÃO, não de behavior.** Mapear
`403/404 → 200 /index.html` para o roteamento da SPA reescreve **também** o 404 da API:
`GET /v1/public/recursos/inexistente` passa a devolver HTML com status **200**, o axios resolve
com sucesso e a tela de "não encontrado" (que decide por `response.status`) nunca aparece.

O fallback é uma **CloudFront Function em viewer-request associada só ao default behavior**.
`/v1/*`, `/c/*` e `/m/*` não têm essa associação e seguem devolvendo o status real.

A mesma função acumula três responsabilidades (um behavior aceita **uma** função em
viewer-request):

```js
var RESERVADOS = ['app','api','v1','m','c','assets','admin','login','signup', /* … §7.5 */];
var BOTS = /facebookexternalhit|WhatsApp|Twitterbot|TelegramBot|Slackbot|LinkedInBot|Discordbot|…/i;
var SSG = { '/': 'inicio', '/como-funciona': 'como-funciona', /* … espelho de rotasEstaticas.ts */ };
var PREFIXO_RESERVADO = 'lista-de-presentes';

function handler(event) {
  var request = event.request, uri = request.uri;

  // 1. www → apex, 301. Sem isto o site inteiro existe em dois endereços (conteúdo
  //    duplicado) e o link compartilhado com www não soma autoridade para o apex.
  //    ⚠️ A query string precisa sobreviver: é por ela que vem o UTM da campanha.
  var host = request.headers['host'];
  if (host && host.value.indexOf('www.') === 0) { /* 301 para o apex, preservando ?query */ }

  // Barra final some antes de qualquer decisão: '/x/' e '/x' são a mesma página.
  var caminho = uri.length > 1 && uri.charAt(uri.length - 1) === '/'
    ? uri.substring(0, uri.length - 1) : uri;

  // 2. Bot de preview em /{slug} → 302 para a rota que devolve Open Graph (§13.7).
  //    ⚠️ 302, nunca 301: um humano com User-Agent atípico não pode ficar com o
  //    redirect preso no cache do browser.
  //    ⚠️ Crawler de BUSCA fica de fora de propósito — ver §13.7.
  var ua = request.headers['user-agent'];
  if (ua && BOTS.test(ua.value)) {
    var achado = caminho.match(/^\/([a-z0-9]+(?:-[a-z0-9]+)*)$/);
    if (achado && RESERVADOS.indexOf(achado[1]) === -1
               && achado[1].indexOf(PREFIXO_RESERVADO) !== 0) {
      return { statusCode: 302, statusDescription: 'Found',
               headers: { location: { value: '/c/' + achado[1] } } };
    }
  }

  // 3. Rota prerenderizada → o HTML estático. Depois do bot, de propósito: bot em
  //    rota reservada cai aqui e recebe as OG tags certas daquela página.
  //    ⚠️ Lista explícita, nunca heurística: "tente /_ssg/{rota}.html" serviria 404
  //    do S3 para toda rota de tenant e do portal.
  var estatica = SSG[caminho];
  if (estatica) { request.uri = '/_ssg/' + estatica + '.html'; return request; }

  // 4. Rota de SPA → shell. Arquivo real sempre tem extensão no último segmento;
  //    rota de SPA nunca tem (o slug é ^[a-z0-9]+(?:-[a-z0-9]+)*$, sem ponto).
  var ultimo = uri.substring(uri.lastIndexOf('/') + 1);
  if (ultimo.indexOf('.') === -1) request.uri = '/index.html';
  return request;
}
```

⚠️ Esta função é o **terceiro e o quarto** espelho da blocklist de rotas (§7.5). Rota fixa nova
entra em `RESERVADOS` e — se for prerenderizada — em `SSG`, no mesmo commit. **O teste
automático é obrigatório**: ele lê o `.py` e o `.yaml` e reprova o `npm test` quando divergirem
(§17.3). Esquecer o `SSG` é falha silenciosa: a página abre normal, em CSR, e só o SEO não
acontece.

### 6.2 Cache policies e cabeçalhos

```yaml
  PublicApiCachePolicy:                   # leitura pública da API
    Type: AWS::CloudFront::CachePolicy
    Properties:
      CachePolicyConfig:
        Name: !Sub "${ProjectName}-public-60s-${Stage}"
        DefaultTTL: 60
        MinTTL: 0
        MaxTTL: 60                        # ⚠️ MaxTTL TRUNCA o s-maxage do origin (§0.4)
        ParametersInCacheKeyAndForwardedToOrigin:
          EnableAcceptEncodingGzip: true
          EnableAcceptEncodingBrotli: true
          HeadersConfig:      { HeaderBehavior: none }   # ⚠️ header na CHAVE fragmenta o cache
          CookiesConfig:      { CookieBehavior: none }
          QueryStringsConfig: { QueryStringBehavior: all }

  PublicApiOriginRequestPolicy:           # o que CHEGA ao origin (≠ chave de cache)
    Type: AWS::CloudFront::OriginRequestPolicy
    Properties:
      OriginRequestPolicyConfig:
        Name: !Sub "${ProjectName}-public-origin-${Stage}"
        HeadersConfig:
          HeaderBehavior: whitelist
          Headers: [Content-Type, Accept, Origin, Referer, User-Agent,
                    Idempotency-Key, CloudFront-Viewer-Address, CloudFront-Viewer-Country]
        CookiesConfig:      { CookieBehavior: none }
        QueryStringsConfig: { QueryStringBehavior: all }

  SecurityHeadersPolicy:
    Type: AWS::CloudFront::ResponseHeadersPolicy
    Properties:
      ResponseHeadersPolicyConfig:
        Name: !Sub "${ProjectName}-security-headers-${Stage}"
        SecurityHeadersConfig:
          StrictTransportSecurity:
            AccessControlMaxAgeSec: 63072000     # 2 anos
            IncludeSubdomains: true
            Override: true
          ContentTypeOptions: { Override: true }
          FrameOptions: { FrameOption: SAMEORIGIN, Override: true }
          ReferrerPolicy: { ReferrerPolicy: strict-origin-when-cross-origin, Override: true }
```

Três decisões que se repetem em todo projeto:

- **`Authorization` NÃO entra na origin request policy do behavior público.** O endpoint público
  ignora auth e não pode devolver resposta personalizada — se entrasse, um usuário logado
  envenenaria o cache de todo mundo.
- **Header que o origin precisa mas que não muda a resposta vai na origin request policy e
  NÃO na chave de cache** (`User-Agent`, `CloudFront-Viewer-Address`). Na chave, cada bot
  criaria uma entrada.
- **CSP fica de fora até ser medida.** Um `<script>` inline (tema antes da primeira pintura) e
  `blob:` de canvas quebram com uma CSP escrita no chute. Quando entrar, entra em
  `Content-Security-Policy-Report-Only` primeiro. **Sem HSTS `preload`**: entrar na lista dos
  browsers é praticamente irreversível.

### 6.3 Logs — retenção obrigatória

CloudWatch Logs sem retenção ficam armazenados **para sempre** — custo que só cresce. LogGroup
explícito **por função**, e com `DeletionPolicy: Delete` (log não é dado de produção a preservar):

```yaml
  ApiFunctionLogGroup:
    Type: AWS::Logs::LogGroup
    DeletionPolicy: Delete
    Properties:
      LogGroupName: !Sub "/aws/lambda/${ProjectName}-api-${Stage}"   # ⚠️ nome LITERAL
      RetentionInDays: 30
```

⚠️ **O nome tem que ser o literal, não `!Ref Function`.** Com `!Ref`, o CloudFormation cria o
LogGroup depois que a Lambda já criou o dela na primeira invocação — e o deploy falha com
"already exists". Por isso a função também recebe `FunctionName` explícito.

### 6.4 Alerta de custo (1× por conta)

AWS Budget com alerta por e-mail: Billing → **Budgets** → Cost budget (ex.: $10/mês, alerta em
80%). Protege contra loop de Lambda, bot de tráfego e qualquer surpresa. O custo por app é
acompanhado via tag `Project` (§12.6).

### 6.5 Domínio próprio

- Certificado **ACM obrigatoriamente em `us-east-1`** (exigência do CloudFront), validação DNS.
- Distribution: `Aliases: [dominio.com.br, www.dominio.com.br]` + `ViewerCertificate`
  (`SslSupportMethod: sni-only`, `MinimumProtocolVersion: TLSv1.2_2021`).
- DNS: registro **A e AAAA alias** para o domínio da distribution (apex não aceita CNAME).
- `www` existe no certificado e no alias, mas **redireciona** para o apex na borda (§6.1).

⚠️ **Alias de CloudFront é global e exclusivo.** Duas distributions não podem declarar o mesmo
`Aliases` — a segunda recusa com `CNAMEAlreadyExists`. Migrar um domínio entre contas/stacks é,
por isso, uma sequência obrigatória: subir o CDN novo **sem** domínio → soltar o alias no antigo
→ redeployar o novo **com** domínio → repontar o DNS. Não é "trocar uma variável e deployar".

### 6.6 Múltiplos frontends no mesmo produto (opcional)

Quando o produto tem mais de um app (portal, app do cliente, loja): **um bucket S3** e **uma
distribution por app**, cada uma com seu `DefaultRootObject` e sua função de fallback. O build
Vite usa **multi-entry** — um HTML por app. Nunca copiar um HTML sobre o outro; o build já gera
cada um correto. O deploy é **um script** que sincroniza o bucket e **invalida todas as
distributions** — invalidar só uma deixa as demais com cache stale.

### 6.7 Recursos retidos — `delete-stack` não apaga tudo

`UserPool`, tabela e buckets levam `DeletionPolicy: Retain` + `UpdateReplacePolicy: Retain`
porque perder qualquer um deles é perder o produto. A consequência precisa estar escrita em
letras grandes no `CLAUDE.md`:

> ⚠️ **`delete-stack` deixa recurso pago para trás, silenciosamente.** Derrubar um ambiente exige
> um script (`destruir-ambiente.ps1`) que apague explicitamente o que foi retido.

O script tem duas travas: **roda em modo dry-run por padrão** (`-Confirmar` para valer) e
**recusa-se a executar contra a conta de produção** por account id literal.

⚠️ `DeletionPolicy: Retain` **também retém no rollback**: um `create` que falha deixa tabela,
pool e bucket órfãos, e a próxima tentativa falha com "already exists". Limpar à mão antes de
tentar de novo.

### 6.8 Duas contas (produção e teste) — a escolha é de deploy, nunca de código

Quando existe uma conta de teste (limite da AWS na conta nova, sandbox de e-mail, validação de
CDN), a regra que evita o pior é: **o `template.yaml` não sabe em que conta está**. Usa
`${AWS::AccountId}` e `Parameter`, nunca `if` de ambiente, branch paralela ou arquivo duplicado.

```powershell
.\deploy.ps1 all                  # conta default (a de trabalho)
.\deploy.ps1 all -Conta producao  # a outra — exige a flag explícita
```

O script confere `sts get-caller-identity` contra a conta esperada **antes de qualquer escrita**.
O `.env.production.local` do frontend é **gerado pelo deploy** a partir dos outputs da stack
(fica no `.gitignore`): é o que permite publicar a mesma árvore de código nas duas contas sem
trocar arquivo.

⚠️ **Dado criado no ambiente de teste vive na tabela de teste.** Não há migração automática.

### 6.9 `Parameter` × env var literal — a armadilha mais cara do SAM

⚠️ **Mudar o `Default` de um `Parameter` não muda nada numa stack que já existe.** O deploy passa
só alguns parâmetros em `--parameter-overrides`; para todo o resto o CloudFormation usa o **valor
anterior da stack**, não o `Default` novo do template. Foi assim que um preço continuou em 4900
depois de o template já dizer 4990 — o deploy passou, o changeset ficou verde e a Lambda seguiu
cobrando o valor velho.

> **Valor que é decisão de produto (e que tem cópia no frontend) vai LITERAL na env var, não como
> `Parameter`.** `Parameter` só para o que muda de verdade entre contas: domínio, flag de CDN,
> segredo.

⚠️ **Segredo nunca vai no `samconfig.toml`.** Passa por `--parameter-overrides` uma vez; nos
deploys seguintes o CloudFormation preserva o valor da stack.

### 6.10 Script de deploy — determinístico, e com três listas que andam juntas

O deploy não é uma sequência de comandos digitados: é um script versionado que faz
build → conferência de conta → `sam deploy` → geração do `.env` → build do frontend →
sync → invalidação. O núcleo, e a armadilha que ele encapsula:

```powershell
# Assets com hash no nome: cache longo, nunca precisam de invalidação.
# ATENÇÃO: arquivo SEM hash no nome precisa estar nas TRÊS listas abaixo
# (--exclude aqui, --include no sync seguinte, --paths na invalidação).
# O sitemap.xml ficou de fora uma vez e subiu com max-age de um ano: uma
# atualização dele ficaria presa no edge sem ninguém perceber.
#
# ATENÇÃO 2: o padrão "index.html" casa SÓ a chave de topo. Os HTMLs
# prerenderizados vivem em _ssg/ e precisam do próprio padrão — sem ele o HTML
# de SEO sobe immutable e fica preso no edge por um ano.
aws s3 sync .\dist\ "s3://$bucket/" --delete --profile $Perfil `
  --cache-control "public, max-age=31536000, immutable" `
  --exclude "index.html" --exclude "*.webmanifest" --exclude "sw.js" `
  --exclude "robots.txt" --exclude "sitemap.xml" --exclude "_ssg/*"

aws s3 sync .\dist\ "s3://$bucket/" --profile $Perfil `
  --cache-control "no-cache" `
  --exclude "*" --include "index.html" --include "*.webmanifest" --include "sw.js" `
  --include "robots.txt" --include "sitemap.xml" --include "_ssg/*"

aws cloudfront create-invalidation --distribution-id $dist --profile $Perfil `
  --paths "/index.html" "/manifest.webmanifest" "/sw.js" "/robots.txt" "/sitemap.xml" "/_ssg/*"
```

⚠️ Ao adicionar um arquivo sem hash, **as três listas mudam no mesmo commit**. Vale a pena usar
curinga (`google*.html`) quando um arquivo futuro do mesmo tipo cairia na mesma regra.

---

## 7. Frontend

### 7.0 Arquitetura de rotas e bundles — as três audiências

Esta é a decisão estruturante do frontend, e ela precede qualquer escolha de componente.

```
/                          → público estático   → HTML prerenderizado, hidrata
/como-funciona, /termos…   → público estático   → HTML prerenderizado, hidrata
/{segmento}-{variante}     → landings programáticas (mesma tabela, N rotas)  §13.9
/{slug}/*                  → público dinâmico   → shell + chunk do tenant (lazy)
/app/*                     → autenticado        → shell + chunk do portal (lazy)
```

```tsx
// Shell.tsx — a árvore SEM roteador, compartilhada por cliente e prerender
const Portal = lazy(() => import('@/portal/PortalRoutes'))   // ⚠️ único ponto com aws-amplify
const Tenant = lazy(() => import('@/tenant/TenantRoutes'))   // bundle do visitante

<Routes>
  <Route path="/" element={<LandingPage />} />
  <Route path="/como-funciona" element={<ComoFuncionaPage />} />
  {SEGMENTOS.map((s) => (
    <Route key={s.id} path={caminho(s)} element={<LandingSegmento segmento={s} />} />
  ))}
  <Route path="/app/*" element={<Portal />} />
  {/* ⚠️ O catch-all de slug entra por ÚLTIMO, e toda rota fixa nova precisa entrar
      nas blocklists de reservados no MESMO commit (§7.5). */}
  <Route path="/:slug/*" element={<Tenant />} />
</Routes>
```

**Por que a fronteira de `lazy` está exatamente aí:** o SDK de autenticação são ~130 kB que o
visitante anônimo nunca usa. Ele entra **uma vez**, no módulo do portal, com
`Amplify.configure` no escopo do módulo (roda quando o chunk carrega). Qualquer import estático
de `tenant/` ou `pages/` para um módulo que puxe o cliente autenticado desfaz isso **em
silêncio** — daí a guarda automática do §17.2.

⚠️ **O react-router não aceita segmento parcialmente dinâmico** (`/prefixo-:variante`):
`compilePath` só reconhece `:` logo depois de `/`. Landings por segmento são **rotas
explícitas geradas de uma tabela** (`EVENTOS.map(...)`), não uma rota-padrão.

**O ponto cego desta arquitetura é a terceira audiência.** As páginas estáticas são
prerenderizadas e as autenticadas não têm SEO nem urgência de LCP — mas a **página pública
dinâmica** costuma ser a mais importante do produto (é a que o visitante recebe por link) e é a
única 100% CSR: shell vazio → baixar e parsear ~180 kB gz de JS → **só então** começar o `fetch`
do payload. São duas viagens em série que poderiam ser uma.

**Correção de ~6 linhas, custo zero, para fazer no dia 1** — disparar o fetch no `index.html`,
em paralelo com o download do bundle:

```html
<script>
  // Começa o fetch do payload público ANTES do bundle existir. O React Query
  // consome esta promise no primeiro render em vez de abrir a requisição do zero.
  var s = location.pathname.split('/')[1]
  if (s && s.indexOf('.') === -1 && !/^(app|c|m|v1|assets|_ssg)$/.test(s))
    window.__payload = fetch('/v1/public/recursos/' + s).then(function (r) { return r.json() })
</script>
```

⚠️ **Isso cria mais uma cópia da blocklist de rotas** (§7.5) — a quinta. Ou ela entra no teste de
espelho no mesmo commit, ou o script vai buscar `/v1/public/recursos/termos` quando alguém abrir
a página de termos. Num projeto novo, o certo é **gerar esse regex da mesma tabela** que gera as
outras quatro, em vez de escrevê-lo à mão.

Se o produto justificar o passo maior, o caminho é **renderizar o above-the-fold no próprio
backend** — a rota de Open Graph (§13.7) já prova que montar HTML no FastAPI é barato e cacheável
na borda. SSR em Node só se paga quando a página inteira precisa ser servidor-renderizada.

### 7.1 App.tsx e Shell.tsx — por que são dois arquivos

```tsx
// App.tsx  (browser)
const router = createBrowserRouter([{ path: '*', element: <Raiz /> }])
export default function App() {
  return <Provedores><RouterProvider router={router} /></Provedores>
}
```

⚠️ **`createBrowserRouter` + `RouterProvider`, não `<BrowserRouter>`** — e não é estilo.
`useBlocker` (a guarda de saída de formulário sujo, §7.12) abre com
`useDataRouterContext("useBlocker")` + `invariant`: sob `<BrowserRouter>` ele **lança**, porque
só o `RouterProvider` monta o `DataRouterContext`. Vale igual para `unstable_usePrompt`.

⚠️ **Uma rota só, e com splat.** É a splat que mantém `pathnameBase = '/'` e faz os `<Routes>`
descendentes continuarem casando contra o caminho **absoluto** — nenhuma rota precisa mudar ao
adotar o data router. Sem o `*`, todo caminho que não seja `/` cai fora.

⚠️ **`App.tsx` não pode ser importado em Node.** `createBrowserRouter` roda no escopo do módulo
e chega em `document.defaultView` — só o import estoura. Por isso a árvore vive em `Shell.tsx`
(sem roteador) e cada lado monta o seu: `RouterProvider` no browser, `StaticRouter` no build.
Nenhum dos dois emite DOM próprio, então o markup sai idêntico e a hidratação bate.

⚠️ **Bloquear POP depende da contabilidade de `idx` do próprio react-router.**
`history.pushState` cru em qualquer lugar do app a corrompe, e o bloqueio passa a falhar em
silêncio em produção.

⚠️ **Nada na árvore prerenderizada pode ler `window`/`localStorage`/`Date.now()`/`Math.random()`
no RENDER.** Em efeito, à vontade. Ver §13.4.1 — é a falha silenciosa mais cara do SSG.

### 7.2 api/client.ts — Axios + cache de token em memória

```typescript
import axios from 'axios'
import { fetchAuthSession } from 'aws-amplify/auth'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL })

// Cache do token em memória — evita `fetchAuthSession()` a cada request (ele é
// async e seria chamado 20× se houver 20 requests simultâneos).
let _token: string | null = null
let _expiraEm = 0

export function resetTokenCache() { _token = null; _expiraEm = 0 }

async function getToken(): Promise<string | null> {
  if (_token && Date.now() < _expiraEm - 120_000) return _token   // 2 min de folga
  try {
    const session = await fetchAuthSession()
    const idToken = session.tokens?.idToken
    if (!idToken) return null
    _token = idToken.toString()
    _expiraEm = (idToken.payload.exp as number) * 1000
    return _token
  } catch { return null }
}

api.interceptors.request.use(async (config) => {
  const token = await getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) { resetTokenCache(); window.location.href = '/app/login' }
    return Promise.reject(err)
  },
)
export default api
```

⚠️ **`api/publicClient.ts` é um arquivo separado, sem Amplify.** É o único cliente que
`tenant/` e `pages/` podem importar. Não é duplicação supérflua: é a fronteira que a guarda de
bundle verifica.

### 7.3 api/{resource}.ts e 7.4 hooks — React Query

```typescript
export const itensApi = {
  listar: () => api.get<Item[]>('/v1/itens').then((r) => r.data),
  criar:  (body: ItemCreate) => api.post<Item>('/v1/itens', body).then((r) => r.data),
  editar: (id: string, body: Partial<ItemCreate>) =>
            api.patch<Item>(`/v1/itens/${id}`, body).then((r) => r.data),
}
```

```typescript
const QUERY_KEY = ['itens']
export function useItens() { return useQuery({ queryKey: QUERY_KEY, queryFn: itensApi.listar }) }
export function useCriarItem() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: itensApi.criar,
                       onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }) })
}
```

```typescript
const queryClient = new QueryClient({
  defaultOptions: { queries: {
    staleTime: 60_000,            // 1 min fresco: evita refetch em toda navegação
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,  // sem API call ao focar a janela
    retry: 1,                     // 1 retry cobre cold start de Lambda
  } },
})
```

⚠️ **`queryClient.clear()` no login e no logout.** Sem isso, o cache do usuário anterior aparece
para o próximo na mesma aba.

#### 7.4.1 Paginação no frontend — useInfiniteQuery

```typescript
const query = useInfiniteQuery({
  queryKey: QUERY_KEY,
  queryFn: ({ pageParam }: { pageParam?: string }) => itensApi.listar({ cursor: pageParam }),
  initialPageParam: undefined as string | undefined,
  getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
})
const data = query.data?.pages.flatMap((p) => p.items)
```

**A tela consumidora é obrigada a fiar `fetchNextPage`/`hasNextPage`** — destructar só `data`
renderiza apenas a 1ª página e deixa o resto inacessível (bug silencioso: a paginação existe no
backend, mas o usuário nunca passa das N mais recentes).

**Filtros vão para o backend como parâmetro** (entram na `queryKey` e na chamada), nunca
`.filter()` sobre `data` já paginado — mesma armadilha do §4.7.

Se o mesmo dado também alimenta um seletor que precisa da lista completa, usar uma `queryKey`
separada que encadeia `fetchNextPage` até `hasNextPage` ser `false` — sem duplicar lógica de fetch.

### 7.5 Rotas reservadas — a blocklist que existe em QUATRO lugares

Quando a rota pública mora na raiz (`/{slug}`), **toda rota fixa da SPA é um slug proibido**.
A lista existe em quatro cópias, por razões técnicas legítimas (linguagens e runtimes
diferentes):

| # | Onde | Papel |
|---|---|---|
| 1 | `frontend/src/utils/slug.ts` | validação/UX ao escolher o endereço |
| 2 | `backend/app/services/slug_service.py` | **a garantia real**, junto com a escrita condicional |
| 3 | `RESERVADOS` da CloudFront Function | decide se `/{x}` é slug de tenant p/ o bot de preview |
| 4 | `SSG` da CloudFront Function | decide se a rota recebe HTML estático ou o shell |

⚠️ **Esquecer a #3** faz `/rota-nova` redirecionar o WhatsApp para um convite inexistente — e só
o preview quebra, a rota continua abrindo para gente. ⚠️ **Esquecer a #4** é pior: a página abre
normal, em CSR, e **só o SEO não acontece**.

> **Não confie na memória: escreva o teste.** Um teste de vitest lê o `.py` e o `.yaml` e reprova
> `npm test` quando qualquer um dos quatro divergir (§17.3).

**Prefixo reservado economiza entradas.** `lista-de-presentes` cobre a página-hub e **todas** as
landings por segmento (`/lista-de-presentes-casamento`, `-cha-de-bebe`, …) com uma regra só — a
sexta landing não toca em blocklist nenhuma. É por isso que o caminho é longo em vez de
`/casamento`: slug curto e genérico é justamente o que um usuário quer registrar, e queimar
cinco deles é custo de produto.

Reservados **com ponto** (`sw.js`, `robots.txt`) ficam fora das cópias #3/#4 de propósito: a
regex de slug não casa com ponto, então nunca chegam lá.

```typescript
export const SLUGS_RESERVADOS = new Set([
  'app','api','v1','m','c','assets','static','admin',
  'login','signup','cadastro','forgot-password','dashboard',
  'conta','configuracoes','perfil','sobre','ajuda','contato','precos','termos',
  'privacidade','como-funciona','blog','status','suporte','brand',
  'sw.js','manifest.webmanifest','robots.txt','sitemap.xml','favicon.ico',
  'www','mail','ftp','smtp','ns','cdn',                  // subdomínios comuns
])
export const PREFIXOS_RESERVADOS = ['lista-de-presentes', '.well-known']
```

⚠️ **A unicidade real é a escrita condicional** no item `SLUG#{slug}` (§5.6). A validação do
frontend é só UX.

### 7.6 Router aninhado — a pré-visualização

Mostrar o site público dentro do portal (pré-visualização) exige um `MemoryRouter` dentro do
`BrowserRouter`. O react-router v7 tem `invariant(!useInRouterContext())`, então aninhar
**lança** — desarma-se zerando `UNSAFE_LocationContext`.

⚠️ **Zerar só esse troca a exceção por uma página EM BRANCO, sem erro e sem aviso**: o `<Routes>`
de dentro ainda enxerga o `RouteContext` do portal, se trata como descendente e tenta casar
`/{slug}` contra o prefixo `/app/…`. Tem que zerar `UNSAFE_RouteContext` **junto**. O `tsc`
passa nos dois casos — quem pega é um teste de `renderToString` com router aninhado.

⚠️ **Payload de preview que "é o mesmo do público" tem que sair da MESMA função.** Montar o dele
à parte diverge em silêncio (campo faltando, filtro de item inativo esquecido). O preview chama
o mesmo montador do payload público, pulando apenas a resolução de slug.

### 7.7 auth/AuthProvider.tsx — checar VALIDADE, não existência

```tsx
async function load(): Promise<AuthUser | null> {
  try {
    const u = await getCurrentUser()
    const idToken = (await fetchAuthSession()).tokens?.idToken

    // ⚠️ Quando o refresh falha, o Amplify ainda devolve um idToken PRESENTE porém
    // EXPIRADO. Tratar isso como "logado" manda o token morto ao backend → 401 →
    // loop de volta ao login.
    const exp = (idToken?.payload?.exp as number | undefined) ?? 0
    if (!idToken || exp * 1000 <= Date.now()) { setUser(null); return null }

    const attrs = (await fetchUserAttributes().catch(() => ({}))) as Record<string, string>
    const authUser = { userId: u.userId, username: u.username, email: attrs.email, name: attrs.name }
    setUser(authUser)
    return authUser
  } catch { setUser(null); return null }
}

async function signIn(email: string, password: string) {
  // ⚠️ Limpa estado stale do Amplify ANTES de autenticar. Depois de a sessão expirar
  // e a página recarregar, o storage do Amplify fica inconsistente e `load()` falha
  // em silêncio → loop de redirecionamento para o login.
  try { await amplifySignOut() } catch { /* pode não haver sessão */ }
  resetTokenCache()
  queryClient.clear()

  const result = await amplifySignIn({ username: email, password })
  if (result.isSignedIn && !(await load())) {
    throw new Error('Não foi possível abrir a sessão. Tente de novo.')
  }
}
```

### 7.8 auth/ProtectedRoute.tsx

```tsx
export function ProtectedRoute() {
  const { user, isLoading } = useAuth()
  const location = useLocation()
  if (isLoading) return <TelaDeCarregamento />        // com a marca, não "Carregando..."
  if (!user) return <Navigate to="/app/login" replace state={{ de: location.pathname }} />
  return <Outlet />
}
```

⚠️ O estado `de` guarda o destino para voltar depois do login. Sem ele, quem clica num link
profundo e precisa autenticar cai na home e perde o contexto.

### 7.9 Telas de autenticação — login, cadastro com confirmação, recuperação

Estas três telas são ~80% do atrito de entrada do produto e cada detalhe abaixo corresponde a
um usuário que ficaria preso.

#### 7.9.1 Login

```tsx
async function entrar(e: React.FormEvent) {
  e.preventDefault()
  try {
    await signIn(email, senha)
    // ⚠️ Navegação DURA, não SPA. Depois de a sessão expirar de verdade, o
    // TokenOrchestrator em memória do Amplify continua servindo o idToken expirado
    // dentro do mesmo contexto de página — mesmo após signOut+signIn. Uma navegação
    // soft levaria esse token morto ao portal → 401 → volta ao login (loop).
    // O reload recria o contexto, como abrir uma aba nova.
    window.location.assign('/app')
  } catch (err) {
    if ((err as { name?: string })?.name === 'UserNotConfirmedException') setNaoConfirmado(true)
    setErro(cognitoErrorPtBr(err))
  }
}
```

⚠️ **`UserNotConfirmedException` tem que virar uma saída, não uma mensagem.** Quem abandonou o
cadastro no meio bate exatamente aqui. A tela mostra um botão "Reenviar código de confirmação"
que chama `resendSignUpCode` e navega para a etapa de confirmação com o e-mail no `state`.

#### 7.9.2 Cadastro em três passos — e a detecção de cadastro pendente

Passos: **e-mail → senha+nome → código**. O indicador de passos existe para o usuário saber que
há um código de e-mail chegando antes de escolher a senha.

⚠️ **O passo 1 tenta `resendSignUpCode` ANTES de pedir a senha.** É assim que se detecta um
cadastro que ficou pendente — e sem isso, quem abandonou o cadastro no meio bate em "e-mail já
cadastrado" no login e **fica sem saída nenhuma**:

```tsx
try {
  await resendSignUpCode({ username: email })
  show('Encontramos um cadastro pendente — reenviamos o código.', 'info')
  setPasso('confirmar')                       // sucesso → cadastro pendente
} catch (err) {
  const name = (err as { name?: string })?.name ?? ''
  if (name === 'UserNotFoundException') {
    setPasso('senha')                         // e-mail livre → segue o cadastro
  } else if (name === 'InvalidParameterException' || /already confirmed|CONFIRMED/.test(msg)) {
    setJaCadastrado(true)                     // conta confirmada → manda para o login
  } else {
    setErro(cognitoErrorPtBr(err))
  }
}
```

Depois de `signUp`, tratar `UsernameExistsException` **de novo**: é a corrida rara em que a
conta nasce entre o passo 1 e o submit. Resolve-se sozinha — se o reenvio funciona é pendente,
se não é confirmada.

Na confirmação: `confirmSignUp` → `autoSignIn()` (habilitado por
`options: { autoSignIn: true }` no `signUp`) → **navegação dura** para `/app`, pela mesma razão
do login.

⚠️ **Cooldown no botão de reenvio** (60 s, hook próprio). Sem ele o usuário martela o botão e
bate no `LimitExceededException` do Cognito, que é bem mais longo.

⚠️ **Aviso de spam explícito** na tela de código. É o suporte que não se recebe.

#### 7.9.3 Recuperação de senha — resposta neutra

```tsx
try {
  await resetPassword({ username: email })
  setPasso('confirmar')
} catch (err) {
  const name = (err as { name?: string })?.name ?? ''
  // ⚠️ Resposta neutra de propósito: avançar mesmo quando o e-mail NÃO existe evita
  // transformar esta tela num verificador de cadastros. O texto acompanha:
  // "Se houver uma conta, enviamos um código para lá."
  if (name === 'UserNotFoundException' || name === 'InvalidParameterException') {
    setPasso('confirmar')
  } else { setErro(cognitoErrorPtBr(err)) }
}
```

#### 7.9.4 O que as três compartilham

**Tradução de erro do Cognito, num módulo só.** O `AuthError.name` é estável; a mensagem, não.

```typescript
export function cognitoErrorPtBr(err: unknown): string {
  const name = (err as { name?: string })?.name ?? ''
  const msg = err instanceof Error ? err.message : ''
  if (name === 'NotAuthorizedException')     return 'E-mail ou senha incorretos.'
  if (name === 'UserNotConfirmedException')  return 'Conta ainda não confirmada. Confira seu e-mail.'
  if (name === 'UserNotFoundException')      return 'Não encontramos uma conta com este e-mail.'
  if (name === 'UsernameExistsException')    return 'Este e-mail já está cadastrado.'
  if (name === 'CodeMismatchException')      return 'Código inválido. Confira e tente de novo.'
  if (name === 'ExpiredCodeException')       return 'Código expirado. Peça um novo.'
  if (name === 'LimitExceededException' || name === 'TooManyRequestsException')
                                             return 'Muitas tentativas. Aguarde alguns minutos.'
  if (name === 'InvalidPasswordException')   return 'A senha não atende aos requisitos mínimos.'
  if (msg.includes('Network') || msg.includes('Failed to fetch'))
                                             return 'Erro de conexão. Confira sua internet.'
  return 'Algo deu errado. Tente de novo.'
}
```

**Checklist de senha ao vivo — e ele é espelho da política do pool:**

```typescript
/** ⚠️ Espelha `backend/template.yaml` (PasswordPolicy). Mudar lá exige mudar aqui,
 *  senão o checklist MENTE: o usuário vê tudo verde e o Cognito recusa. */
export const PASSWORD_RULES = [
  { key: 'length', label: 'Mínimo 8 caracteres', test: (p: string) => p.length >= 8 },
  { key: 'upper',  label: 'Uma letra maiúscula', test: (p: string) => /[A-Z]/.test(p) },
  { key: 'lower',  label: 'Uma letra minúscula', test: (p: string) => /[a-z]/.test(p) },
  { key: 'number', label: 'Um número',           test: (p: string) => /[0-9]/.test(p) },
]
```

Além disso, em todas as três: campo de senha com olho de mostrar/ocultar (`tabIndex={-1}`,
`aria-label` que muda), `autoComplete` correto (`email`, `new-password`, `current-password`,
`one-time-code` — é o que faz o iOS oferecer o código do SMS/e-mail), confirmação de senha com
erro inline, botão desabilitado até o formulário ser válido, e estado de carregamento com rótulo
próprio ("Entrando…", "Criando conta…").

#### 7.9.5 `<head>` das telas de auth

⚠️ **As telas de autenticação precisam de `noindex` explícito.** Elas não passam pelo layout do
portal (cada uma se desenha inteira), então herdam o `index, follow` do `index.html`. O
`robots.txt` cobre `/app/`, mas só vale para o crawler que o lê **antes** de rastrear — um link
direto para `/app/login` numa página de terceiro contorna isso, e a meta é a única garantia.

Uma casca de rota que só escreve `<head>` resolve as três de uma vez — e dá título próprio a
cada aba ("Entrar", "Criar conta", "Recuperar senha"), que sem isso herdariam o título da página
de onde o usuário veio.

#### 7.9.6 E-mail: Cognito default × SES

O `EmailSendingAccount: COGNITO_DEFAULT` manda os códigos de confirmação sem nenhuma
configuração — é o certo para começar, e tem limite baixo (~50/dia). Migrar para SES exige
identidade verificada **e** sair do sandbox (que é um pedido ao suporte, com prazo e possível
recusa). **Planejar isso cedo**: o e-mail transacional do produto (recibo, notificação) depende
do SES, não do Cognito, e a saída do sandbox costuma exigir que o site já esteja no ar.

### 7.10 types/index.ts — espelho dos enums

```typescript
export type ItemStatus = 'ATIVO' | 'INATIVO'

export const ROTULO_STATUS: Record<ItemStatus, string> = {
  ATIVO: 'Ativo', INATIVO: 'Inativo',
}

export interface Item {
  item_id: string
  preco_centavos: number        // ⚠️ INTEIRO. Formatação só na borda (§9.1)
  status: ItemStatus
  criado_em: string
}
```

### 7.11 Estado compartilhado entre telas — store de módulo, não `useState`

⚠️ Um estado lido em cinco lugares ao mesmo tempo (contador no header, na vitrine, na página do
carrinho, no checkout) **não** pode ser `useState` por componente: cada um fica com a sua cópia,
e o usuário só vê o número mudar depois de recarregar. O `localStorage` compartilha o **dado**,
não o render.

O padrão é um store de módulo com `useSyncExternalStore`: uma fonte, um snapshot, todos os
consumidores re-renderizam juntos. Vale para carrinho, preferência de tema, sessão de rascunho.

### 7.12 Guarda de saída — formulário sujo

`useBlocker` (exige data router, §7.1) intercepta navegação **dentro** do app. Mas saída de
documento (F5, fechar aba, `window.location.assign` do "Sair") ele não vê — daí o
`beforeunload` como segunda camada.

⚠️ **O `beforeunload` tem que ser DESARMADO quando a saída foi autorizada no nosso diálogo.**
Sem um flag `liberado`, o usuário escolhe "Sair sem salvar" no modal do app e leva o "deseja
sair do site?" nativo **em cima** — porque o formulário continua sujo. Desarmar só nesse
caminho: em F5 e fechar aba o nativo é o único recurso que existe.

### 7.13 Meta tags por rota — imperativo, com padrões

Ver §13.3. O ponto de arquitetura: o helper `aplicarMeta` é **neutro** (consumido pelo portal e
pelo público) e por isso não pode importar nada que puxe o cliente autenticado.

⚠️ **Ele precisa de valores PADRÃO para os campos omitidos.** O `<head>` é do documento inteiro:
numa navegação client-side, o que a rota anterior escreveu **fica**. Sair de um conteúdo de
tenant para `/termos` deixava a `og:image` daquele tenant na página de termos. Corrigir chamador
a chamador não resolve — o próximo chamador esquece de novo.

### 7.14 Configuração de build

```typescript
// vite.config.ts — o essencial
export default defineConfig({
  plugins: [react(), tailwindcss(), VitePWA({ /* §15 */ })],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
})
```

```json
{
  "scripts": {
    "build": "tsc -b && vite build && vite build --ssr src/entry-ssg.tsx --outDir dist-ssr && node scripts/prerender.mjs && node scripts/verificar-bundle.mjs",
    "test": "vitest run",
    "typecheck": "tsc -b --noEmit"
  }
}
```

⚠️ **As guardas fazem parte do `build`, não de um script opcional.** Guarda que se roda "quando
lembra" não existe (§0.3).

---

## 8. Deploy

### 8.0 Regras de fluxo (obrigatórias)

1. **Commit antes do deploy** — o SAM builda a partir do disco local, não do git. Nunca deployar
   com arquivos não commitados: `git status` → `git diff` → `git add <arquivos>` → `git commit`
   → deploy.
2. **Revisar changeset** — `sam deploy --no-execute-changeset` → revisar o que o CloudFormation
   vai alterar → `execute-change-set`. **Nunca** executar changeset que substitua ou apague
   tabela, user pool ou distribution sem confirmação explícita.
3. **Nunca `git add -A`** em backend/infra sem revisar o diff.
4. **Terminou de alterar, commita e sobe.** Deixar o ambiente de trabalho sempre no ar é o que
   torna qualquer verificação possível. (`push` para o remoto e deploy na conta de produção
   continuam exigindo pedido explícito.)

### 8.1 Backend

```bash
cd backend
sam build
sam deploy --profile {perfil} --no-execute-changeset   # revisar
aws cloudformation execute-change-set --change-set-name ... --profile {perfil}

sam local start-api --profile {perfil}                 # desenvolvimento local
```

### 8.2 Frontend

Ver §6.10 — o sync tem **três listas que andam juntas** e a invalidação atinge só os arquivos
sem hash. Na prática, tudo isso mora no `deploy.ps1` e ninguém digita esses comandos à mão.

### 8.3 Scripts de manutenção

`backend/scripts/` guarda os scripts que rodam **o código real contra a infra real**: recálculo
de agregados, seed de demonstração, verificação de fluxo crítico (§17.5). Eles não são teste
automatizado — são a forma de exercitar o que só existe em produção (webhook, presigned POST,
CDN) e de reparar dado.

⚠️ **Docstring de script não leva emoji.** Ela é impressa no console quando falta argumento, e o
cp1252 do PowerShell 5.1 estoura com `UnicodeEncodeError` em `⚠️`. Usar "ATENCAO:" ali (§18).

---

## 9. Padrões Obrigatórios

### 9.1 Dinheiro — inteiro em centavos, nunca float

> **Armazenamento canônico: a menor unidade monetária como `int`.** Nunca `float`, nunca string
> em cálculo.

```python
# CORRETO — backend
preco_centavos: int = Field(ge=0)        # 9990 = R$ 99,90
```

```typescript
// CORRETO — frontend
preco_centavos: number                   // inteiro, sempre
export const formatBRL = (centavos: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
    .format(centavos / 100)
```

**Por que inteiro e não `Decimal`:** os contadores agregados usam `ADD` atômico do DynamoDB
(§5.5), e inteiro é exato e trivialmente somável — `Decimal` no DynamoDB volta como
`decimal.Decimal` e a soma atômica de valores fracionários é fonte de bug de arredondamento.
A conversão para a unidade maior acontece **só na borda**: `round(centavos / 100, 2)` ao chamar
o gateway de pagamento, `Intl.NumberFormat` para exibir.

⚠️ **Formatação sempre por um helper único** (`formatBRL`). Formatação espalhada diverge:
`R$ 99.9`, `R$ 99,90`, `99,9` na mesma tela.

⚠️ Se o produto **não** tiver agregação atômica de valores, `Decimal` no backend + string no
frontend também é correto — o que **nunca** é aceitável é `float` em qualquer ponto do caminho.
Escolher um dos dois e registrar a escolha na spec técnica do projeto.

### 9.2 Isolamento — o id do dono vem do token, sempre

```python
user_id: str = Depends(get_current_user_id)          # nunca do body, nunca do path
PK = keys.pk_user(user_id)
```

Toda escrita que recebe id de recurso **valida a posse** antes do efeito (§5.1). Recurso de
outro dono → **404**.

### 9.3 Enums — tipados e espelhados

```python
class Status(str, Enum): ATIVO = "ATIVO"; INATIVO = "INATIVO"
```
```typescript
export type Status = 'ATIVO' | 'INATIVO'
```

### 9.4 Error responses — estruturadas quando o frontend precisa decidir

```python
raise HTTPException(404, "Item não encontrado")               # simples

raise HTTPException(409, detail={                             # estruturado
    "code": "conflito_exige_confirmacao",
    "items": ["id1", "id2"],
    "message": "Itens já existem nesse período",
})
```

```typescript
if (err.response?.status === 409) {
  const { code, items } = err.response.data.detail
  if (code === 'conflito_exige_confirmacao') { /* abre modal */ }
}
```

⚠️ **O frontend decide por `code`, nunca por texto de mensagem.** Mensagem muda; código é
contrato.

### 9.5 Nomes de chaves DynamoDB

Montadas **só** em `repositories/keys.py` (§4.4.1). O padrão é `TIPO#{id}`, maiúsculo,
com `#` como único separador — o que implica a regra de URL do §5.7.

### 9.6 Espelho tem teste (§0.2)

Toda informação duplicada entre camadas entra na tabela de espelhos do `CLAUDE.md` do projeto e
ganha um teste. Os espelhos típicos desta stack:

| Informação | Cópias |
|---|---|
| Blocklist de rotas | 4 (§7.5) |
| Política de senha | 2 — `template.yaml` e checklist da tela |
| Enum de domínio | 2 — `models/enums.py` e `types/index.ts` |
| `Cache-Control` do upload | 2 — cliente e `Conditions` do presigned POST |
| Rótulo de tipo/estado | 2 — o backend que gera OG e o frontend que gera preview |
| Proporção de recorte de imagem | 2 — uploader e o frame que renderiza (§14.3) |
| Tabela de rotas estáticas | 3 — prerender, sitemap, `SSG` da função de edge |

---

## 10. Otimizações de Custo e Performance

### 10.0 Guardrail — ordem de prioridade (custo é o último critério)

> **1º Viabilidade e correção → 2º Performance e escalabilidade → 3º Custo** (§0.1).

Onde as otimizações de custo **cedem** (e os anti-patterns do §10.2 **não** se aplicam):

- **Índice necessário recebe índice.** "Poucos GSIs" combate índices **redundantes**, não
  **necessários**. Access pattern real não servível por query direta → cria-se o GSI; 1 WRU extra
  é muito melhor que um `Scan` que não escala.
- **Consistência forte onde há read-after-write.** Eventual por padrão (metade do custo) vale
  para leitura tolerante a atraso; num hot path que relê o que acabou de escrever, usar leitura
  **consistente**.
- **Dimensionar Lambda pela UX, medindo.** Ver §10.2 — a regra de bolso "256 MB basta" é falsa
  para este workload.
- **`ALL_NEW` quando a alternativa é um GetItem.** O contador de rate limit (§4.8) é o exemplo.
- **Não denormalizar até virar bug.** Cada cópia (ponteiro, snapshot) tem custo de consistência.
  Vale quando colapsa um read quente; não vale quando cria caminhos de atualização frágeis.

### 10.1 Decisões arquiteturais já tomadas (não reverter)

| Decisão | Motivo |
|---|---|
| HTTP API v2 (não REST API) | 71% mais barato; JWT authorizer nativo sem Lambda extra |
| Verificação de JWT no authorizer, não na Lambda | Sem JWKS nem verificação criptográfica por request (§4.3) |
| arm64 / Graviton2 | 20% mais barato por GB-segundo + cold start menor |
| DynamoDB PAY_PER_REQUEST | Escala a zero; provisioned tem custo mínimo |
| Monolambda para a API | Um cold start, um pacote; roteamento no FastAPI (§4.1) |
| Cron em Lambda separada, 256 MB | Perfil oposto ao da API — nunca está quente (§4.9) |
| CloudFront como fachada única | Sem CORS, cache de API na borda, PWA trivial (§6.0) |
| CloudFront Functions (não Lambda@Edge) | ~1/6 do preço, sem cold start, suficiente p/ roteamento |
| Carrinho/rascunho no `localStorage` | Zero escrita no banco antes da conversão |
| Cache de token em memória no frontend | Evita `fetchAuthSession()` por request |
| Upload direto ao S3 por presigned POST | Imagem nunca trafega pela Lambda (§14) |
| TTL em quota/lock/credencial temporária | O DynamoDB limpa sozinho, sem delete explícito |

### 10.2 Anti-patterns a evitar

**DynamoDB — não fazer `get_item` antes de `update_item`/`delete_item`:**
```python
item = repo.get_item(pk, sk)                 # ERRADO — 2 operações e uma corrida no meio
if not item: raise HTTPException(404)
repo.update_item(pk, sk, campos)

repo.update_item(pk, sk, campos, condicao="attribute_exists(PK)")   # CORRETO — 1 operação
```

**DynamoDB — `ReturnValues="ALL_NEW"` não é default** (consome RCU): opt-in, com motivo.

**DynamoDB — GSI com `ALL` quando `KEYS_ONLY` serve** dobra o custo de escrita do índice.

**Lambda — nunca x86_64:** `Architectures: [arm64]` é 20% mais barato e mais rápido, sem mudar
uma linha de Python.

**Lambda — MemorySize se define MEDINDO, não por regra de bolso.**

A intuição "app DynamoDB-bound é I/O-bound, logo 256 MB basta" **foi medida e é falsa** para
FastAPI + Pydantic: a serialização domina e o DynamoDB responde em poucos ms. Como a Lambda
aloca **CPU proporcional à memória**, num workload CPU-bound a duração cai na mesma proporção em
que a memória sobe — e o **GB-s por requisição fica constante**.

Medido em produção (endpoint público, 12 amostras quentes por configuração):

| Memória | Warm | Cold start | GB-s/req | Custo/1M req |
|---|---|---|---|---|
| 256 MB | 76,4 ms | 2.156 ms | 0,0191 | US$ 0,25 |
| 512 MB | 37,2 ms | 1.834 ms | 0,0186 | US$ 0,25 |
| 1024 MB | 19,7 ms | 1.575 ms | 0,0197 | US$ 0,26 |

⚠️ **4× mais rápido pelo mesmo preço.** Subir memória só custa caro quando o workload é
genuinamente I/O-bound — aí a duração não cai e paga-se pelo GB a mais. Acima de 1024 MB o ganho
some (o piso vira o I/O) e o custo sobe.

⚠️ **Função sempre fria (cron) é o caso oposto:** o tempo é dominado pelo `init`, que **não**
melhora com memória, e não há latência para comprar. Deixar em 256 MB.

⚠️ **Remedir depois de trocar versão de FastAPI/Pydantic** — muda o `init` e pode mover o ponto
ideal.

**Frontend — não chamar `fetchAuthSession()` em cada request** (§7.2).

**CloudFront — não invalidar `/*`:**
```bash
aws cloudfront create-invalidation --paths "/*"                    # ERRADO
aws cloudfront create-invalidation --paths "/index.html" "/sw.js" "/_ssg/*"   # CORRETO
```
O Vite gera hash nos assets; só os arquivos sem hash precisam de invalidação (§6.10).

**Imagem pública por presigned GET** — não cacheia e cobra um S3 GET por visualização (§14.1).

**Polling que consulta o provedor externo a cada requisição.** Quem confirma é o webhook; o
polling lê **o nosso item**. O provedor só é chamado na primeira abertura ou como fallback
espaçado por um carimbo (`ultima_consulta`).

### 10.3 Estimativa de custo por volume

| Usuários ativos/mês | Requests/mês | Custo estimado |
|---|---|---|
| 1–10 | < 100k | **$0.00** (free tier cobre tudo) |
| 10–100 | 100k–1M | **$0.10–$1.00** |
| 100–1.000 | 1M–10M | **$1.00–$10.00** |
| > 1.000 | > 10M | Avaliar cache mais agressivo e agregação por Streams |

### 10.4 Otimizações opcionais (só quando o custo aparecer)

- **Lambda Layers**: separa dependências do código. Reduz cold start (~30%) e o tamanho do
  pacote. Só vale com múltiplas Lambdas ou quando o cold start incomoda.
- **DynamoDB DAX**: só com > 1M leituras/mês do mesmo dado. Custo fixo (~$0.25/h) — inviável em
  baixo volume.
- **API Gateway Caching**: cobra por hora independentemente do uso. **O behavior cacheado do
  CloudFront (§6.0) faz o mesmo de graça** — preferir sempre.
- **S3 Intelligent Tiering**: para arquivos grandes e raramente acessados. Inútil para SPA.

---

## 11. Checklist — Novo Projeto

### Base
- [ ] Copiar este arquivo para `docs/ARCHITECTURE.md` do novo projeto
- [ ] Criar `CLAUDE.md` na raiz a partir do **template do §22**
- [ ] Definir nome único (`{projeto}`) — prefixo de stack, tabela, bucket, pool e tag de custo
- [ ] Criar `docs/ESPEC_TECNICA.md` (modelo de dados e access patterns) e `docs/ROADMAP.md`
      (fases executáveis) — este documento é o genérico, aquele é o do produto

### Infraestrutura
- [ ] `Type: AWS::Serverless::HttpApi` (não `::Api`), `Architectures: [arm64]`, `Timeout: 29`
- [ ] `MemorySize` da API definido **por medição** (§10.2); cron em 256 MB
- [ ] Authorizer JWT no API Gateway; rotas públicas com `Auth: { Authorizer: NONE }`
- [ ] SK patterns definidos e centralizados em `keys.py`
- [ ] Campo `timezone` (**nome IANA**) no perfil desde a primeira migração; `tzdata` no
      `requirements.txt`; `services/locale_service.py` como ponto único (§20.2)
- [ ] GSIs **sparse**, no máximo dois; access pattern real que precisa de índice **recebe** índice
- [ ] TTL habilitado (`TimeToLiveSpecification`) + `PointInTimeRecovery`
- [ ] `DeletionPolicy: Retain` + `UpdateReplacePolicy: Retain` em tabela, pool e buckets (§6.7)
- [ ] `destruir-ambiente.ps1` escrito **junto** com o primeiro deploy, com dry-run e trava de conta
- [ ] LogGroup explícito por Lambda, com `RetentionInDays` e **nome literal** (§6.3)
- [ ] Distribution única com os behaviors do §6.0, **na ordem certa**
- [ ] `PriceClass` conforme a geografia do público — **`_100` deixa a América do Sul de fora** (§6.0)
- [ ] Fallback de SPA por **CloudFront Function**, nunca `CustomErrorResponses` (§6.1)
- [ ] Cache policy própria por behavior; `MaxTTL` conferido contra o `s-maxage` do origin
- [ ] `SecurityHeadersPolicy` aplicada; CSP adiada para `Report-Only` (§6.2)
- [ ] Budget/alerta de custo criado na conta (§6.4)
- [ ] Tags + AppRegistry + cost allocation tag ativada (§12)
- [ ] `Parameter` só para o que muda entre contas; valor de produto vai **literal** (§6.9)
- [ ] `deploy.ps1` com conferência de `sts get-caller-identity` e as três listas de cache (§6.10)

### Backend
- [ ] Estrutura `models/ routers/ services/ repositories/ jobs/`
- [ ] `keys.py` como único montador de chave; docstring com o mapa do modelo
- [ ] `dependencies.py` lendo claims do authorizer, com fallback local para `sam local`
- [ ] Admin por allowlist em env var, respondendo **404** (§4.3)
- [ ] Escrita condicional em vez de `get` → `put`; condição como **string** (§5.7)
- [ ] Toda coleção que cresce sem limite: `query_pk_page` + cursor (§4.7)
- [ ] Rate limit nos endpoints públicos, antes de qualquer trabalho caro (§4.8)
- [ ] Indicador lê **agregado pré-computado**; `ADD` só dentro da transação com lock (§5.5)
- [ ] Script de recálculo de agregados escrito desde o começo (§5.5)
- [ ] Webhook: re-consulta o provedor, lock antes do efeito, chave de idempotência com o valor (§4.10)

### Frontend
- [ ] Vite + React + TS + Tailwind; alias `@` → `src`
- [ ] `App.tsx` (`createBrowserRouter`, rota única com splat) separado de `Shell.tsx` (§7.1)
- [ ] Fronteira de `lazy`: público / tenant / portal, com o SDK de auth **só** no portal (§7.0)
- [ ] `api/publicClient.ts` separado de `api/client.ts`
- [ ] `verificar-bundle.mjs` no `npm run build` (§17.2)
- [ ] Blocklist de rotas nas 4 cópias + teste de espelho (§7.5, §17.3)
- [ ] Telas de auth completas: login, cadastro em 3 passos com detecção de pendente, recuperação
      com resposta neutra, tradução de erro, checklist de senha espelhado, cooldown de reenvio (§7.9)
- [ ] `noindex` + título próprio nas telas de auth (§7.9.5)
- [ ] Estado compartilhado por store de módulo, não `useState` (§7.11)
- [ ] `aplicarMeta` com valores padrão para os campos omitidos (§7.13)
- [ ] Prefetch inline do payload da página pública dinâmica no `index.html` (§7.0) — e o regex
      dele gerado da mesma tabela das outras blocklists
- [ ] Mobile-first sem exceção: layout escrito para 360px, alvo de toque ≥ 44×44px

### SEO (páginas públicas) — §13
- [ ] `robots.txt` bloqueando área autenticada e rota de crawler; apontando o sitemap
- [ ] Tabela única de rotas estáticas (`data/rotasEstaticas.ts`) alimentando prerender, sitemap e SPA
- [ ] Prerender por `renderToString` com as guardas que **abortam** o build (§13.4.1)
- [ ] `sitemap.xml` **gerado** no build, com `lastmod` real (data de commit), nunca escrito à mão
- [ ] Rota de Open Graph para bots sem JS + redirecionamento na borda (§13.7)
- [ ] `og:image` 1200×630 **com** `og:image:width`/`height` declarados
- [ ] `www` → apex por 301 na borda; `canonical` em toda página (§13.8)
- [ ] Se houver opt-in de indexação: as **três** peças do §13.8 — senão, **não oferecer o toggle**
- [ ] Search Console: propriedade verificada, sitemap submetido, indexação solicitada

### Guardas automáticas
- [ ] Um teste de espelho por linha da tabela do §9.6 (§17.3)
- [ ] Trava de fuso: `date.today()`, `utcnow()`, `now(timezone.utc).date()`,
      `toISOString().slice(0,10)` (§20.5) — **escrever antes de corrigir**; ela é o inventário
- [ ] Toda tool do MCP rodada com o token do tenant errado (§21.3)

### Operação
- [ ] Comandos AWS sempre com `--profile {perfil}`
- [ ] Backend alterado → commit + deploy
- [ ] Invalidação: só os arquivos sem hash
- [ ] Ordem de prioridade respeitada: correção/escala antes de custo (§0.1)

---

## 12. Separação de Custos — Múltiplos Apps na Mesma Conta AWS

> Saber exatamente quanto cada app consumiu de Lambda, DynamoDB, API Gateway, Cognito, S3 e
> CloudFront — individualmente, mesmo quando dividem a conta.

A separação **não** se faz por conta AWS nem por stack isolada — se faz por **tags de alocação de
custo** + **AWS AppRegistry (myApplications)**. Vale manter mesmo em conta dedicada: é o que
permite quebrar o custo por serviço e por stage, e o que segura o padrão se outro app aparecer.

### 12.1 Os três pilares

| Pilar | O que faz | Onde |
|---|---|---|
| **Tag `Project` em todo recurso** | Atribui cada centavo a um app | `template.yaml` |
| **Cost Allocation Tag ativada** | Habilita a tag no Cost Explorer | Console Billing (manual, 1×) |
| **AppRegistry Application** | Dashboard por app em *myApplications* | `template.yaml` |

### 12.2 Convenção de tags (obrigatória em todos os recursos)

```yaml
Tags:
  Project: meu-projeto     # ← chave de separação. ÚNICA e estável por app.
  Owner: fulano
  Stage: !Ref Stage        # dev | prod
  ManagedBy: SAM
```

Stack, tabela, bucket e pool também usam o prefixo do app, para não colidir na conta.

### 12.3 Aplicar no `template.yaml`

```yaml
Globals:
  Function:
    Tags: { Project: meu-projeto, Owner: fulano, ManagedBy: SAM }

  MainTable:                      # DynamoDB / S3 / CloudFront: Tags é LISTA
    Properties:
      Tags:
        - { Key: Project, Value: meu-projeto }
        - { Key: Stage, Value: !Ref Stage }

  UserPool:                       # ⚠️ Cognito usa UserPoolTags, e é MAPA
    Properties:
      UserPoolTags: { Project: meu-projeto, Stage: !Ref Stage }
```

### 12.4 AppRegistry — dashboard por app

```yaml
  Aplicacao:
    Type: AWS::ServiceCatalogAppRegistry::Application
    Properties:
      Name: !Sub "${ProjectName}-${Stage}"
      Tags: { Project: meu-projeto, Stage: !Ref Stage }

  AssociacaoStack:
    Type: AWS::ServiceCatalogAppRegistry::ResourceAssociation
    Properties:
      Application: !GetAtt Aplicacao.Id
      Resource: !Ref AWS::StackId
      ResourceType: CFN_STACK
```

### 12.5 Passo manual obrigatório (1× por conta) — ativar a Cost Allocation Tag

```
Console AWS → Billing and Cost Management → Cost allocation tags
  → User-defined cost allocation tags → marcar "Project" (e "Stage") → Activate
```

- Leva **até 24h** para os dados aparecerem.
- ⚠️ **Não é retroativo**: custos só passam a ser atribuídos **a partir da ativação**. Ativar
  assim que o primeiro app subir.

### 12.6 Conferir o custo por app

```bash
# custo do mês, agrupado por app
aws ce get-cost-and-usage --time-period Start=2026-08-01,End=2026-09-01 \
  --granularity MONTHLY --metrics "UnblendedCost" \
  --group-by Type=TAG,Key=Project --profile {perfil}

# quebra por serviço dentro de um app
aws ce get-cost-and-usage --time-period Start=2026-08-01,End=2026-09-01 \
  --granularity MONTHLY --metrics "UnblendedCost" \
  --filter '{"Tags":{"Key":"Project","Values":["meu-projeto"]}}' \
  --group-by Type=DIMENSION,Key=SERVICE --profile {perfil}
```

### 12.7 Checklist de separação de custos

- [ ] `Project` único, em **todos** os recursos
- [ ] Prefixo do app em stack/tabela/bucket/pool
- [ ] `Globals.Function.Tags`; `Tags` (lista) em DynamoDB/S3/CloudFront; `UserPoolTags` (mapa)
- [ ] `AppRegistry::Application` + `ResourceAssociation`
- [ ] Tag ativada em Billing → Cost allocation tags
- [ ] Validado com `aws ce get-cost-and-usage`

---

## 13. SEO — Indexação, preview de link e prerender

### 13.1 O problema da SPA

| Situação | O que acontece |
|---|---|
| Googlebot rastreia uma rota | Vê o shell `<div id="root"></div>` e renderiza o JS na "segunda onda" — dias ou semanas |
| Bot do WhatsApp/Telegram/Slack | **Não executa JS**: lê só o HTML estático, e o preview sai genérico |
| Rota profunda no CDN | Devolve o mesmo `index.html` → OG tags erradas em toda rota |
| Site fora do Search Console | O Google pode levar meses para descobrir |

**Consequência prática:** todo o conteúdo que poderia ranquear chega ao crawler vazio, e o link
mais compartilhado do produto mostra preview errado.

### 13.2 Base obrigatória (zero custo)

`public/robots.txt`:
```
User-agent: *
Allow: /
Disallow: /app/
Disallow: /c/          # a rota de Open Graph — noindex, existe só para bots de preview
Disallow: /_ssg/       # o HTML servido por rewrite; a URL canônica é a limpa

Sitemap: https://seudominio.com.br/sitemap.xml
```

`index.html` — o `<head>` completo, com **marcadores** que o prerender substitui:
```html
<!-- ssg:head:inicio — TUDO entre os marcadores é trocado por página no prerender.
     Tag de SEO fora daqui vira DUPLICATA no HTML gerado (§13.4.1). -->
<title>Nome do Produto — tagline</title>
<meta name="description" content="120–160 caracteres." />
<link rel="canonical" href="https://seudominio.com.br/" />
<meta name="robots" content="index, follow" />
<meta property="og:type" content="website" />
<meta property="og:url" content="https://seudominio.com.br/" />
<meta property="og:title" content="Nome do Produto — tagline" />
<meta property="og:description" content="…" />
<meta property="og:image" content="https://seudominio.com.br/og-image.jpg" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:locale" content="pt_BR" />
<meta name="twitter:card" content="summary_large_image" />
<!-- ssg:head:fim -->
```

⚠️ **`og:image` sem `og:image:width`/`height` cai no preview PEQUENO do WhatsApp** — a imagem
vira um quadradinho ao lado do texto. Declarar **só** quando a dimensão é conhecida de verdade;
mentir é pior que omitir.

⚠️ **A imagem de OG é JPEG, e costuma ser a única do projeto que não é WebP.** Quem lê é o
crawler do WhatsApp, cujo suporte a WebP é irregular — um preview que às vezes não aparece é
pior que um arquivo 20% maior. Não "uniformizar para WebP".

### 13.3 Meta tags dinâmicas por rota (navegação client-side)

Para o Google (que executa JS) e para a barra de título, cada rota sobrescreve o `<head>` no
`useEffect` via um helper único (§7.13). **Não substitui** o prerender nem a rota de OG: bot sem
JS nunca vê nada disso.

### 13.4 Prerender — quando vale

Vale sempre que houver conteúdo público que deveria ranquear (landing, institucionais, páginas
de segmento). Não vale para conteúdo autenticado nem para páginas cujo conteúdo vem da API por
usuário — essas ficam em CSR mesmo.

#### 13.4.1 A receita — SSG sem Puppeteer

`vite build --ssr` + `renderToString`, num script de build (`scripts/prerender.mjs`) que roda
depois do build de cliente. Roda o **mesmo** React do cliente, então divergência de markup é
impossível por construção — enquanto o headless captura o DOM **pós-efeitos**, que é justamente
o que faz a hidratação divergir. E dispensa ~150 MB de Chromium num build determinístico.

**Seis decisões que não são óbvias:**

**1. A árvore da app é separada do roteador** (`Shell.tsx`, §7.1). O cliente monta
`RouterProvider`, o build monta `StaticRouter`; nenhum dos dois emite DOM, então o markup é o
mesmo. (`StaticRouterProvider` também serviria, mas injeta um `<script>` de hydration data que o
cliente não espera.)

**2. O HTML vai para `/_ssg/{rota}.html`, e o `index.html` continua sendo o shell vazio.** Não é
detalhe: o `navigateFallback` do workbox serve o `index.html` em **toda** navegação com o SW
ativo, e a função de edge o serve para as rotas de SPA. Shell com a landing renderizada pintaria
marketing antes de abrir o conteúdo que o usuário pediu. O prefixo também dá **um** glob para o
deploy e para o `robots.txt`, em vez de N caminhos.

**3. A hidratação decide pela ROTA, não pela presença de markup:**
```tsx
const rotaEstatica = container.dataset.ssg          // só existe no HTML prerenderizado
const aqui = location.pathname.replace(/(.)\/$/, '$1')
if (rotaEstatica && rotaEstatica === aqui) {
  hydrateRoot(container, app)
} else {
  container.textContent = ''    // ⚠️ createRoot NÃO limpa o container: sem isto o
  createRoot(container).render(app)   //   markup antigo fica abaixo do novo
}
```
Exatamente porque o shell chega em rotas que não são a dele.

**4. Uma tabela única alimenta prerender, sitemap, meta do cliente e a tabela `SSG` da função de
edge** (`data/rotasEstaticas.ts`). Cada rota declara caminho, arquivo, título, descrição,
JSON-LD e as **fontes** (arquivos que compõem o conteúdo).

**5. O prerender ABORTA o build em cinco condições.** Prerender que falha em silêncio é pior que
prerender nenhum:

| Guarda | O que ela pega |
|---|---|
| Marcadores `ssg:head` sumiram do `index.html` | Toda página sairia com o `<head>` genérico |
| Rota renderizou **sem `<h1>`** | A rota não casou no `<Routes>` — conteúdo vazio |
| `<template data-msg="…">` no HTML | ⚠️ **Subárvore que caiu para render no cliente** (abaixo) |
| Mais de um `<title>`/`description`/`canonical` **no `<head>`** | Tag fora dos marcadores → duplicata; o crawler fica com a primeira |
| `/assets/x` citado que não existe no build | Hash divergente entre o build de cliente e o de SSR |

⚠️ A quarta guarda conta **só o `<head>`**: `<title>` também é elemento de SVG (nome acessível do
ícone), e contar a página inteira dá falso positivo.

**6. Nada na árvore prerenderizada pode ler `window`/`localStorage`/`Date.now()` no RENDER.**
Quando um componente estoura no servidor, o React **não propaga o erro**: ele desiste daquela
subárvore, deixa um marcador e segue. O build passa, a página abre no browser (o cliente
re-renderiza) e o buraco no HTML só apareceria numa auditoria de SERP. Um `window.matchMedia`
num inicializador de `useState` esvaziou uma landing inteira assim. Estado que depende do
ambiente vai em `useSyncExternalStore` com `getServerSnapshot`.

### 13.5 Sitemap gerado no build, com `lastmod` real

O `sitemap.xml` sai da **mesma tabela** de rotas, no fim do prerender — escrever à mão garante
que a próxima rota seja esquecida.

⚠️ **`lastmod` é a data do último commit que tocou os arquivos daquela rota**, não a data do
build. Carimbar a data do build em todas as URLs a cada deploy diz ao Google que a página de
Termos muda toda semana; a documentação dele é explícita: `lastmod` que não corresponde à
modificação real passa a ser **ignorado — e não só naquela URL, no site inteiro**. Data errada é
pior que data nenhuma.

```js
function ultimaModificacao(fontes) {
  try {
    const saida = execFileSync('git', ['log', '-1', '--format=%cs', '--', ...fontes],
                               { cwd: '..', encoding: 'utf8', stdio: ['ignore','pipe','ignore'] }).trim()
    return /^\d{4}-\d{2}-\d{2}$/.test(saida) ? saida : hoje
  } catch { return hoje }        // sem git (tarball, CI raso): cai na data do build
}
```

⚠️ **As `fontes` são só o que o leitor vê, nunca o encanamento.** Incluir a casca compartilhada
empurra `/termos` para a data de hoje sempre que alguém mexe numa meta tag, sem uma vírgula do
texto ter mudado.

### 13.6 JSON-LD — da mesma fonte que desenha a tela

```js
// FAQPage a partir do MESMO array que renderiza o acordeão
export function faqPage(perguntas = PERGUNTAS) {
  return { '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: perguntas.map(({ pergunta, resposta }) => ({
      '@type': 'Question', name: pergunta,
      accepted: { '@type': 'Answer', text: paraTexto(resposta) },
    })) }
}
```

⚠️ **Schema que não bate com a página é motivo de penalidade, não de rich result.** Por isso ele
sai do mesmo array, na mesma ordem que a tela mostra. ⚠️ O acordeão é `<details>/<summary>`
nativo — a resposta está no HTML **mesmo fechada**, que é o que o Google exige para conceder o
rich result.

Blocos que valem em qualquer projeto: `Organization` (em todas as páginas institucionais),
`BreadcrumbList` (em tudo que não é a home), `FAQPage` (onde houver acordeão), `SoftwareApplication`
ou `Product` conforme o caso.

### 13.7 Preview de link para bots que não executam JS

O bot do WhatsApp lê o HTML cru. Numa SPA servida do S3, ele vê o `index.html` genérico e o
preview sai com o nome da plataforma em vez do nome do conteúdo — derrubando o clique do link
mais importante do produto.

**Solução:** uma rota de backend (`/c/{slug}`) que devolve **~1 KB de HTML** com as meta tags
certas e redireciona pessoas para o endereço canônico. Bots leem as tags e param; humanos caem
no destino em ~100 ms (`meta refresh` + `location.replace`).

```
/c/*  → behavior próprio no CloudFront, TTL 300s, rota SEM autorizador no API Gateway
        Cache-Control: public, max-age=0, s-maxage=300
```

E a função de edge (§6.1) redireciona **o bot** que pediu `/{slug}` para `/c/{slug}` — assim o
link que realmente circula (o canônico, o que o usuário vê na barra) é o que funciona.

⚠️ **Crawler de BUSCA fica de fora do redirecionamento, de propósito.** `/c/` é `Disallow` no
robots e responde `noindex`; mandar o Googlebot para lá tornaria impossível indexar a página
real. A lista de user-agents é só de bots de **preview** (WhatsApp, Telegram, Slack, Discord,
LinkedIn, Twitter, Facebook…).

⚠️ **A descrição do preview é espelho.** Quem gera para o crawler é o backend; o frontend gera a
mesma frase para a pré-visualização que o usuário vê antes de compartilhar. Divergir não quebra
o preview — **mente** para quem está compartilhando. Espelho tem teste (§0.2).

⚠️ **`og:image` precisa ser ABSOLUTA e pública.** Crawler não segue redirect nem lê imagem
protegida, e não resolve URL relativa de forma confiável. A base absoluta vem do `Parameter`
(§4.2); se ela estiver vazia, logar aviso — senão o preview quebra em silêncio.

### 13.8 Canonical, `www` e `noindex`

- **`www` → apex por 301 na borda** (§6.1). Sem isso o site inteiro existe em dois endereços:
  conteúdo duplicado, e o link compartilhado com `www` não soma autoridade para o apex. O
  `canonical` do `<head>` mitiga, mas só para quem executa JS e só depois de renderizar.
- **Barra final normalizada antes de qualquer decisão** — `/x/` e `/x` são a mesma página, e o
  `data-ssg` é comparado com o `pathname`.
- **Conteúdo semiprivado nasce `noindex`.** Página de tenant/usuário que só quem tem o link
  deveria ver não entra no sitemap e responde `noindex` por padrão; indexar é **opt-in** do dono.
- **Área autenticada tem `noindex` na meta, não só no robots** (§7.9.5).

⚠️ **Opt-in de indexação exige TRÊS peças, e faltar uma torna o botão decorativo.** Trocar a meta
`robots` para `index, follow` não indexa nada sozinho, porque:

| Peça | Sem ela |
|---|---|
| **1. Sitemap dinâmico** (`/sitemap-listas.xml`, servido pela API) | O sitemap estático é gerado no build e a página do tenant não existe nele **por construção**. O Google nunca descobre a URL |
| **2. HTML com conteúdo no primeiro byte** para o crawler | O Googlebot recebe `<div id="root"></div>` e depende da segunda onda de renderização — que para página sem autoridade pode nunca chegar |
| **3. O crawler de busca chegando na rota certa** | O redirect de bots da borda (§13.7) manda **só bots de preview** para a rota de OG, que é `noindex`. Se o Googlebot for junto, a página real fica inalcançável; se ninguém servir HTML para ele, não há o que indexar |

Receita barata para as três, sem SSR em Node: a **mesma função que já monta o HTML de Open
Graph** (§13.7) ganha uma variante **indexável** — sem `noindex`, com `<h1>`, o texto real,
JSON-LD (`Event`, `Product`, `ItemList` conforme o caso) e `canonical` para a URL limpa — e um
`/sitemap-<colecao>.xml` que sai de uma query no GSI de publicados, com `s-maxage=3600` no
CloudFront (24 origin hits por dia, custo desprezível).

> Se o produto **não** vai investir nisso, a decisão correta é a oposta e igualmente válida:
> **não oferecer o toggle**. Botão que promete indexação e não entrega é pior que ausência de
> feature — o dono acha que fez, e ninguém descobre até alguém procurar no Google.

### 13.9 Landings programáticas por segmento

Uma tabela (`data/segmentos.ts`) com rótulo, título, descrição, FAQ próprio e sufixo gera N
rotas prerenderizadas com uma linha no `<Routes>` (§7.0). Criar a sexta landing é editar **uma**
tabela.

⚠️ Use **prefixo reservado** (`/lista-de-presentes-casamento`, não `/casamento`): o slug curto e
genérico é o que os usuários querem registrar, e o prefixo cobre todas as landings nas blocklists
com uma regra só (§7.5).

### 13.9.1 Blog — conteúdo informacional sobre a mesma máquina

O blog **não é um segundo sistema**: cada artigo é mais uma linha na tabela de rotas estáticas
(§13.4.1), então prerender, `<head>`, sitemap e JSON-LD saem do caminho que já existia. O que ele
acrescenta é a intenção: a landing responde a quem **quer comprar** ("lista de presentes de
casamento"), o artigo responde a quem **ainda está decidindo** ("quanto dar de presente de
casamento") — que é onde está o volume de busca.

| Peça | Onde | Papel |
|---|---|---|
| Conteúdo | `data/blog/{slug}.ts`, um arquivo por artigo | Dado estruturado, nunca HTML em string |
| Índice | `data/blog/index.ts` | Ordem editorial, tempo de leitura e texto puro derivados |
| Marcação de linha | `data/blog/marcacao.ts` | `**forte**` e `[link](/rota)` — subconjunto fechado |
| Renderização | `pages/blog/Corpo.tsx` | Tokens → React |
| Rota + `<head>` + sitemap | `data/rotasEstaticas.ts` | `BlogPosting` + `BreadcrumbList` |
| Entrega do HTML | tabela `SSG` da CloudFront Function | Reescreve `/blog/{slug}` → `/_ssg/blog-{slug}.html` |

⚠️ **Corpo de artigo é DADO, não HTML.** `dangerouslySetInnerHTML` num texto que alguém edita
todo mês é a porta de entrada mais previsível para XSS — ainda mais num domínio que já serve
conteúdo de terceiros em `/m/*`. A marcação aceita dois marcadores e nada mais.

⚠️ **Um tokenizador, dois consumidores.** O mesmo `marcacao.ts` alimenta o React da página e o
texto puro do `articleBody`/`FAQPage`. Duas implementações divergiriam em silêncio, e schema que
não bate com a tela é motivo de penalidade, não de rich result (§13.6).

⚠️ **Número que já tem dono não se reescreve no texto.** Preço e tarifa entram por
`{{variavel}}` (`data/blog/variaveis.ts`) e saem de `data/precos.ts`. Artigo é justamente o
arquivo que ninguém revisa quando o preço muda — e o projeto já teve um preço defasado em
produção por estar duplicado (§7.5).

⚠️ **Link interno quebrado é falha silenciosa.** O artigo cita rotas no meio da prosa; renomear
uma rota deixaria o link apontando para lugar nenhum sem que nada falhasse.
`data/blog/blog.test.ts` percorre todo texto, resolve os links e reprova o build — junto de slug
duplicado, `{{variavel}}` com typo, tabela com linha torta e termo-alvo repetido em dois artigos
(canibalização).

⚠️ **Slug de artigo não é slug de tenant.** O teto de 40 caracteres do `validarSlug` existe porque
o endereço do tenant é uma URL curta de vaidade; título de artigo é descritivo e slug longo é bom
para busca. O que o artigo precisa respeitar é o **formato** e não usar o prefixo reservado das
landings — `/blog/lista-de-presentes-de-formatura` ficaria a um hífen de
`/lista-de-presentes-formatura`, duas URLs quase idênticas disputando a mesma busca.

⚠️ **Artigo alcançável só pelo sitemap é órfão.** O rodapé (§13.11) linka `/blog`, o índice linka
os artigos, cada artigo linka os relacionados e a landing da ocasião. Sitemap é o sinal mais fraco
que existe; o grafo interno é o que faz o crawler voltar.

### 13.10 Google Search Console — passo manual de maior impacto

1. Add property → `https://seudominio.com.br` (tipo "URL prefix")
2. Verificar por **DNS TXT** ou pelo arquivo `google{token}.html` na raiz
   (⚠️ o arquivo de verificação entra nas três listas de cache do §6.10)
3. Sitemaps → submeter `/sitemap.xml`
4. URL Inspection → "Request Indexing" na landing

Depois disso o Google rastreia em horas/dias, não semanas.

### 13.11 O que ranqueia de verdade

Indexar ≠ ranquear.

| Fator | Peso | Como agir |
|---|---|---|
| Conteúdo relevante | Alto | Texto com as palavras que o usuário busca, em `<h1>`/`<h2>` reais |
| Core Web Vitals | Alto | LCP < 2,5s, CLS < 0,1, INP < 200ms |
| Backlinks | Alto | Outros sites linkando |
| Mobile-friendly | Médio | Mobile-first + viewport |
| HTTPS | Obrigatório | CloudFront + ACM |
| Dados estruturados | Baixo | JSON-LD (§13.6) |

⚠️ **Preload da fonte que pinta o `<h1>`** é o maior ganho de CLS destas páginas — e o nome do
arquivo é hasheado pelo Vite, então só dá para declarar no prerender, com o build já feito.

---

## 14. Mídia e uploads (S3)

### 14.1 Imagem pública é servida por CDN, nunca por presigned GET

⚠️ **Presigned GET para imagem pública é erro de custo e de performance**: a URL é única por
assinatura, então **não cacheia** — cada visualização vira um S3 GET, e o navegador rebaixa o
arquivo toda vez. Presigned GET só para arquivo genuinamente privado.

O padrão: bucket **sem acesso público**, servido pelo CloudFront via **OAC**, num behavior
próprio (`/m/*`, §6.0), com `Cache-Control: max-age=31536000, immutable`.

### 14.2 Upload — presigned **POST**, direto do navegador

⚠️ **POST, nunca PUT.** O presigned PUT do boto3 assina só o host: o cliente troca
`Content-Type`, `Cache-Control` e tamanho à vontade. Como `/m/*` fica no **mesmo domínio** do
app, um `text/html` subido assim vira **XSS armazenado com acesso à origem**. Só o POST tem
`Conditions` que o S3 valida de verdade.

```python
CACHE_CONTROL = "public, max-age=31536000, immutable"   # ⚠️ byte a byte igual ao do cliente
TAMANHO_MAX_BYTES = 2 * 1024 * 1024

# ⚠️ Key sempre NOVA (content-addressed). Nunca sobrescrever: o objeto é immutable
# no CDN e a imagem antiga continuaria aparecendo. Trocar = nova key + delete da anterior.
key = f"tenant/{recurso_id}/{contexto}-{uuid.uuid4().hex}.{extensao}"

dados = s3.generate_presigned_post(
    Bucket=bucket, Key=key,
    Fields={"Content-Type": content_type, "Cache-Control": CACHE_CONTROL},
    Conditions=[
        {"Content-Type": content_type},                 # trava o tipo: nada de text/html
        {"Cache-Control": CACHE_CONTROL},
        ["content-length-range", 1, TAMANHO_MAX_BYTES],
    ],
    ExpiresIn=900,
)
```

⚠️ O `Cache-Control` que o cliente envia tem que ser **idêntico** ao das `Conditions` — o S3
rejeita o POST se divergir. É um espelho (§0.2).

**Tipos aceitos por contexto, não em geral.** Aceitar `image/jpeg` "porque sim" abre a porta
para subir o arquivo original de 8 MB sem passar pela compressão do cliente.

### 14.3 Compressão no navegador, não em Lambda

Canvas → WebP, lado maior ~1600px, qualidade ~0.82. Reduz storage e transferência em ~90%, sem
Lambda de transcode, sem fila, sem custo.

⚠️ **A proporção do recorte no upload tem que ser a proporção que o frame RENDERIZA.** Subir em
4:3 paisagem para um frame 3:4 retrato faz o `object-cover` recortar de novo e jogar fora ~44%
da imagem mais visível do produto. Passa despercebido porque **`object-cover` nunca falha
visivelmente** — ele só corta, e a foto continua parecendo certa. Frame que exibe numa segunda
proporção ganha uma área-guia tracejada no recortador, não outro slot. Mexeu na proporção de um
frame, mexeu na tabela de slots no mesmo commit (e no espelho dela nos scripts de seed).

### 14.4 Detalhes de UX do uploader que sempre faltam

- ⚠️ **Limpar o input (`e.target.value = ''`) depois de cada escolha.** Sem isso, escolher o
  **mesmo** arquivo de novo não dispara `change` — e "reenquadrar a mesma foto" é o caso de uso
  mais comum do recortador. O botão simplesmente não responde, sem erro nenhum.
- ⚠️ **`Sheet` dentro de `Sheet` precisa de pilha.** Com dois `keydown` no `document`, um Esc no
  recortador fecha também o formulário por baixo — levando junto tudo que o usuário digitou. O
  componente mantém uma pilha module-level: só o do topo reage a Esc e prende o Tab, e só o
  último a fechar devolve o scroll do `body`.

### 14.5 Lifecycle e limpeza

```yaml
  MediaBucket:
    Properties:
      LifecycleConfiguration:
        Rules:
          - Id: AbortarMultipart
            Status: Enabled
            AbortIncompleteMultipartUpload: { DaysAfterInitiation: 7 }
          - Id: ExpirarTemporarios
            Status: Enabled
            Prefix: tmp/
            ExpirationInDays: 1
      CorsConfiguration:            # necessário para o POST direto do browser
        CorsRules:
          - AllowedMethods: [POST]
            AllowedOrigins: ["*"]
            AllowedHeaders: ["*"]
```

`delete_object` é **best-effort**: DELETE no S3 é grátis, e falhar ao apagar não pode quebrar o
fluxo do usuário — loga e segue.

### 14.6 Ícone é SVG no bundle, não objeto no S3

Ícone de catálogo, de categoria, de estado: SVG inline no bundle. Custo zero, sem request, sem
CDN, e trocam com o tema. Nunca virar objeto no S3.

---

## 15. PWA

`vite-plugin-pwa` (Workbox), **`registerType: 'prompt'`**.

⚠️ **`prompt`, não `autoUpdate`.** Com `autoUpdate` uma nova versão pode recarregar a página no
meio de um fluxo crítico (checkout, formulário longo) e destruir o estado. O app decide quando
aplicar: fora de rota sensível, aplica direto; dentro dela, mostra um aviso discreto e espera.

⚠️ **`navigateFallback: '/index.html'`, não uma página de offline.** Numa SPA o shell **é** o
app. Mas isso tem uma consequência que morde o SEO: **o SW passa a servir o shell em toda
navegação**, inclusive nas rotas prerenderizadas — daí a decisão de hidratar por rota (§13.4.1).

**Regra que não se viola: nada autenticado, nada de mutação e nada de pagamento entra no cache
do SW.** Runtime caching só para `GET` público e imutável (imagens, fontes, payload público com
`StaleWhileRevalidate` curto).

⚠️ **`sw.js` e `manifest.webmanifest` vão para o S3 com `Cache-Control: no-cache`** e entram nas
três listas do §6.10. SW preso em cache é o pior bug de deploy possível: o usuário fica numa
versão antiga e nem F5 resolve.

⚠️ **Manifest por escopo** (quando o produto tem áreas distintas): `scope` limitado faz a
instalação abrir direto naquela área. E **iOS não usa manifest dinâmico** para o nome do ícone —
usa a tag `apple-mobile-web-app-title` do HTML.

⚠️ **Sem Background Sync para pagamento.** Enfileirar "gerar cobrança" para quando a rede voltar
produz cobrança duplicada e fora de contexto.

---

## 16. Design system e temas

### 16.1 Tokens, nunca valor literal

Cor, raio, sombra e fonte saem de **tokens CSS**; marca (nome, domínio, caminhos de logo, imagem
de OG) sai de **um módulo** (`brand/brand.ts`). Nada de `#E91E63` ou `/logo.png` no meio de um
componente — trocar a marca depois passa a ser substituir arquivos com o mesmo nome, sem tocar
em código.

### 16.2 Tema de tenant: remapear tokens no escopo, não passar `className`

⚠️ **Primitivo compartilhado (`Card`, `Input`, `Button`, `Sheet`) dentro de um escopo tematizado
segue a marca, não o tema** — e o resultado é o rosa da plataforma dentro de um site creme. A
correção é **remapear os tokens semânticos no escopo** (`.tenant { --surface: var(--t-superficie); … }`),
**não** passar `className` componente a componente: essa foi a tentativa que deixou dois
formulários de fora por duas fases inteiras.

### 16.3 Contraste é medido, não estimado

Um script lê o CSS de temas e **reprova** se algum par (texto/fundo, botão, borda) não passar em
AA. Mexeu em cor, roda e cola a tabela na spec de design.

⚠️ **Token semântico usado como primeiro plano precisa passar AA como texto.** Um destaque de
marca com 2,0:1 em fundo claro é lindo como preenchimento e ilegível como `text-*`. Vira **par**:
um token de tinta (escurecido, para texto) e um de preenchimento (a cor da marca, só com alfa em
fundo).

### 16.4 Detalhes de layout que já quebraram

- ⚠️ **`backdrop-filter`/`filter`/`transform` num ancestral quebra `position: fixed` do
  descendente.** Um header com `backdrop-blur` faz o painel `inset-0` do menu mobile medir a
  altura do header, não a viewport. O sintoma não parece bug de layout: os itens transbordam e
  fluem tela abaixo **na posição certa**, e só o fundo para nos 60px do header — a leitura vira
  "o menu está transparente". Efeito que exige filtro vai numa camada `absolute inset-0`
  **dentro** do elemento, nunca no elemento que contém o `fixed`.
- ⚠️ **Barra fixa se destaca por sombra, não por opacidade.** Na maioria dos temas a superfície é
  quase igual ao fundo (`#FFFFFF` sobre `#FBF7F9`), então uma barra "sólida" continua invisível
  sobre o conteúdo.
- ⚠️ **O nome da família do `@fontsource-variable` termina em "Variable".** Pedir
  `'Cormorant Garamond'` quando a família real é `'Cormorant Garamond Variable'` faz o tema cair
  no fallback **mesmo depois** de instalar o pacote. Conferir em `node_modules/.../index.css`
  antes de escrever o nome.
- ⚠️ **Arte gerada em canvas tem área segura.** Um convite 1080×1920 para stories tem o topo
  coberto pelo autor e a base pela barra de resposta: informação (QR, endereço) vai entre ~196 e
  ~1700; moldura e textura podem sangrar. E a distribuição vertical **não** se escreve no arquivo
  de desenho — os blocos são medidos e posicionados por um módulo de layout, senão o resultado
  depende do tamanho do título do jeito errado.

---

## 17. Testes e guardas automáticas

Não há suíte de integração nesta stack — o que existe é uma combinação de quatro coisas, cada
uma barata e com alvo definido.

### 17.1 Testes unitários de função pura (vitest)

Regras de negócio no frontend (cálculo de desconto, regra de estoque, layout de arte, formatação)
são funções puras em `utils/`/`data/` e têm teste. Componente não tem — o retorno não paga.

### 17.2 Guarda de bundle — o grafo, não um arquivo

```
node scripts/verificar-bundle.mjs   # roda dentro do `npm run build`
```

Parte do chunk de entrada do público e **percorre o grafo de imports estáticos**, procurando
chunks e palavras proibidas (`amplify`, `cognito`, e o que mais for exclusivo do portal).

⚠️ **Seguir o grafo, não abrir um arquivo.** A versão antiga abria só o chunk do tenant, e o
chunk **compartilhado** entre tenant e portal — dezenas de kB, de nome imprevisível — nunca era
aberto.

⚠️ **Dois falsos positivos previsíveis, que precisam estar tratados:** o `import()` **dinâmico**
do portal (é assim que `React.lazy` funciona — só import estático conta) e a **prosa** (a página
de privacidade menciona "Amazon Cognito" ao usuário; os padrões são minúsculos e sensíveis à
caixa, e as strings de caminho de asset saem antes da varredura).

### 17.3 Testes de espelho — o teste lê o arquivo da outra linguagem

O mais barato e o de maior retorno desta lista. Um teste de vitest **lê o `.py` do backend e o
`.yaml` da infra** e reprova quando divergem da fonte TypeScript:

```typescript
// slug.blocklist.test.ts (esboço)
const py   = readFileSync('../backend/app/services/slug_service.py', 'utf8')
const yaml = readFileSync('../backend/template.yaml', 'utf8')

it('a blocklist do backend espelha a do frontend', () => {
  expect(extrairSet(py, 'SLUGS_RESERVADOS')).toEqual(SLUGS_RESERVADOS)
})
it('RESERVADOS da função de edge cobre as rotas fixas', () => { /* … */ })
it('a tabela SSG da função de edge bate com ROTAS_ESTATICAS', () => { /* … */ })
```

Escrever um por espelho da tabela do §9.6.

### 17.4 Guardas de build que abortam

`prerender.mjs` (§13.4.1), `verificar-bundle.mjs` (§17.2), `verificar-contraste.mjs` (§16.3) e o
`tsc -b`. Todos no `npm run build`, todos com `process.exit(1)`.

### 17.5 Scripts que exercitam a infra real

`backend/scripts/teste_*.py` roda **o código real contra a tabela, o S3 e o CDN reais**, e
**limpa os próprios dados** ao final. É como se verifica o que não tem como simular: idempotência
de webhook, expiração por cron, presigned POST, cache do CDN, geração de OG.

Não substitui teste automatizado — cobre a faixa que teste automatizado não alcança nesta stack.

---

## 18. Ambiente de desenvolvimento (Windows + PowerShell 5.1)

Estas quatro armadilhas custaram horas cada e nenhuma tem a ver com o produto.

- ⚠️ **Não redirecionar `2>&1` de executável nativo.** `.\deploy.ps1 all 2>&1 | …` faz o PS
  embrulhar cada linha de stderr do `sam` num `ErrorRecord` (`NativeCommandError`), e o script
  morre em "Starting Build use cache" — que não é erro nenhum. Rodar sem redirecionar.
- ⚠️ **Nunca editar arquivo de texto com `Get-Content`/`Set-Content`.** O PS 5.1 lê como cp1252 e
  grava com BOM — já corrompeu `samconfig.toml`, `package.json` e documentação. Usar as
  ferramentas de edição de arquivo, que tratam UTF-8 corretamente. Para gerar arquivo de dentro
  de um script: `[System.IO.File]::WriteAllText($caminho, $texto, (New-Object System.Text.UTF8Encoding($false)))`.
- ⚠️ **`.ps1` precisa de BOM UTF-8 — o contrário de `.toml` e `.json`.** Sem BOM, o PS lê o
  arquivo como cp1252 e `—` (E2 80 94) vira `â€”`: o byte `94` é `”`, que o parser aceita como
  fecha-aspas. **Um travessão dentro de uma string quebra o arquivo inteiro** com "Token '}'
  inesperado", apontando para uma linha sem relação com o problema.
- ⚠️ **`samconfig.toml` é ASCII puro** — o SAM CLI o lê com a codificação local do Windows.
- ⚠️ **Docstring de script Python não leva emoji** (§8.3).

---

## 19. Armadilhas já pagas — índice consolidado

Para varrer antes de um code review ou quando algo "funciona mas está estranho".

| Sintoma | Causa | §|
|---|---|---|
| Toda rota da API responde 404 | Falta `api_gateway_base_path` no Mangum | 4.1 |
| 404 da API vira HTML com status 200 | `CustomErrorResponses` na distribution | 6.1 |
| 403 em **toda** imagem de tenant | `PathPattern` não é removido do caminho ao origin | 6.0 |
| Lambda segue com valor velho após deploy verde | `Default` de `Parameter` não afeta stack existente | 6.9 |
| Behavior cacheia menos que o `s-maxage` do origin | `MaxTTL` trunca | 6.2 |
| HTML de SEO preso no edge por um ano | `--exclude "index.html"` não casa `pasta/index.html` | 6.10 |
| Bundle público engordou sem motivo | import estático atravessou a fronteira de `lazy` | 17.2 |
| Página abre normal, mas o SEO não acontece | rota fora da tabela `SSG` da função de edge | 7.5 |
| Site inteiro ~120 ms mais lento, para todos | `PriceClass_100` com público fora de NA/EU | 6.0 |
| Toggle "permitir indexação" não indexa nada | falta o sitemap dinâmico e/ou HTML p/ o crawler | 13.8 |
| Conta cobrada no 13º mês sem mudar nada | metade do free tier era de 12 meses | 2.1 |
| Custo de DynamoDB acima do previsto desde o 1º dia | free tier de requisição é só p/ modo provisionado | 2.1 |
| Landing prerenderiza vazia, build passa | leitura de `window` no **render** | 13.4.1 |
| `<title>` duplicado no HTML gerado | tag de SEO fora dos marcadores `ssg:head` | 13.4.1 |
| Preview do WhatsApp pequeno | `og:image` sem `width`/`height` | 13.2 |
| Preview com o nome da plataforma | falta a rota de OG + redirect de bot na borda | 13.7 |
| `lastmod` do sitemap ignorado pelo Google | data do build em vez da data real | 13.5 |
| `{{variavel}}` impressa na tela do artigo | typo no nome; o token é substituído, não validado | 13.9.1 |
| Link no meio do artigo dá 404 depois de uma renomeação | texto cita rota que deixou de existir | 13.9.1 |
| Dois artigos oscilam na SERP e nenhum sobe | mesmo termo-alvo em dois textos (canibalização) | 13.9.1 |
| Meta tag de outra página sobrevive à navegação | `aplicarMeta` sem valores padrão | 7.13 |
| Loop de redirecionamento para o login | token expirado tratado como sessão válida | 7.7 |
| Loop 401 logo após login bem-sucedido | navegação SPA em vez de `location.assign` | 7.9.1 |
| Usuário travado em "e-mail já cadastrado" | falta a detecção de cadastro **pendente** | 7.9.2 |
| Checklist de senha "mente" | política do pool mudou e o espelho não | 7.9.4 |
| Contador do carrinho só muda ao recarregar | `useState` por componente em vez de store | 7.11 |
| Diálogo nativo "deseja sair?" **em cima** do nosso | `beforeunload` não desarmado | 7.12 |
| Página em branco, sem erro, no router aninhado | zerou `LocationContext` e não `RouteContext` | 7.6 |
| Todo checkout com item "ilimitado" dá 409 | condição numérica contra atributo nulo | 5.6 |
| Agregado infla sozinho | `ADD` fora da transação com lock | 4.10 / 5.5 |
| Cobrança repetida devolve o preço velho | chave de idempotência sem o valor | 4.10 |
| `ValidationException` ao varrer partição | `begins_with(SK, "")` | 5.7 |
| Rota com id composto responde 404 | `#` da SK interpolado cru na URL | 5.7 |
| `ExpressionAttributeNames` sobrescrito | condição com `Attr(...)` em vez de string | 5.7 |
| Recurso pago sobrevive ao `delete-stack` | `DeletionPolicy: Retain` | 6.7 |
| Menu mobile "transparente" | `backdrop-filter` no ancestral do `fixed` | 16.4 |
| Tema cai no fallback com a fonte instalada | falta o sufixo "Variable" no nome da família | 16.4 |
| Botão de trocar a mesma foto não responde | input de arquivo não foi limpo | 14.4 |
| Esc no recortador fecha o formulário inteiro | `Sheet` sem pilha | 14.4 |
| `deploy.ps1` morre em "Starting Build use cache" | `2>&1` em executável nativo | 18 |
| Evento da noite aparece no dia seguinte da grade | agrupou por `slice(0,10)` do ISO (dia UTC) | 20.0 |
| Evento do último dia da semana **some** da tela | chave caiu fora da grade; foi baixado e descartado | 20.6 |
| Formulário pré-preenche amanhã à noite | `toISOString().slice(0,10)` como valor default | 20.6 |
| Gráfico "por dia" conta no dia errado | balde `STATS#D#` gravado em dia UTC | 20.1 |
| Streak quebra ou infla sozinho | semana ISO calculada em UTC | 20.1 |
| Item vence algumas horas cedo | data civil comparada com `date.today()` | 20.0 |
| Ranking semanal zerado para sempre | escrita e leitura calculam a chave em fusos diferentes | 20.3 |
| Aviso diário chega à noite para parte dos usuários | `cron` em UTC servindo um fuso só | 20.4 |
| Sistema sem job agendado após deploy verde | chave do evento renomeada no SAM com `Name` explícito | 20.4 |

---

## 20. Tempo e fuso horário

> Esta seção existe porque um sistema desta stack foi para produção com **21** bugs de fuso
> simultâneos, todos da mesma família, e **nenhum** deles aparecia como erro. Quase todos
> atingiam usuários do próprio país do produto — não era problema "de internacionalização",
> era problema de hoje: em UTC-3, tudo que acontece a partir das 21h já é o dia seguinte, e
> 21h é justamente o horário de pico de muitos produtos.
>
> A varredura manual encontrou 5. A trava automática do §20.5, escrita depois, encontrou os
> outros 16 — inclusive um contador **irreversível** que já gravava errado havia meses. Daí a
> ordem recomendada: **trava primeiro, correção depois.**

### 20.0 O erro que gera todos os outros

"Armazenar em UTC e converter na exibição" está **certo** — e é insuficiente, porque cobre
**uma** das quatro categorias temporais. Confundi-las é a origem de praticamente todo bug de
fuso.

| Categoria | Exemplo | Armazenar | Comparar com |
|---|---|---|---|
| **Instante** | "a sessão terminou agora" | UTC ISO-8601 com `Z` | outro instante |
| **Data civil** | "vence dia 10 de setembro" | `YYYY-MM-DD` puro | hoje **no fuso do dono** |
| **Evento futuro zonado** | "aula às 8h do dia 15/03" | hora local + nome da zona | — |
| **Balde agregado** | `STATS#D#2026-09-02 = 7` | não é tempo: é índice derivado | — |

⚠️ **Na data civil, aplicar "tudo em UTC" ao pé da letra *causa* o bug.** Dia 10 em Tóquio e
dia 10 em Los Angeles são instantes diferentes e a **mesma** data civil. "10 de setembro em
UTC" não existe — a pergunta não faz sentido. Uma cobrança vence no dia 10 do calendário de
quem cobra, e ponto. O erro nunca está no armazenamento (que já é `YYYY-MM-DD`), está na
**comparação**: `date.today()` na Lambda é o dia UTC.

⚠️ **O evento futuro é o único caso em que o instante UTC é tecnicamente insuficiente.**
Governo muda regra de horário de verão; quando muda, o instante congelado passa a apontar
para a hora local errada — quem marcou 8h queria 8h, não "13h UTC". Para agendamento de
curto prazo e não recorrente, guardar o instante é aceitável: **decida, escreva a decisão, e
revise se surgir recorrência ou marcação com meses de antecedência.**

### 20.1 Por que o contador agregado é a única exceção real

Um instante converte para qualquer fuso na leitura porque **carrega a informação inteira**:
`2026-09-08T00:30:00Z` sabe dizer que é 21h30 do dia 7 em São Paulo e 9h30 do dia 8 em Tóquio.

Um contador não:

```python
repo.add_and_set(pk, f"STATS#D#{dia}", add={"sessoes": 1})
```

O `ADD` soma 1 e **descarta qual evento era**. Depois disso, `STATS#D#2026-09-08 = 7` é tudo
o que existe. Um dia UTC cobre pedaços de **dois** dias locais, e não há como saber que os 7
se dividem em 5 e 2. A informação foi destruída na escrita.

Logo: ou você **não pré-agrega** (e paga leitura), ou **agrega no fuso certo desde o início**.
Não há terceira opção — e é por isso que este é o único ponto irreversível do assunto.

**A pergunta certa passa a ser: quais contadores precisam mesmo existir?**

| Caso | Dá para derivar na leitura? | Decisão |
|---|---|---|
| Calendário mensal do usuário | **Sim** — já lê os itens brutos da partição dele e agrupa na hora | **Converter na leitura** |
| Gráfico "por dia" do dono da conta | **Não** — os itens moram na partição de cada subordinado; derivar seria fan-out | Balde na escrita |
| Streak / frequência all-time | **Não** — derivar é varrer o histórico inteiro | Balde na escrita |

> **Regra: derivar na leitura sempre que possível; balde na escrita só onde derivar é
> inviável.** Quanto menos coisas bucketizadas na escrita, menor a área irreversível.

⚠️ **Não grave o dia derivado junto do item para "facilitar".** É tentador e é pior: congela
um fuso mal configurado para sempre. Convertendo na leitura, corrigir o fuso do usuário
**reescreve o passado inteiro** sozinho — sem migração, sem script. Quando o contexto local
importa, guarde **a zona**, nunca o resultado da conversão. É isso que "UTC + zona" significa.

### 20.2 Modelo de dados

| Onde | Campo | Default | Nota |
|---|---|---|---|
| Perfil do dono da conta | `timezone` | fuso do mercado principal | **Nome IANA** |
| Perfil do subordinado (aluno/cliente/convidado) | `timezone` | `null` → herda | Só se o produto tiver relação remota |

**Sempre nome IANA (`America/Sao_Paulo`), nunca offset (`-3`).** Offset é a forma errada por
dois motivos: quebra no horário de verão (irrelevante no Brasil, obrigatório nos EUA e na
Europa) e não sobrevive a mudança de regra do país.

⚠️ **A env var global de offset é a armadilha clássica.** Um sistema desta stack tinha
`TZ_OFFSET_HOURS` com default `-3` formatando o horário dentro do texto dos pushes. Parecia
inofensiva: é global (não varia por usuário) e é offset (quebra no DST). Existia porque
alguém sentiu o problema e abriu a costura na forma errada.

Ponto **único** de resolução, num `services/locale_service.py`:

```python
def tz_do_dono(dono_id) -> str                 # perfil → default
def tz_do_subordinado(sub_id, dono_id) -> str  # cascata: dele → do dono → default
def hoje(tz) -> str                            # 'YYYY-MM-DD' — substitui date.today()
def dia(iso, tz) -> str | None                 # dia local de um instante
def semana_iso(iso, tz) -> str | None
def dow(iso, tz) -> int | None
def hora(iso, tz) -> str                       # texto exibido ao usuário
def ja_passou(data_iso, tz, hora_local) -> bool  # gate de job agendado (§20.4)
```

⚠️ **Fuso ausente ou inválido degrada para o default, e o default também tem fallback.** Um
valor corrompido no perfil não pode dar 500 no dashboard. E o `except` do default importa:
se a base IANA sumir do pacote num deploy futuro, cair em UTC deixa a tela abrir com a data
torta — melhor que o portal inteiro fora do ar.

⚠️ **Python: adicione `tzdata` ao `requirements.txt`.** O container da Lambda até traz
`/usr/share/zoneinfo`, mas depender disso é frágil; ~600 kB no bundle elimina a dúvida.

**Como descobrir o fuso na primeira vez:** `Intl.DateTimeFormat().resolvedOptions().timeZone`
no cliente, **sugerido e visível** — nunca aplicado em silêncio. Para quem entra por link sem
cadastro (magic link, token), mande o fuso detectado no *redeem* e **semeie só o perfil vazio**.

⚠️ **O fuso é sticky.** Se redetectar a cada acesso, uma viagem de duas semanas reescreve em
silêncio onde caem os baldes do usuário. Detecta uma vez, sugere mudança se divergir, e só
troca se alguém confirmar.

⚠️ **`exclude_none=True` no update impede limpar o campo.** Se "herdar do dono" é `null`, o
usuário não consegue voltar a herdar depois de definir. Ou trate `""` como limpar, ou aceite
e documente.

### 20.3 Fuso do sujeito × fuso do leitor

Duas perguntas que se confundem:

- **"De que dia é este dado?"** → fuso do **sujeito** (de quem o dado é). O calendário de um
  usuário em Tóquio mostra os dias **dele**, mesmo quando quem olha é o dono da conta em
  São Paulo.
- **"Que horas isso foi/será?"** → fuso do **leitor**.

> Regra que resolve os ambíguos: **o instante se exibe no fuso de quem a frase é sobre.**
> "Sua aula às 14h" (push para o dono) → fuso dele. "João finalizou às 19h32" → fuso do João.

⚠️ **Notificação com dois destinatários precisa de dois horários.** Um lembrete de compromisso
que renderiza a hora uma vez e manda para os dois lados está errado para um deles assim que os
fusos divergirem.

**E quem manda no balde?** O fuso do **dono da partição onde o agregado mora**. Um gráfico na
partição do dono da conta, agregado no fuso de cada subordinado, mistura três terças-feiras
diferentes numa barra só.

⚠️ **Quando escrita e leitura comparam a mesma chave, as duas usam o mesmo fuso — sem
exceção.** Num ranking, a escrita grava `semana` e a leitura compara com a que calcula: fusos
diferentes nos dois lados **zeram o painel para sempre**. E isso decide a resposta: ranking é
competição entre os subordinados de um mesmo dono, então precisa de **uma** fronteira de
semana compartilhada — a do dono, não a de cada um.

### 20.4 Jobs agendados que funcionam em qualquer fuso

O aviso diário precisa chegar de manhã **local**. `cron(0 9 * * ? *)` serve um fuso só.

**Desenho que resolve sem uma partição por região:**

1. A entrada é gravada na partição da **data civil** em que deve disparar — `SCHED#{data}`.
2. A entrada carrega o **`tz` de quem vai receber**, gravado junto.
3. O handler roda **de hora em hora** e só age nas entradas cuja hora local já chegou
   (`ja_passou(data, tz, 6)`).

⚠️ **Não particione pelo instante UTC do disparo.** É a solução que parece mais elegante e
custa caro: o cancelamento da entrada (quando a cobrança é paga, o compromisso desmarcado)
precisa recalcular o fuso para achar a chave, e quem trocar de fuso entre agendar e cancelar
deixa entradas órfãs. Com a data civil na partição, a chave é determinística e independente
de fuso.

⚠️ **O gate vem ANTES do claim.** O padrão de claim atômico é `delete_item_if_exists` seguido
da ação. Se testar a hora depois do delete, a entrada cuja hora ainda não chegou é **apagada
e perdida**.

⚠️ **A janela de varredura precisa de um dia para a frente.** Para um usuário em UTC+13, as
06:00 locais de amanhã acontecem enquanto em UTC ainda é hoje.

**Propriedade que torna a migração segura:** com o gate em 06:00 locais, quem está no fuso do
`cron` antigo (`0 9 UTC` = 06:00 em UTC-3) **não percebe diferença** — dispara na primeira
execução a partir da mesma hora. Muda só o jitter de até uma hora. Entrada gravada antes da
mudança não tem `tz` e cai no default, que é exatamente o fuso em que foi agendada: **nenhuma
migração**.

⚠️ **Renomear a chave do evento no SAM troca o logical ID.** O CloudFormation cria a regra
nova **antes** de apagar a velha, e com `Name` explícito nas duas o delete da antiga leva
junto a recém-criada — o sistema fica **sem agendamento**. Mude só a `Schedule`; mantenha a
chave, mesmo que o nome fique mentindo (`Daily:` disparando de hora em hora). Confira com
`sam deploy --no-execute-changeset`: tem que sair `Modify` / `Replacement: False`.

### 20.5 A trava — escreva-a **antes** de corrigir

Esta é a lição mais cara da seção, e ela é sobre método, não sobre fuso.

Num sistema real, a varredura manual (grep dirigido, leitura arquivo a arquivo, duas
passadas) encontrou 5 bugs de fuso. Deu-se o assunto por encerrado. A trava automática, escrita
depois, encontrou **mais 16** — incluindo um contador de gamificação bucketizado em semana UTC,
**escrita irreversível**, que já estava gravando errado havia meses.

> **A trava é um inventário melhor que a leitura.** Escreva-a primeiro; a lista de correções
> sai dela, não da sua memória. Vale para qualquer eixo transversal — fuso, moeda, unidade,
> i18n, PII.

Ela entra na família do §17.4 (guardas que abortam). Se o projeto não tem CI, mora na suíte de
testes — que é o gate real antes do deploy.

**O que travar:**

| Padrão | Onde | Por quê |
|---|---|---|
| `date.today()` | Python | Dia UTC na Lambda |
| `datetime.utcnow()` | Python | Naive e deprecado |
| `now(timezone.utc).date()` | Python | Idem `date.today()` |
| `ZoneInfo(` fora do `locale_service` | Python | Cascata com versões divergentes |
| `TZ_OFFSET` / offset fixo | Python/infra | Quebra no DST |
| `toISOString().slice(0,10)` | TS/JS | Dia UTC no lugar do dia do calendário |

⚠️ **Ignore comentário e docstring, ou a trava acusa a própria documentação.** No Python use
`tokenize` (exato, não heurística) para zerar tokens `COMMENT` e `STRING` antes de casar o
padrão. É o que permite ao documento *explicar* o padrão errado sem disparar o alarme.

⚠️ **Exceção legítima existe: exija justificativa escrita.** Um marcador `fuso-ok:` na linha
ou logo acima, com o motivo. Uma janela de partições realmente é UTC de propósito — o que não
pode é a exceção ser invisível.

```python
# Casa o padrão no código sem comentários; procura o marcador nas linhas ORIGINAIS —
# senão o próprio escape seria apagado antes de ser visto.
if any(MARCADOR in v for v in originais[max(0, n - 3):n]):
    continue
```

### 20.6 Armadilhas de fuso — índice

| Sintoma | Causa |
|---|---|
| Compromisso da noite aparece no dia seguinte | agrupou por `slice(0,10)` do ISO (dia UTC), grade em dia local |
| Compromisso do último dia da semana **some** | chave caiu fora da grade renderizada; foi baixado e descartado |
| Formulário pré-preenche amanhã à noite | `new Date().toISOString().slice(0,10)` como valor default |
| Gráfico "por dia" conta no dia errado | balde `STATS#D#` gravado em dia UTC |
| Streak quebra ou infla sem motivo | semana ISO calculada em UTC; sessão de domingo à noite cai na semana seguinte |
| "Dias que o usuário faz X" erra o dia | `weekday()` do instante UTC |
| Item vence/expira algumas horas cedo | data civil comparada com `date.today()` |
| Aviso diário chega à noite para parte dos usuários | `cron` em UTC servindo um fuso só |
| Streak conta na semana errada só quando o job automático fecha | usou "agora" em vez do instante do evento |
| Resgate de cupom dá 500 | data civil virou `datetime` naive → `naive < aware` levanta **TypeError**, não `ValueError`; o `except ValueError` não pega |
| Ranking semanal zerado para sempre | escrita e leitura calculam a chave da semana em fusos diferentes |
| Sistema fica sem job agendado após deploy verde | chave do evento renomeada no SAM com `Name` explícito |

---

## 21. Servidor MCP — a LLM do usuário falando direto com o sistema

> **Todo projeto novo nasce com servidor MCP.** Não é add-on nem fase 2: é parte da base,
> como auth e single-table. O usuário já paga ChatGPT Plus, Claude Pro ou Gemini — o produto
> que o deixa conversar com os próprios dados no cliente que ele já usa entrega automação sem
> nos custar um token sequer. Manter em `backend/app/mcp/`, com a
> spec do domínio em `docs/especificacoes/MCP_SERVER.md`.

### 21.1 Duas superfícies, propositalmente separadas

| Superfície | Lambda | Auth no gateway | Conteúdo |
|---|---|---|---|
| `mcp.{dominio}` | `McpFunction` (HttpApi própria) | nenhuma | `/.well-known/*`, `/register`, `/authorize`, `/token`, `/mcp` |
| `{dominio}/v1/mcp/*` | `ApiFunction` | Cognito | consentimento e gestão de conexões no portal |

**Subdomínio próprio, sempre.** O OAuth exige `/.well-known/oauth-authorization-server` na
*raiz* do issuer, e no domínio principal a CloudFront Function de SPA routing manda qualquer
path com ponto para o S3 → 404. O certificado wildcard `*.{dominio}` já cobre o subdomínio;
usar `AWS::ApiGatewayV2::DomainName` + `ApiMapping` + `RecordSet` — não outra distribuição
CloudFront, que sairia mais cara sem ganho. O `ApiMapping` precisa de `DependsOn` explícito
no stage: ele o referencia por nome, então o CloudFormation não infere a ordem e falha com
"Invalid stage identifier".

**API e Lambda separadas do portal.** O Bearer aqui é nosso, não do Cognito, então a API
principal (com `DefaultAuthorizer` Cognito e catch-all `/{proxy+}`) atrapalharia. Além disso
o tráfego de LLM é rajada longa de leitura — perfil oposto ao do portal — e o IAM do MCP é
menor (só DynamoDB).

### 21.2 Authorization server próprio (o Cognito não serve sozinho)

O Cognito **não suporta Dynamic Client Registration** (RFC 7591), que os conectores
hospedados do claude.ai e do ChatGPT esperam, e o padrão deste documento não cria hosted UI
(login é SRP via Amplify). Logo o AS é nosso, em FastAPI — mas o Cognito **segue sendo a
autoridade de identidade**: o consentimento roda numa rota do portal, autenticada pelo JWT
que o front já injeta. Nunca vemos senha e não duplicamos login.

```
Cliente LLM → /.well-known → /register (DCR) → /authorize
                                                   ↓ 302
                       portal /oauth/consent?req=…  (sessão Cognito + escolha de escopos)
                                                   ↓ code
                                               /token → access 15 min + refresh rotativo
```

Obrigatório: **PKCE S256**; match **exato** de `redirect_uri` (nada de prefixo ou wildcard —
é por aí que entra redirect aberto, e o erro de redirect inválido não pode voltar *pela*
redirect_uri); authorization code **one-shot** com TTL de segundos; **refresh rotativo**
(reapresentar o mesmo refresh falha — sinal clássico de token vazado); e `aud` = URL
canônica do recurso (RFC 8707), que é o que impede *confused deputy*. Códigos e refresh
tokens são gravados como **SHA-256**: tabela vazada não vira token utilizável.

Revogação segue o padrão de sessão do projeto: o item do grant guarda `revoked_at`,
comparado com o `iat` do token. Access token curto (15 min) mantém a janela pequena; o
refresh é bloqueado na hora.

O `ProtectedRoute` do frontend precisa **preservar o destino em `?next=`** — não em state do
router, que não sobrevive à navegação dura do login. Sem isso, quem chega deslogado no
consentimento perde a autorização em curso.

### 21.3 Isolamento de tenant — a regra que não tem exceção

> **Nenhuma tool aceita `user_id`/`tenant` como argumento. Ele vem só do token.**

Argumento de tool é preenchido pelo LLM, e o LLM lê conteúdo escrito por terceiros
(mensagens, formulários, textos de catálogo) — entrada não-confiável por definição. Se o
tenant fosse parâmetro, prompt injection viraria acesso cross-tenant.

- Tenant num `contextvars.ContextVar`, preenchido **só** pelo validador do Bearer; a função
  que o lê **estoura** se chamada fora do contexto (melhor quebrar que servir dado alheio).
- Todo id de entidade vindo do LLM passa pelo **mesmo guard de autorização dos routers**,
  mesmo quando "só poderia" ter vindo de uma listagem anterior.
- Atenção quando a entidade filha vive em partição própria (ex.: `AL#{aluno}`, não sob
  `PT#{personal}`): checar prefixo de PK **não basta**.
- Impersonação de admin **não existe** no caminho MCP.
- Teste obrigatório: rodar **cada tool** com o token do tenant errado e afirmar que não lê,
  não escreve e não altera nada.

### 21.4 Transporte: JSON-RPC stateless, sem o SDK

Escrever à mão (~200 linhas) em vez de usar o SDK `mcp`: o `StreamableHTTPSessionManager`
exige task group vivo no lifespan ASGI, incompatível com `Mangum(lifespan="off")` em Lambda,
e o SDK arrastaria `sse-starlette`/`uvicorn` para o pacote arm64. Responder
`application/json` em vez de SSE também evita o teto de 29 s do HTTP API.

- Métodos: `initialize`, `notifications/*` (202 sem corpo), `ping`, `tools/list`,
  `tools/call`, `prompts/list`, `prompts/get`.
- `GET`/`DELETE` em `/mcp` → **405** (sem sessão, sem stream server-initiated).
- Sem token → **401 com `WWW-Authenticate: Bearer resource_metadata="…"`**. É por esse
  header que o cliente descobre que deve iniciar o OAuth em vez de desistir.
- Schemas das tools saem de `model_json_schema()` do Pydantic — **nenhuma dependência nova**.
- ⚠️ `Form(...)` do FastAPI exige `python-multipart`, que **não** está no `requirements.txt`
  padrão e é validado já na definição da rota — o módulo inteiro falha no import e todo
  endpoint responde 500. O `/token` é sempre urlencoded: ler o corpo e usar `parse_qs`.
  O teste que cobre isso recarrega os módulos com o pacote bloqueado em `sys.modules`.

### 21.5 Design das tools

Pensar em **acessos**, não em CRUD espelhado da API. 10–18 tools, não 60.

- **Uma tool de dossiê** que devolve o contexto inteiro da entidade principal numa chamada
  economiza rodadas do LLM — e normalmente já existe um service que monta isso.
- **Projeção via modelo Pydantic de saída**, não `ProjectionExpression`: cada campo a mais é
  token pago pelo usuário.
- Toda listagem devolve `{"items": [...], "next_cursor": ...}`, com `limit` sob teto.
  **Nenhum `Scan`.**
- **Descrição de tool é prompt**: é onde se reencaixa a regra de negócio ("procure primeiro
  na biblioteca do usuário", "restrições da anamnese são invioláveis").
- ⚠️ **A inteligência de domínio se serve por TOOL, nunca só por `prompts/get`.** Os
  conectores do ChatGPT não consomem o primitivo `prompts`; o Claude Desktop expõe como
  comando que o usuário aciona à mão. Um guia servido só ali é código morto para o cliente
  mais usado. Se já existe um prompt escrito para o fluxo manual, expor uma tool
  (`guia_de_...`) que o devolve, com os dados do tenant já interpolados, e manter o corpo em
  sincronia com o arquivo do portal por teste. Deixar `prompts/get` como espelho, usando o
  mesmo renderizador — dois caminhos que se dizem "a mesma regra" divergem em um mês.
  Ela **devolve `str`**: um `dict` vira JSON no `content` e é repetido em `structuredContent`,
  o que pagaria o guia inteiro duas vezes.
- **A instrução tem que ser executável**: `instructions` do `initialize` mandando "use o
  prompt X" é instrução que o LLM não tem como cumprir — ele só chama tools. Toda referência
  em texto precisa apontar para um nome que exista em `tools/list`.
- **Marcador de canal no corpo do prompt** (`{{ENTREGA}}`): o mesmo guia serve o fluxo manual
  ("exiba o JSON, o usuário copia") e o MCP ("chame a tool de escrita"). Deixar a instrução
  de entrega fixa no corpo faz um dos dois canais receber a orientação errada; deixá-la num
  marcador mantém o corpo byte-idêntico e o teste de sincronia intacto. Escolher o texto
  conforme o escopo da conexão: mandar chamar a tool de escrita numa conexão só-leitura é
  apontar para uma tool que aquele `tools/list` nem anuncia.
- **Validar semântica antes de gravar, e ensinar no erro.** O schema Pydantic pega tipo, não
  regra de domínio. O que quebra em silêncio (vínculo descartado, unidade renderizada errada)
  vira erro que bloqueia, com campo, motivo e o valor a escrever no lugar; o resto vira aviso
  no payload de sucesso. Uma tool de dry-run deixa o LLM se corrigir de graça. A validação
  roda **antes** da chave de idempotência, senão a tentativa recusada queima a assinatura e o
  retry corrigido responde "já aplicado" sem ter gravado.
- **Erro de tool volta como resultado com `isError`**, não como erro JSON-RPC, e com texto
  acionável (`"não encontrado; use listar_x"`) — gera auto-correção em vez de loop.
- Conteúdo escrito por terceiros volta **marcado como dado, não instrução**.
- Escopos separados de leitura e escrita; conexão só-leitura **nem enxerga** as tools de
  escrita em `tools/list`.

### 21.6 Escrita: salvaguardas obrigatórias

- **Snapshot antes de escrever** (item com TTL curto) + tool de **desfazer**.
- **Resumo da mudança obrigatório** como argumento — força o LLM a declarar o que faz, e
  vira a linha de auditoria e o texto da notificação.
- **Idempotência** por hash do payload com TTL de ~60 s: o LLM repete chamadas.
- **Auditoria** com o nome do cliente OAuth e TTL longo.
- **Notificação ao usuário** a cada escrita — a mudança nunca pode ser silenciosa.
- **Nada de operação em massa** nem destrutiva além da coberta por snapshot; nunca expor
  plano, cobrança ou permissões à escrita.
- **Quota por minuto** (contador atômico com TTL) — é o controle de custo quando a feature
  não tem gate de plano.

### 21.7 Ponto jurídico

Se as tools expõem dado pessoal sensível (saúde, financeiro) — sobretudo **de terceiros**,
que não são o usuário contratante — a conexão transfere esse dado para operador estrangeiro.
Termos e Política de Privacidade **precisam cobrir a hipótese**, e a tela de consentimento
precisa dizê-lo em uma linha. Resolver isso *antes* de abrir a feature ao público.

### 21.8 Como testar

`npx @modelcontextprotocol/inspector` primeiro — é onde problema de protocolo aparece antes
de envolver qualquer LLM. Depois `claude mcp add --transport http`, claude.ai (Settings →
Connectors), ChatGPT (Connectors, modo desenvolvedor) e Gemini CLI (`mcpServers`). No app
consumidor do Gemini o suporte a conector de terceiro ainda é limitado — o caminho suportado
hoje é CLI/Vertex.

---

## 22. Template de `CLAUDE.md` para Novo Projeto

> Copiar o bloco abaixo para o `CLAUDE.md` na raiz do novo projeto, substituindo os placeholders
> `{projeto}`, `{accountId}`, `{profile}` e a descrição. Ele condensa as regras deste documento em
> formato de instrução — é o que garante que a IA siga os padrões em todas as tarefas sem reler
> este arquivo inteiro. Conforme o projeto evolui, **acrescentar** as regras específicas dele
> (deploy, domínio, integrações, armadilhas próprias), mantendo as seções abaixo intactas.

````markdown
# CLAUDE.md — {NomeDoProjeto}

## Projeto
{Uma frase: o que o produto faz e para quem.}
Arquitetura: **React 19 + FastAPI + DynamoDB + Cognito + AWS SAM** — padrão completo em
`docs/ARCHITECTURE.md` (seguir sempre; questionar qualquer proposta que o viole).

> Este projeto nasce com **custo como requisito de primeira classe**. Toda decisão de acesso a
> dado passa pelo orçamento de custo da spec técnica.

## Organização da documentação
| Documento | O que contém |
|---|---|
| `docs/ARCHITECTURE.md` | Padrão genérico da stack (infra, código, SEO, custo) |
| `docs/ESPEC_TECNICA.md` | Modelo de dados single-table, API, tenancy — **vence em conflito** |
| `docs/FUNCIONAL.md` | Produto: atores, jornadas, regras de negócio |
| `docs/ROADMAP.md` | Fases — cada fase é uma tarefa executável |

**Ordem de leitura para codar:** `ROADMAP.md` → fase atual → os documentos que a fase referencia.

## AWS Account
- Account ID: `{accountId}` · Region: `us-east-1` · Stack: `{projeto}-prod`
- **Profile: `{profile}`** — todo comando `aws`/`sam` usa `--profile {profile}`
- Conferir antes do primeiro deploy: `aws sts get-caller-identity --profile {profile}`

## Convenção de nomes
| Recurso | Nome |
|---|---|
| Stack | `{projeto}-prod` |
| DynamoDB | `{projeto}-{stage}` |
| UserPool | `{projeto}-users-{stage}` |
| Buckets | `{projeto}-frontend-{stage}-{accountId}` · `{projeto}-media-{stage}-{accountId}` |
| Tag de custo | `Project = {projeto}` |

## Separação de custos
Tag **`Project: {projeto}`** em **todos** os recursos + AppRegistry (`ARCHITECTURE.md` §12).
Recurso novo no `template.yaml` nasce com as tags. Ativar a cost allocation tag no Billing (1×).

## Deploy
> **Terminou de alterar, commita e sobe.** `git status` → `git diff` → `git add <arquivos>` →
> `git commit` → `.\deploy.ps1 all` → conferir a URL.
> As travas continuam valendo: changeset que substitua/apague tabela, pool ou distribution exige
> confirmação; `git push` e a conta de produção exigem pedido explícito.

- **Commit antes do deploy** — o SAM builda do disco, não do git.
- Backend: `sam build` → `sam deploy --no-execute-changeset` → **revisar** → `execute-change-set`.
- Frontend: `npm run build` → `s3 sync` → invalidar **só os arquivos sem hash**, nunca `/*`.
- Nunca `git add -A` em backend/infra sem revisar o diff.
- ⚠️ `delete-stack` **não** apaga tabela, pool e buckets (`Retain`). Derrubar ambiente é
  `.\destruir-ambiente.ps1 -Confirmar`.

## ⚠️ REGRAS OBRIGATÓRIAS

### Ordem de prioridade (guardrail de decisão)
**1º Viabilidade e correção → 2º Performance e escalabilidade → 3º Custo.**
Otimização de custo só vale se não degrada as duas primeiras (`ARCHITECTURE.md` §10.0): índice
necessário recebe índice; read-after-write recebe leitura consistente; Lambda latency-sensitive
pode receber mais memória — **medir, não assumir**.

### Tenancy e isolamento
- `user_id` **sempre** via JWT (`Depends(get_current_user_id)`) — nunca do body, nunca do path.
- Todo endpoint autenticado que recebe id de recurso **valida a posse antes de escrever**
  (item ponteiro ou `ConditionExpression: owner_id = :uid`). Recurso de outro dono → **404**.
- Endpoint público nunca devolve: segredo de integração, contato do dono, dado de terceiro.

### Tempo e fuso (`ARCHITECTURE.md` §20)
- Instante em **UTC**; data civil (vencimento, prazo) em `YYYY-MM-DD` e comparada com hoje **no
  fuso do dono**, nunca com `date.today()`.
- Fuso é **nome IANA**, nunca offset. Resolução só em `services/locale_service.py`.
- Balde agregado (`STATS#D#`, semana, dia-da-semana) usa o fuso do **dono da partição** onde ele
  mora — é o único ponto irreversível: contador somado errado não se converte na leitura.
- Derivar na leitura sempre que der; nunca gravar o dia derivado junto do item.
- A trava do §20.5 roda na suíte. Padrão novo entra só com `fuso-ok:` e justificativa.

### DynamoDB — performance, escala e custo
- **Single-table**, uma tabela por stage. `Scan` é **proibido**.
- **Nenhuma string de PK/SK montada fora de `repositories/keys.py`.**
- Acesso por PK+SK sempre que possível; SK composta (`TIPO#{data}#{id}`) para `begins_with`.
- GSI só para access pattern real; **sparse**; projeção mínima. No máximo dois sem justificar.
- **Escrita condicional, nunca `get` → checar em Python → `put`.** Condição é **string**,
  nunca `Attr(...)` (o boto3 sobrescreve o `ExpressionAttributeNames`).
- Atributo **nulo** não satisfaz condição numérica: o caso "sem limite" **pula** a operação
  condicional, nunca a relaxa.
- Indicador/dashboard lê **agregado pré-computado** (1 GetItem). `ADD` só é idempotente **dentro
  da transação que grava o lock**.
- `ReturnValues="ALL_NEW"` é opt-in; `ConsistentRead` só no hot path read-after-write.
- TTL obrigatório em item temporário (lock, quota, token).
- Toda coleção que cresce sem limite é paginada **de ponta a ponta** (cursor no backend **e**
  `fetchNextPage` na tela).

### Dinheiro
- **Canônico: centavos como `int`.** Nunca `float`. Conversão só na borda; formatação só por
  `formatBRL()`.

### Integração externa / webhook
- **Nunca confiar no payload** — re-consultar o provedor.
- **Lock de idempotência gravado antes do efeito**, na mesma `TransactWriteItems`.
- Chave de idempotência enviada ao provedor contém **o valor**, não só o alvo.
- Segredo de tenant nunca volta ao frontend.

### Frontend
- **Mobile-first, sem exceção.** Layout escrito para 360px; alvo de toque ≥ 44×44px.
- Bundle público **não** carrega o SDK de autenticação; o portal entra por `React.lazy`.
  `npm run build` falha se isso regredir.
- Rota fixa nova entra em **todas** as cópias da blocklist no mesmo commit — o teste de espelho
  reprova se esquecer.
- Nunca hardcodar cor, fonte ou caminho de logo: tokens CSS e `brand/brand.ts`.
- Enums espelhados backend ↔ frontend.
- Nada na árvore prerenderizada lê `window`/`localStorage`/`Date.now()` no **render**.
- Estado compartilhado entre telas é store de módulo (`useSyncExternalStore`), não `useState`.

### SEO
- Tabela única de rotas estáticas alimenta prerender, sitemap e a função de edge.
- `sitemap.xml` é **gerado no build**, com `lastmod` real. Nunca editado à mão.
- Página semiprivada nasce `noindex`; indexar é opt-in.
- `og:image` absoluta, 1200×630, com `width`/`height` declarados.

### Guardas (não desativar)
`npm run build` roda `tsc` + prerender com guardas + verificação de bundle. `npm test` roda os
testes de espelho. **Guarda que falhou é bug encontrado, não obstáculo.**

## ⚠️ REGRA OBRIGATÓRIA — Servidor MCP

Todo sistema novo **nasce com servidor MCP** (`ARCHITECTURE.md` §21) — não é add-on nem fase 2,
é base como auth. Inegociáveis:
- **Nenhuma tool recebe `user_id`/`tenant` como argumento** — vem só do token, via `ContextVar`.
  Argumento de tool é preenchido pelo LLM, que lê conteúdo escrito por terceiros.
- Todo id vindo do LLM passa pelo **mesmo guard de autorização dos routers**.
- OAuth 2.1 com PKCE S256, DCR, code one-shot, refresh rotativo, `aud` = URL do recurso.
- Escrita: snapshot + desfazer + idempotência + auditoria + notificação. Nada em massa.
- A inteligência de domínio chega por **tool**, nunca só por `prompts/get`.
- Toda tool nova entra no teste com o token do tenant errado.

## Armadilhas já encontradas (não repetir)
{Acrescentar aqui, com o sintoma e a causa, toda armadilha específica deste projeto. Começar
copiando as que se aplicarem de `ARCHITECTURE.md` §19.}

## Estado atual
{Fases concluídas, o que está no ar, o que está bloqueado e por quê, credenciais de teste,
recursos do ambiente. Manter atualizado — é a primeira coisa que a IA lê.}
````

