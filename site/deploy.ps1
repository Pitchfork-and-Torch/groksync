# Deploy public GrokSync landing (repo CTA only). Not a private board.
# Uses CLOUDFLARE_API_TOKEN from the environment. Does not name a personal account.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Project = if ($env:GROKSYNC_PAGES_PROJECT) { $env:GROKSYNC_PAGES_PROJECT } else { "groksync-jonbailey" }

if (-not (Test-Path (Join-Path $Root "index.html"))) { throw "missing index.html" }
if (-not (Test-Path (Join-Path $Root "og.jpg"))) { throw "missing og.jpg" }

Push-Location $Root
try {
  npx --yes wrangler@4 pages deploy $Root --project-name=$Project --commit-dirty=true
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
  Pop-Location
}

Write-Host "Deployed Pages project $Project"
