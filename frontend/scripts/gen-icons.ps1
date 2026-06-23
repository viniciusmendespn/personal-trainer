Add-Type -AssemblyName System.Drawing

$pub = "$PSScriptRoot\..\public"

function Resize-Image {
  param($srcPath, $dstPath, $w, $h)
  $src = [System.Drawing.Image]::FromFile((Resolve-Path $srcPath).Path)
  $dst = New-Object System.Drawing.Bitmap($w, $h)
  $g = [System.Drawing.Graphics]::FromImage($dst)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.DrawImage($src, 0, 0, $w, $h)
  $dst.Save($dstPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $src.Dispose(); $dst.Dispose()
  Write-Host "  -> $dstPath ($w x $h)"
}

function Resize-ImageLetterbox {
  param($srcPath, $dstPath, $w, $h, $bgColorHex)
  $src = [System.Drawing.Image]::FromFile((Resolve-Path $srcPath).Path)
  $dst = New-Object System.Drawing.Bitmap($w, $h)
  $g = [System.Drawing.Graphics]::FromImage($dst)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  # fill background
  $bgColor = [System.Drawing.ColorTranslator]::FromHtml($bgColorHex)
  $brush = New-Object System.Drawing.SolidBrush($bgColor)
  $g.FillRectangle($brush, 0, 0, $w, $h)
  # compute letterbox rect
  $srcRatio = $src.Width / $src.Height
  $dstRatio = $w / $h
  if ($srcRatio -gt $dstRatio) {
    $drawW = $w; $drawH = [int]($w / $srcRatio)
  } else {
    $drawH = $h; $drawW = [int]($h * $srcRatio)
  }
  $x = ($w - $drawW) / 2
  $y = ($h - $drawH) / 2
  $g.DrawImage($src, [int]$x, [int]$y, $drawW, $drawH)
  $dst.Save($dstPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $brush.Dispose(); $g.Dispose(); $src.Dispose(); $dst.Dispose()
  Write-Host "  -> $dstPath ($w x $h, letterbox)"
}

$logo     = "$pub\novo-logo.png"
$ogSrc    = "$pub\nova-og-image.png"

Write-Host "Gerando icones de app a partir de novo-logo.png..."
Resize-Image $logo "$pub\coach-icon.png"        64  64
Resize-Image $logo "$pub\icon-192.png"          192 192
Resize-Image $logo "$pub\icon-512.png"          512 512
Resize-Image $logo "$pub\icon-512-maskable.png" 512 512
Resize-Image $logo "$pub\apple-touch-icon.png"  180 180

Write-Host "Gerando og-image a partir de nova-og-image.png..."
Resize-ImageLetterbox $ogSrc "$pub\og-image.png" 1200 630 "#0a0e1a"

Write-Host "Concluido!"
