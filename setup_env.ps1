<# 
  setup_env.ps1 — Local dev bootstrap for Watch LookUp
  - Writes a local .env (no global pollution)
  - Optionally clears conflicting MONGO_URI from the current process and User scope
  - Prints masked diagnostics

  Usage (from CMD):
    powershell -ExecutionPolicy Bypass -File setup_env.ps1

  Optional switches:
    -ClearUserVar    => deletes User-scope MONGO_URI so it can’t override .env
#>

[CmdletBinding()]
param(
  [switch]$ClearUserVar
)

function Mask-Uri($uri) {
  if (-not $uri) { return '<undefined>' }
  return ($uri -replace '//[^@]+@', '//***:***@')
}

Write-Host "Welcome to CAP AI Development Environment!"
Write-Host "Current directory: $(Get-Location)"
Write-Host "Starting environment setup for Git/GitHub, MongoDB, and Node.js..."
Write-Host ""

# --- Optional: clear conflicting env in this process and user scope ----------
Write-Host "--- Env Guard ---"
if ($env:MONGO_URI) {
  Write-Host "Found process MONGO_URI overriding .env => clearing for this session"
  $env:MONGO_URI = $null
} else {
  Write-Host "No process-level MONGO_URI set."
}

if ($ClearUserVar) {
  try {
    [Environment]::SetEnvironmentVariable('MONGO_URI', $null, 'User')
    Write-Host "Cleared User-scope MONGO_URI."
  } catch {
    Write-Warning "Failed to clear User-scope MONGO_URI: $($_.Exception.Message)"
  }
} else {
  Write-Host "User-scope MONGO_URI not modified (run with -ClearUserVar to remove)."
}
Write-Host ""

# --- Tool checks -------------------------------------------------------------
Write-Host "--- Git/GitHub Setup ---"
if (Get-Command git -ErrorAction SilentlyContinue) {
  Write-Host "✅ Git is installed."
} else {
  Write-Warning "⚠️ Git not found. Install from https://git-scm.com/"
}
Write-Host ""

Write-Host "--- MongoDB Setup ---"
if (Get-Command mongosh -ErrorAction SilentlyContinue) {
  Write-Host "✅ mongosh found."
} else {
  Write-Warning "⚠️ mongosh not found. Install MongoDB Shell."
}
Write-Host ""

Write-Host "--- Node.js Setup ---"
if (Get-Command node -ErrorAction SilentlyContinue) {
  $nodeVer = node -v
  Write-Host "✅ Node.js is installed. Version: $nodeVer"
} else {
  Write-Warning "⚠️ Node.js not found. Install from https://nodejs.org/"
}
if (Get-Command npm -ErrorAction SilentlyContinue) {
  $npmVer = npm -v
  Write-Host "✅ npm is installed. Version: $npmVer"
}
Write-Host ""

# --- Prompt for values or reuse existing .env --------------------------------
$envPath = Join-Path (Get-Location) ".env"

# Attempt to read existing values if .env exists
$existing = @{}
if (Test-Path $envPath) {
  Get-Content $envPath | ForEach-Object {
    if ($_ -match '^\s*#') { return }
    if ($_ -match '^\s*$') { return }
    if ($_ -match '^\s*([^=]+)=(.*)$') {
      $k = $matches[1].Trim()
      $v = $matches[2].Trim()
      $existing[$k] = $v
    }
  }
}

function Get-OrDefault($key, $default) {
  if ($existing.ContainsKey($key) -and $existing[$key]) { return $existing[$key] }
  return $default
}

# Defaults (edit here if needed)
$MONGO_URI          = Get-OrDefault "MONGO_URI"          "mongodb+srv://Greymarket:n5Hypr4JOfBGmjqp@patek-cluster.rchgesl.mongodb.net/patek_db?authSource=admin"
$MONGO_URI_ADMIN    = Get-OrDefault "MONGO_URI_ADMIN"    "mongodb+srv://texascouty21:2a1GEe9rYTLEvAOT@patek-cluster.rchgesl.mongodb.net/admin?retryWrites=true&w=majority&appName=patek-cluster"
$MONGO_DB           = Get-OrDefault "MONGO_DB"           "patek_db"
$MONGO_COLL         = Get-OrDefault "MONGO_COLL"         "grey_market_refs"
$MONGO_REF_COLL     = Get-OrDefault "MONGO_REF_COLL"     "references"

$CLOUD_NAME         = Get-OrDefault "CLOUDINARY_CLOUD_NAME" "dnymcygtl"
$CLOUD_KEY          = Get-OrDefault "CLOUDINARY_API_KEY"    "474189423286666"
$CLOUD_SECRET       = Get-OrDefault "CLOUDINARY_API_SECRET" "KrJLzMArYuU6tFwffZDYQydoAxg"

# --- Write .env cleanly (no quotes, no JS) -----------------------------------
@"
MONGO_URI=$MONGO_URI
MONGO_URI_ADMIN=$MONGO_URI_ADMIN
MONGO_DB=$MONGO_DB
MONGO_COLL=$MONGO_COLL
MONGO_REF_COLL=$MONGO_REF_COLL
CLOUDINARY_CLOUD_NAME=$CLOUD_NAME
CLOUDINARY_API_KEY=$CLOUD_KEY
CLOUDINARY_API_SECRET=$CLOUD_SECRET
"@ | Out-File -FilePath $envPath -Encoding ascii -Force

Write-Host "--- .env written ---"
Write-Host ("MONGO_URI:        " + (Mask-Uri $MONGO_URI))
Write-Host ("MONGO_URI_ADMIN:  " + (Mask-Uri $MONGO_URI_ADMIN))
Write-Host ("MONGO_DB:         " + $MONGO_DB)
Write-Host ("MONGO_COLL:       " + $MONGO_COLL)
Write-Host ("MONGO_REF_COLL:   " + $MONGO_REF_COLL)
Write-Host ("CLOUDINARY name:  " + $CLOUD_NAME)
Write-Host ""

Write-Host "Environment setup complete. You’re ready to start coding!"
Write-Host "Tip: run 'netlify dev' from this directory."
