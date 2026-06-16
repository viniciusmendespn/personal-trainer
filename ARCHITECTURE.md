# Modelo de Arquitetura — Fullstack Serverless AWS

> Documento de referência para replicar este padrão arquitetural em outros projetos.
> Stack: **React 19 + FastAPI + DynamoDB + Cognito + AWS SAM**
> Meta de custo: **< $5/mês** em uso pessoal/baixo volume (tipicamente $0–$1/mês no free tier permanente).

---

## 1. Visão Geral

Aplicação SPA serverless com backend em Lambda, autenticação gerenciada e banco NoSQL.
Custo operacional próximo de zero em volumes baixos a médios.

```
┌──────────────────────────────────────────────────────────────┐
│                    CLIENTE (Browser)                          │
│           React SPA (S3 + CloudFront)                        │
└─────────┬────────────────────────────┬────────────────────────┘
          │                            │
          ▼                            ▼
┌──────────────────┐        ┌──────────────────────┐
│  AWS Cognito     │        │  API Gateway HTTP v2  │
│  (SRP + JWT)     │        │  + JWT Authorizer     │
└────────┬─────────┘        └──────────┬────────────┘
         │                             │
         │ idToken (JWT RS256)         ▼
         └──────────────────► ┌──────────────────┐
                              │  AWS Lambda arm64 │
                              │  (FastAPI+Mangum) │
                              └──────────┬────────┘
                                         │
                              ┌──────────┴─────────┐
                              │                    │
                              ▼                    ▼
                      ┌──────────────┐   ┌──────────────────┐
                      │  DynamoDB    │   │  Serviços ext.   │
                      │ (Single-     │   │  (LLM, email...) │
                      │  table)      │   └──────────────────┘
                      └──────────────┘
```

---

## 2. Stack Tecnológico

| Camada | Tecnologia | Versão | Motivo |
|---|---|---|---|
| Frontend Framework | React | 19 | Ecosystem, concurrent features |
| Frontend Build | Vite | 6 | DX rápido, HMR, bundle otimizado |
| Linguagem Frontend | TypeScript | 5 | Type safety end-to-end |
| Estilização | TailwindCSS | 4 | Utility-first, zero runtime |
| Estado servidor | TanStack React Query | 5 | Cache, invalidation, mutations |
| HTTP Client | Axios | 1.x | Interceptors, instância configurável |
| Auth SDK Frontend | AWS Amplify | 6 | SRP nativo, token refresh automático |
| Backend Framework | FastAPI | 0.115+ | Async, Pydantic, OpenAPI automático |
| Runtime Backend | Python | 3.12 | AWS Lambda support |
| Adaptador Lambda | Mangum | 0.19+ | ASGI → Lambda sem overhead |
| Validação Backend | Pydantic | 2.x | Data validation, serialization |
| Auth Backend | python-jose | 3.x | JWT RS256 verification |
| Banco de Dados | DynamoDB | — | Serverless, escala, sem ops |
| Autenticação | AWS Cognito | — | MFA, SRP, tokens gerenciados |
| Infraestrutura | AWS SAM | 1.155+ | IaC, build, deploy, local test |
| CDN Frontend | CloudFront | — | Cache global, SPA routing |
| Hospedagem Frontend | S3 | — | Custo mínimo, estático |

---

## 2.1 Mapa de Custos AWS (Free Tier Permanente)

> Todos os itens abaixo são free tier **sem expirar** (não são os 12 meses de free trial).

| Serviço | Free Tier/mês | Custo após | Uso típico pessoal |
|---|---|---|---|
| Lambda | 1M requests + 400k GB-s | $0.20/M req + $0.0000167/GB-s | ~1k req → **$0** |
| API Gateway HTTP | 1M requests | $1.00/M req | ~1k req → **$0** |
| DynamoDB | 25 GB storage + 200M req | $0.25/M RRU, $1.25/M WRU | ~100k req → **$0** |
| Cognito | 50.000 MAUs | $0.0055/MAU | 1–10 usuários → **$0** |
| CloudFront | 1 TB transfer + 10M req | $0.0085/GB | ~1 GB → **$0** |
| S3 | 5 GB + 20k GET | $0.023/GB | ~10 MB → **~$0.01** |

**Total estimado: $0.01–$0.50/mês** em uso pessoal. Chega a $1–3 com ~10 usuários ativos.

---

## 3. Estrutura de Diretórios

```
project-root/
├── CLAUDE.md                    # Instruções para AI (contexto do projeto)
├── ARCHITECTURE.md              # Este arquivo
├── backend/
│   ├── template.yaml            # SAM — infraestrutura completa
│   ├── samconfig.toml           # Defaults de deploy (gerado por --guided)
│   ├── requirements.txt
│   └── app/
│       ├── main.py              # FastAPI app + Mangum handler
│       ├── config.py            # Settings via pydantic-settings
│       ├── dependencies.py      # JWT validation → user_id
│       ├── models/
│       │   ├── enums.py         # Enums do domínio
│       │   └── {entity}.py      # Pydantic models por entidade
│       ├── routers/
│       │   └── {resource}.py   # Um arquivo por recurso REST
│       ├── services/
│       │   └── {name}_service.py  # Lógica de negócio
│       └── repositories/
│           └── dynamo_repo.py   # Abstração DynamoDB (singleton)
└── frontend/
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    └── src/
        ├── App.tsx              # Router + Amplify config
        ├── main.tsx             # Entry point React 19
        ├── auth/
        │   ├── AuthProvider.tsx
        │   ├── LoginPage.tsx
        │   ├── SignUpPage.tsx
        │   └── ProtectedRoute.tsx
        ├── api/
        │   ├── client.ts        # Axios instance + JWT interceptor
        │   └── {resource}.ts   # Um arquivo por recurso
        ├── types/
        │   └── index.ts         # Interfaces TypeScript centralizadas
        ├── contexts/
        │   └── {Name}Context.tsx
        ├── hooks/
        │   └── use{Resource}.ts
        ├── pages/
        │   └── {Name}Page.tsx
        ├── components/
        │   ├── layout/
        │   ├── ui/
        │   └── {feature}/
        └── utils/
            └── {name}.ts
```

---

## 4. Backend

### 4.1 main.py — FastAPI + Mangum

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum
from app.routers import accounts, items  # seus routers

app = FastAPI(title="Project Name", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],       # Cognito JWT protege; CORS é ok aberto
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(accounts.router, prefix="/v1")
app.include_router(items.router, prefix="/v1")

@app.get("/v1/health")
def health():
    return {"status": "ok"}

