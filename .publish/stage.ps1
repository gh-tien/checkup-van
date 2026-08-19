# Stages the runtime files for a Netlify deploy. Reads the version out of sw.js,
# so there is no number to keep in sync here -- bump sw.js and re-run.
$ErrorActionPreference = 'Stop'
$repo = 'C:\Users\tienn\GIT\Checkup Van'

$swSrc = [System.IO.File]::ReadAllText((Join-Path $repo 'sw.js'))
if ($swSrc -notmatch "VERSION = '(v\d+)'") { throw 'Could not read VERSION out of sw.js' }
$ver = $Matches[1]

# sw.js VERSION and app.js BUILD are a hand-kept pair (separate files, no shared
# module). The header now SHOWS BUILD, so a mismatch means the app lies to your
# face about which build it is. Refuse to stage rather than ship that.
$appSrc = [System.IO.File]::ReadAllText((Join-Path $repo 'app.js'))
if ($appSrc -notmatch "BUILD = '(v\d+)'") { throw 'Could not read BUILD out of app.js' }
$build = $Matches[1]
if ($build -ne $ver) { throw "VERSION MISMATCH: sw.js is $ver but app.js BUILD is $build. Bump both." }
Write-Output "version check OK: sw.js=$ver app.js=$build"

$pub = Join-Path $repo ".publish\pub-$ver"

if (Test-Path $pub) { Remove-Item -Recurse -Force $pub }
New-Item -ItemType Directory -Force -Path (Join-Path $pub 'icons') | Out-Null

$root = @('index.html','app.css','app.js','photos.js','store.js','sw.js','manifest.webmanifest')
foreach ($f in $root) { Copy-Item (Join-Path $repo $f) (Join-Path $pub $f) }

$icons = @('icon-192.png','icon-512.png','icon-maskable-512.png','apple-touch-icon.png')
foreach ($f in $icons) { Copy-Item (Join-Path $repo "icons\$f") (Join-Path $pub "icons\$f") }

Write-Output "--- staged $ver ---"
Get-ChildItem -Recurse -File $pub | ForEach-Object {
  Write-Output ($_.FullName.Substring($pub.Length + 1) + '  ' + $_.Length)
}
$count = (Get-ChildItem -Recurse -File $pub).Count
Write-Output "COUNT=$count (must be 11)"

Write-Output '--- leak check (must be empty) ---'
Get-ChildItem -Recurse -File $pub |
  Where-Object { $_.Name -match 'PROGRESS|README|\.dc\.html$|support\.js$|\.ps1$' } |
  ForEach-Object { Write-Output ('LEAK: ' + $_.FullName) }

Write-Output '--- staged content ---'
$sw = [System.IO.File]::ReadAllText((Join-Path $pub 'sw.js'))
if ($sw -match "VERSION = '(v\d+)'") { Write-Output ('staged sw VERSION=' + $Matches[1]) }
$js = [System.IO.File]::ReadAllText((Join-Path $pub 'app.js'))
foreach ($sym in @('addFirstVan','claimStorage','STORAGE_DURABLE','build-tag')) {
  Write-Output ("$sym=" + ([regex]::Matches($js, [regex]::Escape($sym))).Count)
}
$css = [System.IO.File]::ReadAllText((Join-Path $pub 'app.css'))
foreach ($sel in @('.note.is-amber','.build-tag')) {
  Write-Output ("css $sel=" + ([regex]::Matches($css, [regex]::Escape($sel))).Count)
}

Write-Output ''
Write-Output 'DEPLOY WITH:'
Write-Output "netlify deploy --prod --dir `"$pub`" --site a66b1464-2703-4498-beb5-6bd2d7cba85f"
