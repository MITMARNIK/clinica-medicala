<#
.SYNOPSIS
  Script de pornire rapida pentru ClinicaWeb (MySQL + Auto-Init DB + Back-end + Front-end).
.EXAMPLE
  .\start.ps1
  .\start.ps1 -InitDb
  .\start.ps1 -SkipDocker
#>
param(
  [switch]$InitDb,
  [switch]$SkipDocker
)

$ErrorActionPreference = "Stop"
$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $RootDir

# Reincarca PATH-ul sistemului (util daca Node.js a fost instalat recent)
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "   ClinicaWeb - Pornire Rapida Aplicatie Locala   " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verificare Node.js & npm.cmd
if (-not (Get-Command node -ErrorAction SilentlyContinue) -or -not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
  Write-Host "[EROARE] Node.js / npm nu este instalat sau nu se afla in PATH." -ForegroundColor Red
  Write-Host "Instalati Node.js 20 LTS de la https://nodejs.org/ sau rulati:" -ForegroundColor Yellow
  Write-Host "  winget install OpenJS.NodeJS.LTS" -ForegroundColor White
  exit 1
}

Write-Host "[OK] Node.js: $(node -v) | npm: $(& npm.cmd -v)" -ForegroundColor Green

# 2. Creare .env din .env.example daca lipseste
$EnvFile = Join-Path $RootDir ".env"
$EnvExample = Join-Path $RootDir ".env.example"
if (-not (Test-Path $EnvFile) -and (Test-Path $EnvExample)) {
  Copy-Item $EnvExample $EnvFile
  Write-Host "[INFO] Fisierul .env a fost creat automat din .env.example." -ForegroundColor Yellow
}

# 3. Verificare / Pornire MySQL pe portul 3306 (WAMP / serviciu Windows / Docker)
function Test-Port3306 {
  try {
    $tcp = New-Object System.Net.Sockets.TcpClient
    $iar = $tcp.BeginConnect("127.0.0.1", 3306, $null, $null)
    $ok = $iar.AsyncWaitHandle.WaitOne(800, $false)
    if ($ok -and $tcp.Connected) {
      $tcp.EndConnect($iar)
      $tcp.Close()
      return $true
    }
    $tcp.Close()
    return $false
  } catch {
    return $false
  }
}

if (-not (Test-Port3306)) {
  $mysqlService = Get-Service -Name "wampmysqld64", "MySQL80", "MySQL", "MariaDB" -ErrorAction SilentlyContinue | Select-Object -First 1

  if ($mysqlService) {
    Write-Host "[INFO] Serviciul MySQL '$($mysqlService.Name)' este oprit. Se porneste..." -ForegroundColor Cyan
    try {
      Start-Service -Name $mysqlService.Name -ErrorAction Stop
    } catch {
      Write-Host "[INFO] Se solicita permisiune Administrator (UAC) pentru a porni '$($mysqlService.Name)'..." -ForegroundColor Yellow
      Start-Process powershell -Verb RunAs -Wait -ArgumentList "-Command", "Start-Service -Name '$($mysqlService.Name)'"
    }
    Start-Sleep -Seconds 3
  } elseif (-not $SkipDocker -and (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "[INFO] Se porneste baza de date MySQL cu Docker Compose..." -ForegroundColor Cyan
    try {
      docker compose up -d
      Start-Sleep -Seconds 5
    } catch {
      Write-Host "[ATENTIE] Docker nu ruleaza." -ForegroundColor Yellow
    }
  }
}

if (Test-Port3306) {
  Write-Host "[OK] Serverul MySQL ruleaza pe 127.0.0.1:3306." -ForegroundColor Green
} else {
  Write-Host "[EROARE] MySQL nu ruleaza pe portul 3306! Porniti WAMP Server / XAMPP / Docker si reincercati." -ForegroundColor Red
  exit 1
}

# 4. Instalare dependente daca lipseste node_modules
$ServerDir = Join-Path $RootDir "server"
$ClientDir = Join-Path $RootDir "client"

if (-not (Test-Path (Join-Path $ServerDir "node_modules"))) {
  Write-Host "[INFO] Se instaleaza pachetele Back-end (/server)..." -ForegroundColor Cyan
  Push-Location $ServerDir
  & npm.cmd install
  Pop-Location
}

if (-not (Test-Path (Join-Path $ClientDir "node_modules"))) {
  Write-Host "[INFO] Se instaleaza pachetele Front-end (/client)..." -ForegroundColor Cyan
  Push-Location $ClientDir
  & npm.cmd install
  Pop-Location
}

# 5. Initializare automata baza de date la prima pornire sau cand se cere -InitDb
Push-Location $ServerDir
if ($InitDb) {
  Write-Host "[INFO] Se reinitializeaza baza de date (schema.sql + seed.sql)..." -ForegroundColor Cyan
  & npm.cmd run db:init
} else {
  & node src/scripts/ensureDb.js
  if ($LASTEXITCODE -eq 2) {
    & npm.cmd run db:init
  } elseif ($LASTEXITCODE -ne 0) {
    Pop-Location
    Write-Host "[EROARE] Verificati credențialele DB_USER / DB_PASSWORD din .env!" -ForegroundColor Red
    exit 1
  }
}
Pop-Location

# 6. Pornire Back-end si Front-end in ferestre separate
Write-Host "[INFO] Se porneste serverul Back-end (http://localhost:5000)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$ServerDir'; Write-Host '=== ClinicaWeb API (Port 5000) ===' -ForegroundColor Cyan; npm.cmd run dev"

Write-Host "[INFO] Se porneste aplicatia Front-end (http://localhost:5173)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$ClientDir'; Write-Host '=== ClinicaWeb React UI (Port 5173) ===' -ForegroundColor Green; npm.cmd run dev"

Start-Sleep -Seconds 3
Write-Host ""
Write-Host "[GATA] ClinicaWeb a fost pornita cu succes!" -ForegroundColor Green
Write-Host "  Front-end : http://localhost:5173" -ForegroundColor White
Write-Host "  Back-end  : http://localhost:5000/api/health" -ForegroundColor White
Write-Host "  Parola conturi demo: Clinica2026!" -ForegroundColor Yellow
Start-Process "http://localhost:5173"
