# Shows what's actually live on Cloud Run for both environments, and the
# matching git commit (the image tag on every deploy here IS the commit SHA
# that was pushed, since both services build/deploy automatically via Cloud
# Build triggers on push to `staging`/`master` — see README.md).
param(
  [string]$ProjectId = "durable-woods-465907-n1",
  [string]$Region = "asia-southeast1"
)

$services = @(
  @{ Name = "sbic-food-consignment-staging"; Branch = "staging" },
  @{ Name = "sbic-food-consignment"; Branch = "master" }
)

git fetch origin --quiet

foreach ($svc in $services) {
  Write-Host ""
  Write-Host "=== $($svc.Name) (tracks '$($svc.Branch)') ===" -ForegroundColor Cyan

  $json = gcloud run services describe $svc.Name `
    --project $ProjectId --region $Region --format=json 2>$null | ConvertFrom-Json

  if (-not $json) {
    Write-Host "  Could not read this service (check gcloud auth/project access)." -ForegroundColor Yellow
    continue
  }

  $image = $json.spec.template.spec.containers[0].image
  $sha = ($image -split ":")[-1]
  $deployedAt = $json.status.conditions[0].lastTransitionTime
  $revision = $json.status.latestReadyRevisionName

  Write-Host "  Revision:    $revision"
  Write-Host "  Deployed at: $deployedAt"
  Write-Host "  Image SHA:   $sha"

  $commitLine = git log $sha -1 --format="%h  %ci  %s" 2>$null
  if ($commitLine) {
    Write-Host "  Commit:      $commitLine"
  } else {
    Write-Host "  Commit:      (not found locally — run 'git fetch' or this SHA predates your clone)" -ForegroundColor Yellow
  }

  $branchHead = git rev-parse "origin/$($svc.Branch)" 2>$null
  if ($branchHead -and $branchHead -ne $sha) {
    $behindCount = git rev-list --count "$sha..origin/$($svc.Branch)" 2>$null
    Write-Host "  Status:      BEHIND origin/$($svc.Branch) by $behindCount commit(s) — push/merge to deploy them" -ForegroundColor Yellow
  } elseif ($branchHead) {
    Write-Host "  Status:      up to date with origin/$($svc.Branch)" -ForegroundColor Green
  }
}
Write-Host ""
