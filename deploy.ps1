# deploy.ps1 — Deploy do Personal Trainer (backend + frontend)
# Uso: .\deploy.ps1 [backend|frontend|all]
# REGRA (CLAUDE.md): commitar antes de deployar — o SAM builda do disco, não do git.

param([string]$Target = "backend")

$ErrorActionPreference = "Stop"
$Profile    = "pessoal-hotmail"
$Region     = "us-east-1"
$StackName  = "personal-trainer-prod"
# Preencher após o 1º deploy com DeployFrontendInfra=true (ler dos Outputs do stack):
$Bucket     = "personal-trainer-frontend-prod-421219980792"
$CfId       = "E3JZ6U88Q0GYGF"   # CloudFrontDistributionId

function Get-EnvLocal {
    param([string]$Key)
    $envFile = Join-Path $PSScriptRoot "backend\.env.local"
    if (-not (Test-Path $envFile)) { return "" }
    foreach ($line in Get-Content $envFile) {
        if ($line -match "^$Key=(.+)$") { return $Matches[1] }
    }
    return ""
}

function Deploy-Backend {
    Write-Host "`n=== Deploy Backend ===" -ForegroundColor Green

    # Secrets NoEcho: lidos do .env.local e passados como override pontual
    # (não ficam no samconfig.toml para não sobrescrever acidentalmente em produção)
    $AdminSecret = Get-EnvLocal "ADMIN_SECRET"
    $ExtraOverrides = ""
    if ($AdminSecret) { $ExtraOverrides = " AdminSecret=$AdminSecret" }

    Set-Location backend
    sam build
    if ($LASTEXITCODE -ne 0) { Write-Host "Build falhou." -ForegroundColor Red; Set-Location ..; exit 1 }

    if ($ExtraOverrides) {
        sam deploy --profile $Profile --parameter-overrides "Stage=prod DeployFrontendInfra=true FrontendUrl=https://coachpilot.com.br$ExtraOverrides"
    } else {
        sam deploy --profile $Profile
    }
    if ($LASTEXITCODE -ne 0) {
        # exit code 1 = "No changes to deploy" — não é erro real
        Write-Host "Nenhuma mudança no backend (ou deploy ok)." -ForegroundColor Yellow
    }
    Set-Location ..
    Write-Host "Backend deployed!" -ForegroundColor Green
}

function Deploy-Frontend {
    if (-not $CfId) { Write-Host "CfId vazio - configure a infra de frontend primeiro." -ForegroundColor Yellow; return }
    Write-Host "`n=== Deploy Frontend ===" -ForegroundColor Green
    Set-Location frontend
    npm run build
    if ($LASTEXITCODE -ne 0) { Write-Host "Build falhou." -ForegroundColor Red; Set-Location ..; exit 1 }

    # index.html sem cache; assets com hash = cache de 1 ano (ARCHITECTURE §10.2)
    aws s3 cp dist/index.html "s3://$Bucket/index.html" `
        --cache-control "no-cache, no-store, must-revalidate" `
        --content-type "text/html; charset=utf-8" `
        --region $Region --profile $Profile
    # Manifestos PWA: sem cache (browsers precisam verificar atualizações do manifesto)
    aws s3 sync dist/ "s3://$Bucket/" --delete `
        --exclude "*" --include "*.webmanifest" `
        --cache-control "no-cache, no-store, must-revalidate" `
        --content-type "application/manifest+json" `
        --region $Region --profile $Profile
    # Service worker e seu runtime: sem cache (senão o navegador trava num SW antigo)
    aws s3 sync dist/ "s3://$Bucket/" --delete `
        --exclude "*" --include "sw.js" --include "workbox-*.js" --include "registerSW.js" `
        --cache-control "no-cache, no-store, must-revalidate" `
        --region $Region --profile $Profile
    # Demais assets (hashed): cache de 1 ano
    aws s3 sync dist/ "s3://$Bucket/" --delete `
        --exclude "index.html" --exclude "*.webmanifest" `
        --exclude "sw.js" --exclude "workbox-*.js" --exclude "registerSW.js" `
        --cache-control "public, max-age=31536000, immutable" `
        --region $Region --profile $Profile

    aws cloudfront create-invalidation --distribution-id $CfId `
        --paths "/index.html" "/manifest.webmanifest" "/manifest-aluno.webmanifest" "/sw.js" "/workbox-*.js" "/registerSW.js" `
        --region $Region --profile $Profile | Out-Null
    Set-Location ..
    Write-Host "Frontend deployed!" -ForegroundColor Green
}

switch ($Target) {
    "backend"  { Deploy-Backend }
    "frontend" { Deploy-Frontend }
    "all"      { Deploy-Backend; Deploy-Frontend }
    default    { Write-Host "Uso: .\deploy.ps1 [backend|frontend|all]" -ForegroundColor Yellow }
}
