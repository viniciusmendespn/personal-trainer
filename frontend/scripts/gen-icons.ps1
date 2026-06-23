Add-Type -AssemblyName System.Drawing

$pub = "$PSScriptRoot\..\public"

# Ícone sobre fundo colorido com padding (ex: para app icons e maskable)
function Resize-IconOnBg {
  param($srcPath, $dstPath, $w, $h, $bgColorHex, [float]$paddingFraction = 0.0)
  $src = [System.Drawing.Image]::FromFile((Resolve-Path $srcPath).Path)
  $dst = New-Object System.Drawing.Bitmap($w, $h)
  $g = [System.Drawing.Graphics]::FromImage($dst)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $bgColor = [System.Drawing.ColorTranslator]::FromHtml($bgColorHex)
  $brush = New-Object System.Drawing.SolidBrush($bgColor)
  $g.FillRectangle($brush, 0, 0, $w, $h)
  $pad = [int]($w * $paddingFraction)
  $drawW = $w - $pad * 2; $drawH = $h - $pad * 2
  # keep aspect ratio of source within drawW x drawH
  $srcRatio = $src.Width / $src.Height
  if ($srcRatio -gt 1) { $drawH = [int]($drawW / $srcRatio) }
  else                 { $drawW = [int]($drawH * $srcRatio) }
  $x = ($w - $drawW) / 2; $y = ($h - $drawH) / 2
  $g.DrawImage($src, [int]$x, [int]$y, $drawW, $drawH)
  $dst.Save($dstPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $brush.Dispose(); $g.Dispose(); $src.Dispose(); $dst.Dispose()
  Write-Host "  -> $([System.IO.Path]::GetFileName($dstPath)) ($w x $h)"
}

function Resize-ImageLetterbox {
  param($srcPath, $dstPath, $w, $h, $bgColorHex)
  $src = [System.Drawing.Image]::FromFile((Resolve-Path $srcPath).Path)
  $dst = New-Object System.Drawing.Bitmap($w, $h)
  $g = [System.Drawing.Graphics]::FromImage($dst)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $bgColor = [System.Drawing.ColorTranslator]::FromHtml($bgColorHex)
  $brush = New-Object System.Drawing.SolidBrush($bgColor)
  $g.FillRectangle($brush, 0, 0, $w, $h)
  $srcRatio = $src.Width / $src.Height
  $dstRatio = $w / $h
  if ($srcRatio -gt $dstRatio) {
    $drawW = $w; $drawH = [int]($w / $srcRatio)
  } else {
    $drawH = $h; $drawW = [int]($h * $srcRatio)
  }
  $x = ($w - $drawW) / 2; $y = ($h - $drawH) / 2
  $g.DrawImage($src, [int]$x, [int]$y, $drawW, $drawH)
  $dst.Save($dstPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $brush.Dispose(); $g.Dispose(); $src.Dispose(); $dst.Dispose()
  Write-Host "  -> $([System.IO.Path]::GetFileName($dstPath)) ($w x $h, letterbox)"
}

$icon = "$pub\novo-icon.png"  # ícone com fundo e cantos arredondados — resize direto

Write-Host "Gerando icones a partir de novo-icon.png..."
Resize-Image $icon "$pub\coach-icon.png"        64  64
Resize-Image $icon "$pub\icon-192.png"          192 192
Resize-Image $icon "$pub\icon-512.png"          512 512
Resize-Image $icon "$pub\icon-512-maskable.png" 512 512
Resize-Image $icon "$pub\apple-touch-icon.png"  180 180

Write-Host "Concluido!"