handler = Mangum(app, lifespan="off")  # entry point da Lambda
```

### 4.2 config.py — Settings via pydantic-settings

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    table_name: str
    cognito_user_pool_id: str
    cognito_region: str = "us-east-1"
    stage: str = "dev"
    # adicione variáveis específicas do projeto

    class Config:
        env_file = ".env"

settings = Settings()
```

### 4.3 dependencies.py — JWT Cognito → user_id

```python
import json, urllib.request
from functools import lru_cache
from jose import jwt, jwk
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.config import settings

security = HTTPBearer()

@lru_cache(maxsize=1)
def _get_jwks() -> dict:
    url = (
        f"https://cognito-idp.{settings.cognito_region}.amazonaws.com"
        f"/{settings.cognito_user_pool_id}/.well-known/jwks.json"
    )
    with urllib.request.urlopen(url) as r:
        return json.loads(r.read())

def _verify_token(token: str) -> dict:
    jwks = _get_jwks()
    header = jwt.get_unverified_header(token)
    key = next(k for k in jwks["keys"] if k["kid"] == header["kid"])
    public_key = jwk.construct(key)
    return jwt.decode(token, public_key, algorithms=["RS256"],
                      options={"verify_aud": False})

def get_current_user_id(
    creds: HTTPAuthorizationCredentials = Depends(security),
) -> str:
    try:
        payload = _verify_token(creds.credentials)
    except Exception:
        raise HTTPException(status_code=401, detail="Token inválido")
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token sem sub")
    return user_id
```

### 4.4 repositories/dynamo_repo.py — Singleton DynamoDB

```python
import boto3
from boto3.dynamodb.conditions import Key, Attr
from app.config import settings

_table = None

def _get_table():
    global _table
    if _table is None:
        dynamodb = boto3.resource("dynamodb", region_name=settings.cognito_region)
        _table = dynamodb.Table(settings.table_name)
    return _table

# --- Primitivos ---

def put_item(pk: str, sk: str, data: dict) -> None:
    _get_table().put_item(Item={"PK": pk, "SK": sk, **data})

def get_item(pk: str, sk: str) -> dict | None:
    resp = _get_table().get_item(Key={"PK": pk, "SK": sk})
    return resp.get("Item")

def delete_item(pk: str, sk: str) -> None:
    _get_table().delete_item(Key={"PK": pk, "SK": sk})

def query_pk(pk: str, sk_prefix: str | None = None) -> list[dict]:
    kwargs: dict = {
        "KeyConditionExpression": Key("PK").eq(pk)
    }
    if sk_prefix:
        kwargs["KeyConditionExpression"] &= Key("SK").begins_with(sk_prefix)
    resp = _get_table().query(**kwargs)
    return resp.get("Items", [])

def query_gsi(
    index: str, pk_name: str, pk_value: str,
    sk_name: str | None = None, sk_prefix: str | None = None
) -> list[dict]:
    cond = Key(pk_name).eq(pk_value)
    if sk_name and sk_prefix:
        cond &= Key(sk_name).begins_with(sk_prefix)
    resp = _get_table().query(IndexName=index, KeyConditionExpression=cond)
    return resp.get("Items", [])

def update_item(pk: str, sk: str, fields: dict, return_values: bool = False) -> dict:
    expr = "SET " + ", ".join(f"#{k} = :{k}" for k in fields)
    names = {f"#{k}": k for k in fields}
    values = {f":{k}": v for k, v in fields.items()}
    resp = _get_table().update_item(
        Key={"PK": pk, "SK": sk},
        UpdateExpression=expr,
        ExpressionAttributeNames=names,
        ExpressionAttributeValues=values,
        # ReturnValues="ALL_NEW" consome RCUs além dos WCUs — usar só quando necessário.
        ReturnValues="ALL_NEW" if return_values else "NONE",
    )
    return resp.get("Attributes", {})

def update_item_if_exists(pk: str, sk: str, fields: dict) -> dict:
    """Update condicional — lança ConditionalCheckFailedException se item não existe.
    Evita o padrão get_item → update_item (2 operações → 1 operação).
    """
    from boto3.dynamodb.conditions import Attr
    expr = "SET " + ", ".join(f"#{k} = :{k}" for k in fields)
    names = {f"#{k}": k for k in fields}
    values = {f":{k}": v for k, v in fields.items()}
    try:
        resp = _get_table().update_item(
            Key={"PK": pk, "SK": sk},
            UpdateExpression=expr,
            ConditionExpression=Attr("PK").exists(),
            ExpressionAttributeNames=names,
            ExpressionAttributeValues=values,
            ReturnValues="ALL_NEW",
        )
        return resp.get("Attributes", {})
    except _get_table().meta.client.exceptions.ConditionalCheckFailedException:
        return None  # item não encontrado

def batch_write(puts: list[dict] = None, deletes: list[tuple] = None) -> None:
    table = _get_table()
    requests = []
    for item in (puts or []):
        requests.append({"PutRequest": {"Item": item}})
    for pk, sk in (deletes or []):
        requests.append({"DeleteRequest": {"Key": {"PK": pk, "SK": sk}}})
    for i in range(0, len(requests), 25):
        table.meta.client.batch_write_item(
            RequestItems={settings.table_name: requests[i:i+25]}
        )
```

### 4.5 routers/{resource}.py — Padrão de Router

```python
from fastapi import APIRouter, Depends, HTTPException
from app.dependencies import get_current_user_id
from app.models.item import ItemCreate, Item
from app import repositories as repo

router = APIRouter(prefix="/items", tags=["items"])

def _pk(user_id: str) -> str:
    return f"USER#{user_id}"

def _sk(item_id: str) -> str:
    return f"ITEM#{item_id}"

@router.get("", response_model=list[Item])
def list_items(user_id: str = Depends(get_current_user_id)):
    items = repo.dynamo_repo.query_pk(_pk(user_id), sk_prefix="ITEM#")
    return [Item(**i) for i in items]

@router.post("", response_model=Item, status_code=201)
def create_item(body: ItemCreate, user_id: str = Depends(get_current_user_id)):
    item_id = str(uuid4())
    item = Item(item_id=item_id, user_id=user_id, **body.model_dump())
    repo.dynamo_repo.put_item(_pk(user_id), _sk(item_id), item.model_dump())
    return item

@router.put("/{item_id}", response_model=Item)
def update_item(
    item_id: str, body: ItemCreate,
    user_id: str = Depends(get_current_user_id)
):
    # update_item_if_exists: 1 operação DynamoDB (condicional) em vez de get + update (2 operações)
    updated = repo.dynamo_repo.update_item_if_exists(
        _pk(user_id), _sk(item_id), body.model_dump(exclude_none=True)
    )
    if updated is None:
        raise HTTPException(404, "Item não encontrado")
    return Item(**updated)

@router.delete("/{item_id}", status_code=204)
def delete_item(item_id: str, user_id: str = Depends(get_current_user_id)):
    # delete condicional: só deleta se existir, sem read prévio
    from boto3.dynamodb.conditions import Attr
    from botocore.exceptions import ClientError
    try:
        repo.dynamo_repo._get_table().delete_item(
            Key={"PK": _pk(user_id), "SK": _sk(item_id)},
            ConditionExpression=Attr("PK").exists(),
        )
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            raise HTTPException(404, "Item não encontrado")
        raise
```

