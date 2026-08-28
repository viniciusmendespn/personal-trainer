<#
.SYNOPSIS
    Atualiza a conta de demonstração (demo@coachpilot.com.br) para a data de HOJE.

.DESCRIPTION
    Apaga os dados demo anteriores e recria tudo do zero com `seed_demo_conta.py --reset`.
    Como o seed gera todas as datas relativas ao momento da execução, rodar este script é o
    jeito oficial de "envelhecer zero" a demo: histórico de sessões, avaliações, agenda,
    financeiro, férias e os 2 treinos vencidos voltam a ficar colados na data atual.

    O que NÃO muda entre execuções: e-mail/senha do Cognito, personal_id, slug /@demo,
    nomes dos 5 alunos e o cenário (quem está pago/pendente/vencido, quem tem treino vencido).
    O que MUDA: todos os IDs (alunos, treinos, sessões) e os links do app do aluno — o script
    imprime os links novos no fim; os antigos param de funcionar.

.PARAMETER Force
    Não pede confirmação antes de apagar os dados demo atuais.

.EXAMPLE
    .\scripts\atualizar_demo.ps1
    Atualiza a demo para hoje (com confirmação).

.EXAMPLE
    .\scripts\atualizar_demo.ps1 -Force -- --semanas 16
    Sem confirmação e com 16 semanas de histórico. Tudo depois de `--` vai direto ao seed.
#>
[CmdletBinding()]
param(
    [switch]$Force,
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$SeedArgs
)

$ErrorActionPreference = 'Stop'

$backendDir = Split-Path -Parent $PSScriptRoot   # .../backend
$seed = Join-Path $PSScriptRoot 'seed_demo_conta.py'
if (-not (Test-Path $seed)) { throw "Seed não encontrado: $seed" }

if (-not $Force) {
    Write-Host ''
    Write-Host '  Isto APAGA e recria todos os dados da conta demo em personal-trainer-prod' -ForegroundColor Yellow
    Write-Host '  (conta demo@coachpilot.com.br apenas — nenhuma outra conta é tocada).' -ForegroundColor Yellow
    Write-Host '  Os links atuais do app do aluno deixam de funcionar.' -ForegroundColor Yellow
    Write-Host ''
    $r = Read-Host '  Continuar? (s/N)'
    if ($r -notmatch '^[sSyY]$') { Write-Host 'Cancelado.'; return }
}

# `--` é engolido pelo PowerShell quando aparece sozinho; filtra para não virar argumento vazio.
$extra = @($SeedArgs | Where-Object { $_ -and $_ -ne '--' })

Push-Location $backendDir
try {
    Write-Host "Atualizando a demo para $(Get-Date -Format 'yyyy-MM-dd')…" -ForegroundColor Cyan
    & python 'scripts/seed_demo_conta.py' '--reset' @extra
    if ($LASTEXITCODE -ne 0) { throw "seed_demo_conta.py falhou (exit $LASTEXITCODE)." }
}
finally {
    Pop-Location
}
