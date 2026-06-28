#!/usr/bin/env python3
"""Gerador de pacote de treino (.cpkg).

Gera um arquivo .cpkg assinado com HMAC-SHA256 para teste e distribuição.

Tipos:
  - Licenciado (padrão): contém token de uso único por personal
  - Livre (--free): sem token, mas ainda assinado — pode ser compartilhado livremente

Uso:
  # Pacote licenciado (uso único por personal):
  python scripts/gerar_pacote_teste.py --secret <PACOTE_SECRET>

  # Pacote livre (sem restrição de uso):
  python scripts/gerar_pacote_teste.py --secret <PACOTE_SECRET> --free

  # Com opções extras:
  python scripts/gerar_pacote_teste.py --secret <PACOTE_SECRET> --max-usos 5 --seed-token --output meu-pacote.cpkg

Flags:
  --secret     Obrigatório. PACOTE_SECRET configurado no backend (HMAC-SHA256).
  --free       Gera pacote livre (sem token).
  --max-usos   Quantas vezes o token pode ser usado (padrão: 1).
  --output     Arquivo de saída (padrão: pacote-teste.cpkg).
  --seed-token Imprime o JSON do item DynamoDB para inserção manual do token.

Para "renovar" o token de teste: rode o script novamente — um novo UUID é gerado
a cada execução, criando um arquivo completamente novo e válido.
"""
import argparse
import hashlib
import hmac
import json
import uuid


# ── Conteúdo do pacote de teste ───────────────────────────────────────────────

EXERCICIOS = [
    {
        "ref": "ex_supino_reto",
        "nome": "Supino Reto",
        "grupo": "Peito",
        "video_url": None,
        "descricao": "Exercício composto para desenvolvimento do peitoral maior.",
        "recomendacoes": "Mantenha as escápulas retraídas e o arco lombar neutro.",
        "tipo_exercicio": "FORCA",
    },
    {
        "ref": "ex_rosca_direta",
        "nome": "Rosca Direta",
        "grupo": "Bíceps",
        "video_url": None,
        "descricao": "Exercício isolador para flexão do cotovelo.",
        "recomendacoes": "Evite balançar o tronco. Controle a descida.",
        "tipo_exercicio": "FORCA",
    },
    {
        "ref": "ex_agachamento",
        "nome": "Agachamento Livre",
        "grupo": "Pernas",
        "video_url": None,
        "descricao": "Exercício composto fundamental para membros inferiores.",
        "recomendacoes": "Joelhos na direção dos dedos dos pés. Profundidade mínima: coxas paralelas.",
        "tipo_exercicio": "FORCA",
    },
    {
        "ref": "ex_remada_curvada",
        "nome": "Remada Curvada",
        "grupo": "Costas",
        "video_url": None,
        "descricao": "Exercício composto para desenvolvimento das costas.",
        "recomendacoes": "Tronco a 45°. Puxe para o umbigo, não para o peito.",
        "tipo_exercicio": "FORCA",
    },
    {
        "ref": "ex_desenvolvimento",
        "nome": "Desenvolvimento com Halteres",
        "grupo": "Ombro",
        "video_url": None,
        "descricao": "Exercício para desenvolvimento do deltóide anterior e médio.",
        "recomendacoes": "Cotovelos levemente à frente do plano frontal. Não bloqueie os cotovelos no topo.",
        "tipo_exercicio": "FORCA",
    },
]

TEMPLATES = [
    {
        "ref": "tmpl_a",
        "nome": "Treino A — Peito e Bíceps",
        "foco": "Peito e Bíceps",
        "exercicios": [
            {
                "ex_ref": "ex_supino_reto",
                "ordem": 0,
                "series_prescritas": [{"series": 4, "reps": "8-12", "carga": None}],
                "intervalo_s": 90,
            },
            {
                "ex_ref": "ex_rosca_direta",
                "ordem": 1,
                "series_prescritas": [{"series": 3, "reps": "10-15", "carga": None}],
                "intervalo_s": 60,
            },
        ],
    },
    {
        "ref": "tmpl_b",
        "nome": "Treino B — Costas e Ombros",
        "foco": "Costas e Ombros",
        "exercicios": [
            {
                "ex_ref": "ex_remada_curvada",
                "ordem": 0,
                "series_prescritas": [{"series": 4, "reps": "8-10", "carga": None}],
                "intervalo_s": 90,
            },
            {
                "ex_ref": "ex_desenvolvimento",
                "ordem": 1,
                "series_prescritas": [{"series": 3, "reps": "10-12", "carga": None}],
                "intervalo_s": 75,
            },
        ],
    },
    {
        "ref": "tmpl_c",
        "nome": "Treino C — Pernas",
        "foco": "Pernas",
        "exercicios": [
            {
                "ex_ref": "ex_agachamento",
                "ordem": 0,
                "series_prescritas": [{"series": 4, "reps": "10-15", "carga": None}],
                "intervalo_s": 120,
            },
        ],
    },
]