### 4.6 models/{entity}.py — Pydantic Models

```python
from pydantic import BaseModel, Field
from decimal import Decimal
from typing import Optional
from enum import Enum

class ItemStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"

class ItemCreate(BaseModel):
    nome: str
    valor: Decimal = Field(ge=Decimal("0"))
    status: ItemStatus = ItemStatus.ACTIVE
    descricao: Optional[str] = None

class Item(ItemCreate):
    item_id: str
    user_id: str
    created_at: str
    updated_at: str
```

---

## 5. DynamoDB — Single-Table Design

### 5.1 Estrutura de Chaves

```
Tabela única: {project}-{stage}
Billing: PAY_PER_REQUEST (serverless)

Chave Primária:
  PK (partition): "USER#{user_id}" ou "SYSTEM#{key}"
  SK (sort):      Identifica tipo + id do item
```

### 5.2 SK Patterns por Tipo de Item

```
PROFILE         → PROFILE  (singleton por usuário)
ACCOUNT         → ACCOUNT#{account_id}
ITEM            → ITEM#{item_id}
ITEM POR MES    → ITEM#{year}-{month}#{item_id}
SNAPSHOT/CACHE  → SNAPSHOT#{year}-{month}
CONFIGURAÇÃO    → CONFIG#{name}
QUOTA/RATE LIM. → QUOTA#{window_key}  (com TTL)
SHARE           → SHARE#{token}  (PK diferente)
CHECKPOINT      → CHECKPOINT#{year}#{timestamp}
```

### 5.3 Global Secondary Indexes

**GSI1 — Query rápida por período:**
```yaml
GSI1PK: "USER#{user_id}#{year}-{month}"    # para query por mês
GSI1SK: "ITEM#{ordem:04d}#{item_id}"       # para sorting
```

**GSI2 — Query por agrupamento (séries, parcelamentos):**
```yaml
GSI2PK: "GROUP#{group_id}"                 # série ou lote
GSI2SK: "PERIOD#{year}-{month}#{item_id}"  # para lista temporal
```

### 5.4 Template DynamoDB (SAM)

```yaml
MainTable:
  Type: AWS::DynamoDB::Table
  Properties:
    TableName: !Sub "${ProjectName}-${Stage}"
    BillingMode: PAY_PER_REQUEST
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
        Projection: { ProjectionType: ALL }
    TimeToLiveSpecification:
      AttributeName: ttl
      Enabled: true
```

### 5.5 Indicadores e Agregação Cumulativa (agregar na escrita, nunca varrer na leitura)

**Regra:** indicadores, métricas e dashboards são servidos por **itens agregados pré-computados**,
lidos em **1 GetItem ou query curta**. **Nunca** calcular indicador com `Scan` ou `Query` de N itens
somados em memória no caminho de leitura — não escala: custo e latência crescem com o histórico.

O agregado é mantido **no momento da escrita**, em dois níveis conforme a métrica:

**Nível A — contador atômico síncrono** (métrica simples, imediata, baixa cardinalidade):
- `update_item` com `ADD` (incremento atômico) num item `SNAPSHOT#`/`STATS#`. 1 write, sem read prévio.
- `ADD` **não** é idempotente: se a escrita puder ser reentregue/retried, colocar o incremento na
  **mesma `TransactWriteItems`** que grava um marcador de idempotência condicional (ou ambos, ou nada).

**Nível B — agregação assíncrona via DynamoDB Streams** (métrica analítica / série temporal / volume):
- Habilitar **Streams** na tabela; uma **Lambda agregadora** consome os eventos de escrita e atualiza
  os buckets `SNAPSHOT#{period}`.
- O **write quente fica mínimo (1 item)**; a agregação sai do caminho crítico. Escala naturalmente
  (o Stream absorve picos; retries com checkpoint).
- **Idempotência:** guardar a `version`/sequence do último evento aplicado no item de stats, ou usar
  **set-state** (recalcular o bucket a partir do valor do item) em vez de incremento cego.

**Onde mora o agregado:** na partição de **quem lê** (mesma PK que serve o dashboard). Buckets por
período (`all`/dia/semana/mês) dão série temporal sem tocar os itens-fonte.

**Backfill/reparo:** um script de recálculo reconstrói os agregados a partir dos itens-fonte (§8.3).
É caminho de **manutenção/correção** (migração, bug na agregadora), nunca de leitura em produção.

> Escolha A vs B: métrica que precisa estar **certa na hora e é barata de contar** → A (transacional).
> Métrica **analítica/volumosa** → B (Streams). Na dúvida, B — mantém o write quente lean e escala melhor.

**Habilitar Streams + agregadora (quando usar Nível B):**
```yaml
  MainTable:
    Type: AWS::DynamoDB::Table
    Properties:
      # ... (KeySchema, GSIs, TTL como acima)
      StreamSpecification:
        StreamViewType: NEW_AND_OLD_IMAGES

  AggregatorFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: app.aggregator.handler
      CodeUri: ./
      Policies:
        - DynamoDBCrudPolicy: { TableName: !Ref MainTable }
      Events:
        Stream:
          Type: DynamoDB
          Properties:
            Stream: !GetAtt MainTable.StreamArn
            StartingPosition: LATEST
            BatchSize: 100
            MaximumBatchingWindowInSeconds: 5   # coalesce: menos invocações e menos writes de agregado
```

---

## 6. Infraestrutura — template.yaml completo

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31
Description: "{ProjectName} — Fullstack Serverless"

Parameters:
  Stage:
    Type: String
    Default: dev
    AllowedValues: [dev, prod]
  ProjectName:
    Type: String
    Default: my-project
  LlmUrl:         # exemplo de param sensível
    Type: String
    Default: ""
  LlmToken:
    Type: String
    Default: ""
    NoEcho: true
  DeployFrontendInfra:
    Type: String
    Default: "false"
    AllowedValues: ["true", "false"]

