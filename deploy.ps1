# Deploy GrokSync to Cloudflare Pages.
# Secrets (never commit): GROKSYNC_GATE_PASSWORD, GROKSYNC_WRITE_TOKEN
# Env: GROKSYNC_PAGES_PROJECT (default groksync), optional GROKSYNC_DOMAIN
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Project = if ($env:GROKSYNC_PAGES_PROJECT) { $env:GROKSYNC_PAGES_PROJECT } else { "groksync" }
$Dist = Join-Path $Root "dist"

if (-not (Test-Path -LiteralPath (Join-Path $Root "index.html"))) {
  throw "Missing index.html in $Root"
}

Write-Host "[GrokSync] staging dist"
if (Test-Path -LiteralPath $Dist) {
  Remove-Item -LiteralPath $Dist -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $Dist | Out-Null
foreach ($name in @("index.html", "login.html", "robots.txt", "_headers")) {
  $src = Join-Path $Root $name
  if (Test-Path -LiteralPath $src) {
    Copy-Item $src (Join-Path $Dist $name) -Force
  }
}
Copy-Item (Join-Path $Root "css") (Join-Path $Dist "css") -Recurse -Force
Copy-Item (Join-Path $Root "js") (Join-Path $Dist "js") -Recurse -Force
Copy-Item (Join-Path $Root "public") (Join-Path $Dist "public") -Recurse -Force

Push-Location $Root
try {
  npx --yes wrangler@4 pages deploy $Dist --project-name=$Project --commit-dirty=true
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
  Pop-Location
}

Write-Host "Deployed Pages project $Project"
Write-Host "Set secrets GROKSYNC_GATE_PASSWORD and GROKSYNC_WRITE_TOKEN on the project."
Write-Host "Put your KV namespace id in wrangler.toml (binding BOARD)."