ROTINAS = [
    {
        "ref": "rot_abc",
        "nome": "Rotina ABC — Hipertrofia",
        "descricao": "Split ABC clássico para hipertrofia muscular intermediária. Treinos A, B e C alternados.",
        "treinos": ["tmpl_a", "tmpl_b", "tmpl_c"],
    },
]


# ── Geração e assinatura ──────────────────────────────────────────────────────

def assinar(payload: dict, secret: str) -> str:
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hmac.new(
        secret.encode("utf-8"),
        canonical.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def gerar(secret: str, free: bool = False) -> tuple[dict, str | None, str | None]:
    """Retorna (pacote_dict, token, token_uuid)."""
    pacote_id = str(uuid.uuid4())
    token = None
    token_uuid = None

    pacote: dict = {
        "version": "1",
        "pacote": {
            "id": pacote_id,
            "nome": "Pacote ABC — Hipertrofia Intermediária (Teste)",
            "descricao": "Pacote de teste com 5 exercícios, 3 templates e 1 rotina ABC para hipertrofia.",
            "autor": "CoachPilot",
            "versao": "1.0",
        },
        "exercicios": EXERCICIOS,
        "templates": TEMPLATES,
        "rotinas": ROTINAS,
    }

    if not free:
        token_uuid = str(uuid.uuid4())
        token = f"tok_{token_uuid}"
        pacote["token"] = token

    pacote["assinatura"] = assinar(pacote, secret)
    return pacote, token, token_uuid


def main() -> None:
    parser = argparse.ArgumentParser(description="Gerador de pacote .cpkg de teste")
    parser.add_argument("--secret", required=True, help="PACOTE_SECRET configurado no backend")
    parser.add_argument("--free", action="store_true", help="Gera pacote LIVRE (sem token)")
    parser.add_argument("--max-usos", type=int, default=1, help="Máximo de usos do token (padrão: 1)")
    parser.add_argument("--output", default="pacote-teste.cpkg", help="Arquivo de saída (padrão: pacote-teste.cpkg)")
    parser.add_argument("--seed-token", action="store_true", help="Imprime JSON do item DynamoDB para seed manual")
    args = parser.parse_args()

    pacote, token, token_uuid = gerar(args.secret, free=args.free)

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(pacote, f, ensure_ascii=False, indent=2)

    tipo = "LIVRE" if args.free else "LICENCIADO"
    print(f"Arquivo gerado: {args.output}")
    print(f"Tipo: {tipo}")
    print(f"Pacote ID: {pacote['pacote']['id']}")

    if not args.free:
        print(f"Token: {token}")
        print()
        print("PRÓXIMO PASSO: insira o token no DynamoDB antes de importar o arquivo.")
        print("  Use scripts/seed_token.py ou insira manualmente via Console/CLI.")

        if args.seed_token:
            item = {
                "PK": f"PKTOKEN#{token_uuid}",
                "SK": "META",
                "token": token,
                "pacote_id": pacote["pacote"]["id"],
                "max_usos": args.max_usos,
                "usos_count": 0,
                "usado_por": [],
                "criado_em": "2026-01-01T00:00:00+00:00",
            }
            print()
            print("--- Item DynamoDB (seed do token) ---")
            print(json.dumps(item, indent=2))
            print()
            print("Comando AWS CLI para inserir:")
            print(f'python scripts/seed_token.py --table personal-trainer-prod --item \'{json.dumps(item)}\'')
    else:
        print()
        print("Pacote LIVRE — pode ser compartilhado sem restrições.")
        print("Nenhum seed de token necessário.")


if __name__ == "__main__":
    main()