Conditions:
  CreateFrontendInfra: !Equals [!Ref DeployFrontendInfra, "true"]
  IsProd: !Equals [!Ref Stage, "prod"]

Globals:
  Function:
    Timeout: 29          # 1s abaixo do max; API Gateway HTTP tem timeout de 29s
    MemorySize: 256      # DynamoDB-bound: gargalo é I/O, não CPU; 256MB = metade do custo vs 512MB
    Runtime: python3.12
    Architectures: [arm64]  # Graviton2: 20% mais barato E mais rápido que x86_64; zero esforço
    Environment:
      Variables:
        TABLE_NAME: !Ref MainTable
        COGNITO_USER_POOL_ID: !Ref UserPool
        COGNITO_REGION: !Ref AWS::Region
        STAGE: !Ref Stage
        LLM_URL: !Ref LlmUrl
        LLM_TOKEN: !Ref LlmToken

Resources:

  # ── Cognito ────────────────────────────────────────────────────────────────

  UserPool:
    Type: AWS::Cognito::UserPool
    Properties:
      UserPoolName: !Sub "${ProjectName}-users-${Stage}"
      AutoVerifiedAttributes: [email]
      UsernameAttributes: [email]
      Policies:
        PasswordPolicy:
          MinimumLength: 8
          RequireLowercase: true
          RequireUppercase: true
          RequireNumbers: true
          RequireSymbols: false

  UserPoolClient:
    Type: AWS::Cognito::UserPoolClient
    Properties:
      ClientName: !Sub "${ProjectName}-web-${Stage}"
      UserPoolId: !Ref UserPool
      GenerateSecret: false
      ExplicitAuthFlows:
        - ALLOW_USER_SRP_AUTH
        - ALLOW_REFRESH_TOKEN_AUTH

  # ── API Gateway HTTP API ───────────────────────────────────────────────────
  # HTTP API v2: 71% mais barato que REST API ($1.00/M vs $3.50/M requests)
  # Menor latência + JWT authorizer nativo (sem Lambda extra de autorização)

  ApiGateway:
    Type: AWS::Serverless::HttpApi
    Properties:
      StageName: !Ref Stage
      CorsConfiguration:
        AllowMethods: [GET, POST, PUT, PATCH, DELETE, OPTIONS]
        AllowHeaders: [Content-Type, Authorization]
        AllowOrigins: ["*"]
      Auth:
        DefaultAuthorizer: CognitoJwtAuthorizer
        Authorizers:
          CognitoJwtAuthorizer:
            IdentitySource: $request.header.Authorization
            JwtConfiguration:
              issuer: !Sub "https://cognito-idp.${AWS::Region}.amazonaws.com/${UserPool}"
              audience:
                - !Ref UserPoolClient

  # ── Lambda (FastAPI) ───────────────────────────────────────────────────────

  ApiFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: app.main.handler
      CodeUri: ./
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref MainTable
      Events:
        HealthCheck:
          Type: HttpApi
          Properties:
            ApiId: !Ref ApiGateway
            Path: /v1/health
            Method: GET
            Auth:
              Authorizer: NONE
        PublicProxy:             # endpoints sem auth (share, etc.)
          Type: HttpApi
          Properties:
            ApiId: !Ref ApiGateway
            Path: /v1/public/{proxy+}
            Method: ANY
            Auth:
              Authorizer: NONE
        AuthProxy:               # todos os outros endpoints
          Type: HttpApi
          Properties:
            ApiId: !Ref ApiGateway
            Path: /{proxy+}
            Method: ANY

  # ── DynamoDB ────────────────────────────────────────────────────────────────

  MainTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: !Sub "${ProjectName}-${Stage}"
      BillingMode: PAY_PER_REQUEST
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
          Projection: { ProjectionType: ALL }   # ALL: necessário — lemos o item completo via GSI1
        - IndexName: GSI2
          KeySchema:
            - { AttributeName: GSI2PK, KeyType: HASH }
            - { AttributeName: GSI2SK, KeyType: RANGE }
          Projection: { ProjectionType: KEYS_ONLY }  # KEYS_ONLY: GSI2 é usado só para descobrir PKs,
                                                      # depois fazemos get_item na tabela principal.
                                                      # Reduz custo de write em ~33% (1 write → 2 WRU ao invés de 3).
      TimeToLiveSpecification:
        AttributeName: ttl
        Enabled: true

  # ── S3 + CloudFront (opcional) ─────────────────────────────────────────────

  FrontendBucket:
    Type: AWS::S3::Bucket
    Condition: CreateFrontendInfra
    Properties:
      BucketName: !Sub "${ProjectName}-frontend-${Stage}-${AWS::AccountId}"
      PublicAccessBlockConfiguration:
        BlockPublicAcls: true
        BlockPublicPolicy: true
        IgnorePublicAcls: true
        RestrictPublicBuckets: true

  FrontendBucketPolicy:
    Type: AWS::S3::BucketPolicy
    Condition: CreateFrontendInfra
    Properties:
      Bucket: !Ref FrontendBucket
      PolicyDocument:
        Statement:
          - Effect: Allow
            Principal:
              Service: cloudfront.amazonaws.com
            Action: s3:GetObject
            Resource: !Sub "${FrontendBucket.Arn}/*"
            Condition:
              StringEquals:
                AWS:SourceArn: !Sub "arn:aws:cloudfront::${AWS::AccountId}:distribution/${CloudFrontDistribution}"

  CloudFrontOAC:
    Type: AWS::CloudFront::OriginAccessControl
    Condition: CreateFrontendInfra
    Properties:
      OriginAccessControlConfig:
        Name: !Sub "${ProjectName}-oac-${Stage}"
        OriginAccessControlOriginType: s3
        SigningBehavior: always
        SigningProtocol: sigv4

  CloudFrontDistribution:
    Type: AWS::CloudFront::Distribution
    Condition: CreateFrontendInfra
    Properties:
      DistributionConfig:
        Enabled: true
        DefaultRootObject: index.html
        Origins:
          - Id: S3Origin
            DomainName: !GetAtt FrontendBucket.RegionalDomainName
            OriginAccessControlId: !Ref CloudFrontOAC
            S3OriginConfig: {}
          - Id: ApiOrigin
            DomainName: !Sub "${ApiGateway}.execute-api.${AWS::Region}.amazonaws.com"
            OriginPath: !Sub "/${Stage}"
            CustomOriginConfig:
              HTTPSPort: 443
              OriginProtocolPolicy: https-only
        DefaultCacheBehavior:
          TargetOriginId: S3Origin
          ViewerProtocolPolicy: redirect-to-https
          CachePolicyId: 658327ea-f89d-4fab-a63d-7e88639e58f6   # CachingOptimized
          AllowedMethods: [GET, HEAD]
        CacheBehaviors:
          - PathPattern: /v1/*
            TargetOriginId: ApiOrigin
            ViewerProtocolPolicy: https-only
            CachePolicyId: 4135ea2d-6df8-44a3-9df3-4b5a84be39ad  # CachingDisabled
            AllowedMethods: [GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE]
            OriginRequestPolicyId: b689b0a8-53d0-40ab-baf2-68738e2966ac  # AllViewerExceptHostHeader
        CustomErrorResponses:
          - ErrorCode: 403
            ResponseCode: 200
            ResponsePagePath: /index.html
          - ErrorCode: 404
            ResponseCode: 200
            ResponsePagePath: /index.html

# ── Outputs ──────────────────────────────────────────────────────────────────

Outputs:
  ApiUrl:
    # HTTP API v2: URL usa ApiGateway.ApiEndpoint (sem /${Stage} — já embutido)
    Value: !GetAtt ApiGateway.ApiEndpoint
  UserPoolId:
    Value: !Ref UserPool
  UserPoolClientId:
    Value: !Ref UserPoolClient
  TableName:
    Value: !Ref MainTable
  CloudFrontUrl:
    Condition: CreateFrontendInfra
    Value: !Sub "https://${CloudFrontDistribution.DomainName}"
  FrontendBucket:
    Condition: CreateFrontendInfra
    Value: !Ref FrontendBucket
  CloudFrontDistributionId:
    Condition: CreateFrontendInfra
    Value: !Ref CloudFrontDistribution
```

---

## 7. Frontend

### 7.1 App.tsx — Router + Amplify config

```tsx
import { Amplify } from 'aws-amplify'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './auth/AuthProvider'
import { ProtectedRoute } from './auth/ProtectedRoute'
import LoginPage from './auth/LoginPage'
import SignUpPage from './auth/SignUpPage'
import DashboardPage from './pages/DashboardPage'
import AppLayout from './components/layout/AppLayout'

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
    },
  },
})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,         // 1min: dados ficam frescos por 1min sem refetch
      gcTime: 5 * 60_000,        // 5min: mantém em cache mesmo sem observers (ex: ao navegar entre abas)
      refetchOnWindowFocus: false, // não dispara API call ao focar a janela
      refetchOnMount: true,      // mas refetch ao montar se stale
      retry: 1,                  // 1 retry em caso de erro (ex: cold start Lambda)
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignUpPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                {/* adicione rotas aqui */}
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
```

### 7.2 api/client.ts — Axios + JWT Interceptor

```typescript
import axios from 'axios'
import { fetchAuthSession } from 'aws-amplify/auth'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Cache do token em memória — evita chamar fetchAuthSession() em cada request.
// O idToken do Cognito tem validade de 1h; renovamos 2min antes de expirar.
let _cachedToken: string | null = null
let _tokenExpiresAt = 0

