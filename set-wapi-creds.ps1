# Insere ou sobrescreve credenciais W-API no DynamoDB para um personal trainer.
# O personal só escaneia o QR Code no portal — não precisa saber o instance_id/token.
#
# Uso:
#   .\set-wapi-creds.ps1 -UserId "cognito-sub" -InstanceId "LITE-XXXX" -Token "seu-token"
#   .\set-wapi-creds.ps1 -UserId "..." -InstanceId "..." -Token "..." -Stage "dev"
#
# O UserId é o "sub" do Cognito (UUID). Para encontrá-lo:
#   aws cognito-idp list-users --user-pool-id <pool-id> --region us-east-1 --profile pessoal-hotmail
#
param(
    [Parameter(Mandatory=$true)]
    [string]$UserId,

    [Parameter(Mandatory=$true)]
    [string]$InstanceId,

    [Parameter(Mandatory=$true)]
    [string]$Token,

    [string]$Stage = "prod"
)

$TableName  = "personal-trainer-$Stage"
$Profile    = "pessoal-hotmail"
$Region     = "us-east-1"
$NowUtc     = (Get-Date).ToUniversalTime()
$Now        = $NowUtc.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
$PK         = "PT#$UserId"
$SK         = "WAPI#CONFIG"
$TokenPreview = $Token.Substring(0, [Math]::Min(8, $Token.Length)) + "..."

Write-Host ""
Write-Host "Tabela:      $TableName"
Write-Host "PK:          $PK"
Write-Host "SK:          $SK"
Write-Host "Instance ID: $InstanceId"
Write-Host "Token:       $TokenPreview"
Write-Host ""

# 1. Gravar config do personal
$ConfigItem = [ordered]@{
    PK          = [ordered]@{ S = $PK }
    SK          = [ordered]@{ S = $SK }
    instance_id = [ordered]@{ S = $InstanceId }
    token       = [ordered]@{ S = $Token }
    status      = [ordered]@{ S = "DISCONNECTED" }
    updated_at  = [ordered]@{ S = $Now }
}

$ConfigJson = $ConfigItem | ConvertTo-Json -Depth 3 -Compress
$TempConfig = [System.IO.Path]::Combine($env:TEMP, "pt-config-$([System.Guid]::NewGuid()).json")
[System.IO.File]::WriteAllText($TempConfig, $ConfigJson, [System.Text.UTF8Encoding]::new($false))

aws dynamodb put-item `
    --table-name $TableName `
    --region $Region `
    --profile $Profile `
    --item "file://$TempConfig"

$ExitCode = $LASTEXITCODE
Remove-Item $TempConfig -ErrorAction SilentlyContinue

if ($ExitCode -ne 0) {
    Write-Host "Erro ao salvar config. Verifique o perfil AWS e o nome da tabela." -ForegroundColor Red
    exit 1
}

Write-Host "[1/2] Config salva." -ForegroundColor Green

# 2. Gravar ponteiro de roteamento do webhook (instanceId -> personal_id)
$RouterItem = [ordered]@{
    PK          = [ordered]@{ S = "WAPI#$InstanceId" }
    SK          = [ordered]@{ S = "WAPI" }
    personal_id = [ordered]@{ S = $UserId }
}

$RouterJson = $RouterItem | ConvertTo-Json -Depth 3 -Compress
$TempRouter = [System.IO.Path]::Combine($env:TEMP, "pt-router-$([System.Guid]::NewGuid()).json")
[System.IO.File]::WriteAllText($TempRouter, $RouterJson, [System.Text.UTF8Encoding]::new($false))

aws dynamodb put-item `
    --table-name $TableName `
    --region $Region `
    --profile $Profile `
    --item "file://$TempRouter"

$ExitCode2 = $LASTEXITCODE
Remove-Item $TempRouter -ErrorAction SilentlyContinue

if ($ExitCode2 -ne 0) {
    Write-Host "Erro ao salvar ponteiro de roteamento." -ForegroundColor Red
    exit 1
}

Write-Host "[2/2] Ponteiro de roteamento salvo." -ForegroundColor Green
Write-Host ""
Write-Host "Pronto! Personal '$UserId' configurado na stage '$Stage'." -ForegroundColor Cyan
Write-Host "O personal pode agora escanear o QR Code em Configuracoes > WhatsApp."
