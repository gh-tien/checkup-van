# Syntax + encoding check on the staged folder. Finds the newest pub-v* folder.
$ErrorActionPreference = 'Stop'
$pub = (Get-ChildItem -Directory 'C:\Users\tienn\GIT\Checkup Van\.publish' -Filter 'pub-v*' |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
Write-Output "checking $pub"

foreach ($f in @('app.js','store.js','photos.js','sw.js')) {
  node --check (Join-Path $pub $f)
  if ($LASTEXITCODE -eq 0) { Write-Output "OK   $f" } else { Write-Output "FAIL $f" }
}

$m = [System.IO.File]::ReadAllText((Join-Path $pub 'manifest.webmanifest')) | ConvertFrom-Json
Write-Output ('manifest theme_color=' + $m.theme_color + ' name=' + $m.name)

$bad = [char]0x00E2 + [char]0x20AC   # the "a-circumflex euro" mojibake pair
foreach ($f in @('index.html','app.js','app.css','store.js','photos.js','sw.js')) {
  $t = [System.IO.File]::ReadAllText((Join-Path $pub $f))
  $repl = ([regex]::Matches($t, [string][char]0xFFFD)).Count
  $moji = ([regex]::Matches($t, [regex]::Escape($bad))).Count
  Write-Output ("$f  replacementChars=$repl  mojibakePairs=$moji")
}