async function getToken(): Promise<string | null> {
  const now = Date.now()
  if (_cachedToken && now < _tokenExpiresAt - 120_000) {
    return _cachedToken  // usa cache se faltam mais de 2min para expirar
  }
  try {
    const session = await fetchAuthSession()
    const token = session.tokens?.idToken
    if (!token) return null
    _cachedToken = token.toString()
    // payload.exp é Unix timestamp em segundos
    const exp = (token.payload.exp as number) * 1000
    _tokenExpiresAt = exp
    return _cachedToken
  } catch {
    return null
  }
}

api.interceptors.request.use(async (config) => {
  const token = await getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      _cachedToken = null  // invalida cache ao receber 401
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api
```

### 7.3 api/{resource}.ts — Padrão de Resource API

```typescript
import api from './client'
import type { Item, ItemCreate } from '../types'

export const itemsApi = {
  list: () =>
    api.get<Item[]>('/v1/items').then(r => r.data),

  create: (body: ItemCreate) =>
    api.post<Item>('/v1/items', body).then(r => r.data),

  update: (id: string, body: Partial<ItemCreate>) =>
    api.put<Item>(`/v1/items/${id}`, body).then(r => r.data),

  remove: (id: string) =>
    api.delete(`/v1/items/${id}`),
}
```

### 7.4 hooks/use{Resource}.ts — React Query Hooks

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { itemsApi } from '../api/items'
import type { ItemCreate } from '../types'

const QUERY_KEY = ['items']

export function useItems() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: itemsApi.list,
  })
}

export function useCreateItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ItemCreate) => itemsApi.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useUpdateItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<ItemCreate> }) =>
      itemsApi.update(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useDeleteItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => itemsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}
```

### 7.5 auth/AuthProvider.tsx

```tsx
import { createContext, useContext, useEffect, useState } from 'react'
import { getCurrentUser, signIn, signOut, type AuthUser } from 'aws-amplify/auth'

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getCurrentUser()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const handleSignIn = async (email: string, password: string) => {
    const { isSignedIn } = await signIn({ username: email, password })
    if (isSignedIn) setUser(await getCurrentUser())
  }

  const handleSignOut = async () => {
    await signOut()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn: handleSignIn, signOut: handleSignOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
```

### 7.6 auth/ProtectedRoute.tsx

```tsx
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './AuthProvider'

export function ProtectedRoute() {
  const { user, loading } = useAuth()
  if (loading) return <div>Carregando...</div>
  if (!user) return <Navigate to="/login" replace />
  return <Outlet />
}
```

### 7.7 types/index.ts — Interfaces TypeScript

```typescript
// Regras de tipo para valores monetários:
// - Backend: Decimal (Python)
// - Frontend: string (sem float, exatidão garantida)
// - Exibição: Intl.NumberFormat ou Decimal.js

export interface Item {
  item_id: string
  user_id: string
  nome: string
  valor: string          // Decimal como string
  status: ItemStatus
  descricao?: string
  created_at: string
  updated_at: string
}

export interface ItemCreate {
  nome: string
  valor: string          // Decimal como string
  status?: ItemStatus
  descricao?: string
}

export type ItemStatus = 'ACTIVE' | 'INACTIVE'
```

### 7.8 .env.example

```bash
VITE_API_URL=https://{id}.execute-api.{region}.amazonaws.com/prod
VITE_COGNITO_USER_POOL_ID={region}_{poolId}
VITE_COGNITO_CLIENT_ID={clientId}
```

### 7.9 vite.config.ts

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
})
```

### 7.10 package.json (dependências essenciais)

```json
{
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.0.0",
    "@tanstack/react-query": "^5.0.0",
    "axios": "^1.7.0",
    "aws-amplify": "^6.0.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.0.0",
    "vite": "^6.0.0",
    "typescript": "^5.0.0",
    "tailwindcss": "^4.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0"
  }
}
```

---

## 8. Comandos de Deploy

### 8.1 Backend

```bash
# Build (sempre antes de deploy)
cd backend
sam build

