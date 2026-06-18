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

function Deploy-Backend {
    Write-Host "`n=== Deploy Backend ===" -ForegroundColor Green
    Set-Location backend
    sam build
    if ($LASTEXITCODE -ne 0) { Write-Host "Build falhou." -ForegroundColor Red; Set-Location ..; exit 1 }
    sam deploy --profile $Profile
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
    # Demais assets (hashed): cache de 1 ano
    aws s3 sync dist/ "s3://$Bucket/" --delete --exclude "index.html" --exclude "*.webmanifest" `
        --cache-control "public, max-age=31536000, immutable" `
        --region $Region --profile $Profile

    aws cloudfront create-invalidation --distribution-id $CfId `
        --paths "/index.html" "/manifest.webmanifest" "/manifest-aluno.webmanifest" `
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
