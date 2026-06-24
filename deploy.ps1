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
$CfId       = "E3JZ6U88Q0GYGF"   # CloudFrontDistributionId (portal — coachpilot.com.br)
$AlunoCfId  = "E2IHNZ34C3PI8V"   # AlunoCloudFrontDistributionId (aluno — app.coachpilot.com.br)

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
    $AdminSecret      = Get-EnvLocal "ADMIN_SECRET"
    $VapidPrivate     = Get-EnvLocal "VAPID_PRIVATE_KEY"
    $MlAccessToken    = Get-EnvLocal "ML_ACCESS_TOKEN"
    $PromoCodeSecret  = Get-EnvLocal "PROMO_CODE_SECRET"
    $ExtraOverrides = ""
    if ($AdminSecret)     { $ExtraOverrides += " AdminSecret=$AdminSecret" }
    if ($VapidPrivate)    { $ExtraOverrides += " VapidPrivateKey=$VapidPrivate" }
    if ($MlAccessToken)   { $ExtraOverrides += " MlAccessToken=$MlAccessToken" }
    if ($PromoCodeSecret) { $ExtraOverrides += " PromoCodeSecret=$PromoCodeSecret" }

    Set-Location backend
    sam build
    if ($LASTEXITCODE -ne 0) { Write-Host "Build falhou." -ForegroundColor Red; Set-Location ..; exit 1 }

    if ($ExtraOverrides) {
        sam deploy --profile $Profile --parameter-overrides "Stage=prod DeployFrontendInfra=true FrontendUrl=https://coachpilot.com.br AlunoFrontendUrl=https://app.coachpilot.com.br$ExtraOverrides"
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

    # Gera aluno.html a partir de index.html com manifest e meta tags do app do aluno
    $distDir = [System.IO.Path]::GetFullPath("dist")
    $html = Get-Content -Path "$distDir\index.html" -Raw -Encoding UTF8
    $html = $html -replace 'href="/manifest\.webmanifest"', 'href="/manifest-aluno.webmanifest"'
    $html = $html -replace '(theme-color" content=")#000613(")', '${1}#16a34a${2}'
    $html = $html -replace '(apple-mobile-web-app-title" content=")CoachPilot(")', '${1}Treinos${2}'
    $alunoPath = "$distDir\aluno.html"
    [System.IO.File]::WriteAllText($alunoPath, $html, [System.Text.UTF8Encoding]::new($false))
    $alunoSize = (Get-Item $alunoPath).Length
    $indexSize = (Get-Item "$distDir\index.html").Length
    if ($alunoSize -le $indexSize) { Write-Host "AVISO: aluno.html nao parece ter sido modificado (mesmo tamanho que index.html)" -ForegroundColor Yellow }
    Write-Host "aluno.html gerado ($alunoSize bytes)." -ForegroundColor Cyan

    # index.html e aluno.html sem cache (ARCHITECTURE §10.2)
    aws s3 cp dist/index.html "s3://$Bucket/index.html" `
        --cache-control "no-cache, no-store, must-revalidate" `
        --content-type "text/html; charset=utf-8" `
        --region $Region --profile $Profile
    aws s3 cp dist/aluno.html "s3://$Bucket/aluno.html" `
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
    # Bundle com hash no nome (dist/assets/*): cache de 1 ano, nome muda a cada build
    aws s3 sync dist/assets/ "s3://$Bucket/assets/" --delete `
        --cache-control "public, max-age=31536000, immutable" `
        --region $Region --profile $Profile
    # Demais arquivos públicos sem hash (ícones, logos, imagens, robots.txt etc.):
    # cache curto, senão troca de logo/favicon fica presa em cache por 1 ano (browser + CDN)
    aws s3 sync dist/ "s3://$Bucket/" --delete `
        --exclude "index.html" --exclude "aluno.html" --exclude "*.webmanifest" `
        --exclude "sw.js" --exclude "workbox-*.js" --exclude "registerSW.js" `
        --exclude "assets/*" `
        --cache-control "public, max-age=3600" `
        --region $Region --profile $Profile

    # "/*" garante que troca de ícones/logos (cache curto, mas já pode ter sido cacheado
    # como imutável em deploys antigos) e qualquer outro arquivo fiquem frescos na CDN.
    aws cloudfront create-invalidation --distribution-id $CfId `
        --paths "/*" `
        --region $Region --profile $Profile | Out-Null
    if ($AlunoCfId) {
        aws cloudfront create-invalidation --distribution-id $AlunoCfId `
            --paths "/*" `
            --region $Region --profile $Profile | Out-Null
    } else {
        Write-Host "AlunoCfId vazio — preencher deploy.ps1 com AlunoCloudFrontDistributionId do stack." -ForegroundColor Yellow
    }
    Set-Location ..
    Write-Host "Frontend deployed!" -ForegroundColor Green
}

switch ($Target) {
    "backend"  { Deploy-Backend }
    "frontend" { Deploy-Frontend }
    "all"      { Deploy-Backend; Deploy-Frontend }
    default    { Write-Host "Uso: .\deploy.ps1 [backend|frontend|all]" -ForegroundColor Yellow }
}