# Primeiro deploy (guiado — gera samconfig.toml)
sam deploy --guided --profile {aws-profile}

# Deploys subsequentes
sam deploy --profile {aws-profile}

# Desenvolvimento local
sam local start-api --profile {aws-profile}
```

### 8.2 Frontend

```bash
# Build
cd frontend
npm run build

# Deploy para S3
aws s3 sync dist/ s3://{bucket-name}/ --delete --profile {aws-profile}

# Invalidar cache CloudFront
aws cloudfront create-invalidation \
  --distribution-id {dist-id} \
  --paths "/*" \
  --profile {aws-profile}
```

### 8.3 Recalcular snapshots/caches após migração

```python
# Via script ou no backend diretamente
from app.services.snapshot_service import calculate_and_store_range
calculate_and_store_range(user_id, year, 1, 12)
```

---

## 9. Padrões Obrigatórios

### 9.1 Dinheiro — nunca usar float

```python
# CORRETO — backend
from decimal import Decimal
valor: Decimal = Decimal("99.90")
```

```typescript
// CORRETO — frontend (string → Decimal.js para exibição)
valor: string = "99.90"
const formatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valor))
```

```python
# ERRADO — nunca
valor: float = 99.9
```

### 9.2 Isolamento por usuário — sempre

```python
# Todo item no DynamoDB deve ter user_id na PK
PK = f"USER#{user_id}"

# Nunca aceitar user_id do body — sempre do JWT
user_id: str = Depends(get_current_user_id)
```

### 9.3 Enums — sempre tipados

```python
# Backend
class Status(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
```

```typescript
// Frontend — espelho dos enums do backend
export type Status = 'ACTIVE' | 'INACTIVE'
```

### 9.4 Error responses — estruturadas

```python
# Simples
raise HTTPException(status_code=404, detail="Item não encontrado")

# Estruturado (para tratamento específico no frontend)
raise HTTPException(status_code=409, detail={
    "code": "conflict_requires_confirmation",
    "items": ["id1", "id2"],
    "message": "Itens já existem nesse período"
})
```

```typescript
// Frontend — trata por código
} catch (err) {
  if (err.response?.status === 409) {
    const { code, items } = err.response.data.detail
    if (code === 'conflict_requires_confirmation') {
      // mostra modal de confirmação
    }
  }
}
```

### 9.5 Nomes de chaves DynamoDB

```
PK sempre: USER#{user_id}
SK sempre: {TIPO_EM_MAIUSCULO}#{id}

Exemplos:
  ACCOUNT#{uuid}
  ITEM#{uuid}
  ITEM#{year}-{month}#{uuid}
  SNAPSHOT#{year}-{month}
  CONFIG#{key}
  QUOTA#{window}   ← com TTL
```

---

## 10. Otimizações de Custo e Performance

### 10.0 Guardrail — ordem de prioridade (custo é o último critério)

> Custo baixo é **meta**, não restrição absoluta. A ordem de decisão é:
>
> **1º Viabilidade e correção → 2º Performance e escalabilidade → 3º Custo.**
>
> Uma otimização de custo só vale se **não** degrada as duas primeiras. Economia que vira latência
> ruim, leitura desatualizada, `Scan` que não escala, ou feature inviável é **prejuízo**, não economia.

Onde as otimizações de custo **cedem** (e os anti-patterns de §10.2 **não** se aplicam):

- **Índice necessário recebe índice.** "Poucos GSIs" combate índices **redundantes**, não
  **necessários**. Access pattern real que não é servível por query direta → **cria-se o GSI**; pagar
  1 WRU extra é muito melhor que um `Scan` que não escala.
- **Consistência forte onde há read-after-write.** Eventual por padrão (metade do custo) vale para
  leitura tolerante a atraso; num hot path que **relê o que acabou de escrever**, usar leitura
  **consistente** — ler estado velho ali quebra a lógica, e o custo extra é irrelevante perto do dano.
- **Dimensionar Lambda latency-sensitive pela UX.** 256 MB é ótimo para CRUD I/O-bound; funções no
  caminho crítico do usuário (webhook, agente, etc.) podem justificar **mais memória / warm** para a
  resposta ser rápida. **Medir, não assumir.** Separar funções isola o cold start de uma do tráfego da outra.
- **Não denormalizar até virar bug.** Cada cópia (ponteiro, snapshot) tem custo de consistência. Vale
  quando colapsa um read quente; não vale quando cria caminhos de atualização frágeis.

### 10.1 Decisões arquiteturais já tomadas (não reverter)

| Decisão | Motivo |
|---|---|
| HTTP API v2 (não REST API) | 71% mais barato; JWT authorizer nativo sem Lambda extra |
| arm64 / Graviton2 | 20% mais barato por GB-segundo + cold start menor |
| DynamoDB PAY_PER_REQUEST | Escala a zero quando sem uso; provisioned tem custo mínimo |
| Lambda sem Provisioned Concurrency | Cold start ~2s aceitável p/ CRUD; reavaliar p/ função latency-sensitive (§10.0) |
| GSI2 com KEYS_ONLY | Usado só para descobrir PKs; ALL dobraria custo de escrita desnecessariamente |
| TTL em registros de quota/rate-limit | DynamoDB limpa automaticamente; sem custo de delete explícito |
| Singleton DynamoDB client | Reutiliza conexão entre warm invocations; sem overhead de reconexão |
| Token cache em memória no frontend | Evita `fetchAuthSession()` a cada request; Amplify tem overhead de async |

### 10.2 Anti-patterns a evitar

**DynamoDB — não fazer `get_item` antes de `update_item` ou `delete_item`:**
```python
# ERRADO — 2 operações (1 RCU + 1 WCU)
item = dynamo_repo.get_item(pk, sk)
if not item:
    raise HTTPException(404)
dynamo_repo.update_item(pk, sk, fields)

# CORRETO — 1 operação condicional (1 WCU + 0 RCU)
result = dynamo_repo.update_item_if_exists(pk, sk, fields)
if result is None:
    raise HTTPException(404)
```

**DynamoDB — não usar `ReturnValues="ALL_NEW"` por padrão:**
```python
# ERRADO — consome RCU além do WCU para devolver o item
update_item(..., ReturnValues="ALL_NEW")

# CORRETO — só usa quando realmente precisa do dado retornado
update_item(..., return_values=True)   # parâmetro opt-in
```

**DynamoDB — não criar GSI com `ALL` quando `KEYS_ONLY` é suficiente:**
```
# GSI1 = lê itens completos via índice → ALL correto
# GSI2 = só descobre quais PKs existem, depois get_item na tabela → KEYS_ONLY correto
```

**Lambda — não usar x86_64:**
```yaml
# ERRADO
Architectures: [x86_64]

# CORRETO — arm64 é 20% mais barato e mais rápido sem mudar nada no código Python
Architectures: [arm64]
```

**Lambda — não usar MemorySize alto para workloads I/O-bound:**
```yaml
# Desnecessário para apps DynamoDB-bound (gargalo é latência de rede, não CPU)
MemorySize: 1024  # paga 4x mais sem ganho real

# Suficiente — DynamoDB responde em <5ms; CPU fica ociosa durante I/O
MemorySize: 256
```

**Frontend — não chamar `fetchAuthSession()` em cada request:**
```typescript
// ERRADO — overhead de Promise + verificação de token a cada chamada de API
api.interceptors.request.use(async (config) => {
  const session = await fetchAuthSession()   // chamado 20x se há 20 requests simultâneos
  ...
})

// CORRETO — cache em memória com verificação de expiração (ver seção 7.2)
const token = await getToken()  // retorna do cache se ainda válido
```

**CloudFront — não invalidar `/*` desnecessariamente:**
```bash
# ERRADO — invalida tudo, cobra por invalidação após 1000/mês
aws cloudfront create-invalidation --paths "/*"

# CORRETO — Vite gera hashes nos assets (main.[hash].js); só index.html muda
# Invalide apenas os arquivos sem hash:
aws cloudfront create-invalidation --paths "/index.html" "/assets/manifest.json"
```

### 10.3 Estimativa de custo por volume

| Usuários ativos/mês | Requests/mês | Custo estimado |
|---|---|---|
| 1–10 | < 100k | **$0.00** (free tier cobre tudo) |
| 10–100 | 100k–1M | **$0.10–$1.00** |
| 100–1.000 | 1M–10M | **$1.00–$10.00** |
| > 1.000 | > 10M | Avaliar cache + CDN mais agressivos |

### 10.4 Otimizações opcionais (só se necessário)

Não implementar preventivamente — adicione apenas quando o custo aparecer:

- **Lambda Layers**: Separa `requirements.txt` do código em um Layer compartilhado. Reduz tempo de cold start (~30%) e tamanho do pacote deployado. Só vale com múltiplas Lambdas ou quando o cold start incomoda.
- **DynamoDB DAX**: Cache em memória na frente do DynamoDB. Só vale com > 1M leituras/mês do mesmo dado repetido. Tem custo fixo mínimo (~$0.25/hora) — inviável para uso pessoal.
- **API Gateway Caching**: Cache de respostas GET por X segundos. Cobra $0.02/hora independente do uso. Substituível por `staleTime` do React Query sem custo.
- **CloudFront Functions**: Lógica na borda (auth check, redirect). Substitui Lambda@Edge quando a lógica é simples.
- **S3 Intelligent Tiering**: Para arquivos grandes e raramente acessados. Inútil para SPAs (~1MB de assets).

---

## 11. Checklist — Novo Projeto

### Infraestrutura
- [ ] Copiar `template.yaml` e substituir `{ProjectName}`
- [ ] Confirmar: `Type: AWS::Serverless::HttpApi` (não `::Api`)
- [ ] Confirmar: `Architectures: [arm64]` (não x86_64)
- [ ] Confirmar: `MemorySize: 256` (ajustar só se CPU-bound)
- [ ] Confirmar: `Timeout: 29` (alinhado com limite HTTP API)
- [ ] Definir SK patterns para as entidades do domínio
- [ ] GSI **redundante** evitado, mas access pattern real que precisa de índice **recebe** índice (§10.0) — nunca vira `Scan`
- [ ] GSI1 com `ALL` apenas se lê itens completos via índice; índice só-para-descobrir-PK com `KEYS_ONLY`
- [ ] Habilitar TTL na tabela (`TimeToLiveSpecification`)
- [ ] Indicadores definidos via **agregado pré-computado** (§5.5); habilitar `StreamSpecification` + agregadora se usar Nível B
- [ ] Rodar `sam deploy --guided` uma vez para gerar `samconfig.toml`
- [ ] Anotar outputs: `ApiUrl`, `UserPoolId`, `UserPoolClientId`

### Backend
- [ ] Copiar estrutura de pastas (`models/`, `routers/`, `services/`, `repositories/`)
- [ ] `config.py` com variáveis de ambiente do projeto
- [ ] `dependencies.py` com `get_current_user_id`
- [ ] `dynamo_repo.py` com singleton + `update_item_if_exists`
- [ ] `main.py` com todos os routers registrados
- [ ] `requirements.txt` com FastAPI, mangum, boto3, pydantic-settings, python-jose
- [ ] Nunca usar `get_item` antes de `update_item` — usar escrita condicional
- [ ] Usar `return_values=True` só quando o dado retornado é usado
- [ ] Indicador/métrica lê **agregado pré-computado** (§5.5), nunca `Scan`/soma de N itens na leitura
- [ ] Agregado mantido na escrita: `ADD` transacional (idempotente) **ou** Lambda via Streams (§5.5)
- [ ] Leitura **consistente** no hot path read-after-write; eventual só onde tolera atraso (§10.0)

### Frontend
- [ ] `vite create` com React + TypeScript
- [ ] Instalar: `react-router-dom`, `@tanstack/react-query`, `axios`, `aws-amplify`, `tailwindcss`
- [ ] Configurar `.env.local` com outputs do SAM
- [ ] `App.tsx`: Amplify.configure + QueryClientProvider + AuthProvider + Routes
- [ ] `api/client.ts`: instância Axios com cache de token em memória (não `fetchAuthSession` por request)
- [ ] `QueryClient`: `refetchOnWindowFocus: false`, `staleTime: 60_000`
- [ ] `auth/`: AuthProvider, LoginPage, SignUpPage, ProtectedRoute
- [ ] `types/index.ts`: interfaces para todas as entidades

### Regras de desenvolvimento
- [ ] Valores monetários: `Decimal` no backend, `string` no frontend
- [ ] Todo item DynamoDB: PK = `USER#{user_id}`
- [ ] user_id sempre extraído do JWT (`Depends(get_current_user_id)`)
- [ ] Enums espelhados backend ↔ frontend
- [ ] Comandos AWS sempre com `--profile {profile}`
- [ ] Backend alterado → oferecer deploy
- [ ] Invalidação CloudFront: apenas `/index.html`, nunca `/*` sem necessidade
- [ ] Ordem de prioridade respeitada: correção/escala antes de custo (§10.0) — otimização nunca degrada as duas primeiras

---

## 12. Separação de Custos — Múltiplos Apps na Mesma Conta AWS

> Cenário: vários apps (`gerenciador-financeiro`, `personal-trainer`, …) convivem na
> **mesma conta AWS** mas precisam de **rastreamento de custo 100% isolado** —
> saber exatamente quanto cada app consumiu de Lambda, DynamoDB, API Gateway, Cognito,
> S3 e CloudFront, individualmente.

A separação **não** se faz por conta AWS nem por stack isolada — se faz por **tags de
alocação de custo** + **AWS AppRegistry (myApplications)**. Cada recurso carrega a tag
`Project`, e o Cost Explorer/Billing filtra por ela.

### 12.1 Os três pilares

| Pilar | O que faz | Onde |
|---|---|---|
| **Tag `Project` em todo recurso** | Atribui cada centavo a um app | `template.yaml` (Globals + por recurso) |
| **Cost Allocation Tag ativada** | Habilita a tag `Project` no Cost Explorer | Console Billing (passo manual, 1x) |
| **AppRegistry Application** | Dashboard de custo por app em *myApplications* | `template.yaml` |

### 12.2 Convenção de tags (obrigatória em todos os recursos)

```yaml
Tags:
  Project: personal-trainer     # ← chave de separação de custo. ÚNICA por app.
  Owner: vinicius
  Stage: !Ref Stage             # dev | prod
  ManagedBy: SAM
```

- `Project` deve ser **único e estável** por app — é o eixo de filtragem no Cost Explorer.
- Stack name, table name, bucket name e UserPool name também devem usar o prefixo do app
  (`personal-trainer-*`) para não colidir com outros apps na mesma conta.

### 12.3 Aplicar tags no `template.yaml`

**Lambda** — via `Globals` (propaga para todas as funções):
```yaml
Globals:
  Function:
    Tags:
      Project: personal-trainer
      Owner: vinicius
      ManagedBy: SAM
```

**DynamoDB / S3 / CloudFront** — `Tags` é lista de `{Key, Value}`:
```yaml
  MainTable:
    Type: AWS::DynamoDB::Table
    Properties:
      Tags:
        - { Key: Project, Value: personal-trainer }
        - { Key: Owner, Value: vinicius }
        - { Key: Stage, Value: !Ref Stage }
        - { Key: ManagedBy, Value: SAM }
```

**Cognito** — usa `UserPoolTags` (mapa, não lista):
```yaml
  UserPool:
    Type: AWS::Cognito::UserPool
    Properties:
      UserPoolTags:
        Project: personal-trainer
        Owner: vinicius
        Stage: !Ref Stage
        ManagedBy: SAM
```

> Dica: o SAM CLI também aceita `tags` no `samconfig.toml`/`sam deploy --tags`, que aplica
> tags **a nível de stack** (propagadas a recursos que suportam tag via CloudFormation).
> Mantemos as tags explícitas no template porque alguns recursos (Cognito, CloudFront)
> exigem o atributo próprio e não herdam tags de stack de forma consistente.

### 12.4 AppRegistry — dashboard de custo por app (myApplications)

```yaml
  TrainerApp:
    Type: AWS::ServiceCatalogAppRegistry::Application
    Properties:
      Name: !Sub personal-trainer-${Stage}
      Description: Personal Trainer — portal web serverless
      Tags:
        Project: personal-trainer
        Owner: vinicius
        Stage: !Ref Stage
        ManagedBy: SAM

  AppStackAssociation:
    Type: AWS::ServiceCatalogAppRegistry::ResourceAssociation
    Properties:
      Application: !GetAtt TrainerApp.Id
      Resource: !Ref AWS::StackId
      ResourceType: CFN_STACK
```

Isso registra a stack inteira em **myApplications**, que expõe um custo consolidado por
aplicação no console (Billing → myApplications), sem precisar montar filtro manual.

### 12.5 Passo manual obrigatório (1x por conta) — ativar a Cost Allocation Tag

Tags só aparecem no Cost Explorer **depois de ativadas** no Billing. Faça uma vez:

```
Console AWS → Billing and Cost Management → Cost allocation tags
  → User-defined cost allocation tags
  → marcar "Project" (e "Stage" se quiser quebrar dev/prod)
  → Activate
```

- A ativação leva **até 24h** para os dados começarem a aparecer.
- Custos **só** passam a ser atribuídos **a partir do momento da ativação** (não é retroativo)
  — ative assim que o primeiro app subir.
- Como a conta é compartilhada com `gerenciador-financeiro`, a tag `Project` já pode estar
  ativada. Se já estiver, nada a fazer — o novo valor `personal-trainer` aparece sozinho.

### 12.6 Conferir o custo por app

**Cost Explorer (UI):** filtrar/agrupar por tag `Project`.

**CLI — custo do mês por app (group by tag Project):**
```bash
aws ce get-cost-and-usage \
  --time-period Start=2026-06-01,End=2026-07-01 \
  --granularity MONTHLY \
  --metrics "UnblendedCost" \
  --group-by Type=TAG,Key=Project \
  --profile pessoal-hotmail
```

**CLI — quebra por serviço dentro de um app (Lambda vs DynamoDB vs …):**
```bash
aws ce get-cost-and-usage \
  --time-period Start=2026-06-01,End=2026-07-01 \
  --granularity MONTHLY \
  --metrics "UnblendedCost" \
  --filter '{"Tags":{"Key":"Project","Values":["personal-trainer"]}}' \
  --group-by Type=DIMENSION,Key=SERVICE \
  --profile pessoal-hotmail
```

### 12.7 Checklist de separação de custos — novo app

- [ ] Definir `Project` único (`personal-trainer`) e usá-lo em **todos** os recursos
- [ ] Prefixar stack/table/bucket/UserPool com o nome do app (evita colisão na conta)
- [ ] `Globals.Function.Tags` com `Project`
- [ ] `Tags` (lista) em DynamoDB, S3, CloudFront
- [ ] `UserPoolTags` (mapa) no Cognito
- [ ] `AWS::ServiceCatalogAppRegistry::Application` + `ResourceAssociation`
- [ ] Ativar a tag `Project` em Billing → Cost allocation tags (1x, até 24h p/ propagar)
- [ ] Validar com `aws ce get-cost-and-usage` agrupando por `Project`
