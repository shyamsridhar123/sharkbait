# Sharkbait Install Script for Windows PowerShell
# Usage: iwr -useb https://raw.githubusercontent.com/shyamsridhar123/sharkbait/main/install.ps1 | iex

$ErrorActionPreference = "Stop"

$Repo = "shyamsridhar123/sharkbait"
$InstallDir = if ($env:SHARKBAIT_INSTALL_DIR) { $env:SHARKBAIT_INSTALL_DIR } else { "$HOME\.sharkbait\bin" }

function Get-LatestVersion {
    try {
        $response = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest"
        return $response.tag_name
    } catch {
        return "v1.0.0"
    }
}

function Main {
    Write-Host "🦈 Installing Sharkbait..." -ForegroundColor Cyan
    Write-Host ""
    
    $Platform = "windows-x64"
    Write-Host "Platform: $Platform"
    
    $Version = Get-LatestVersion
    Write-Host "Version: $Version"
    
    # Create install directory
    if (-not (Test-Path $InstallDir)) {
        New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    }
    
    $BinaryName = "sharkbait-$Platform.exe"
    $DownloadUrl = "https://github.com/$Repo/releases/download/$Version/$BinaryName"
    $DestPath = Join-Path $InstallDir "sharkbait.exe"
    
    Write-Host "Downloading from: $DownloadUrl"
    
    # Download binary
    Invoke-WebRequest -Uri $DownloadUrl -OutFile $DestPath
    
    Write-Host ""
    Write-Host "✓ Installed to: $DestPath" -ForegroundColor Green
    Write-Host ""
    
    # Check if in PATH
    $currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
    if ($currentPath -notlike "*$InstallDir*") {
        Write-Host "To add to PATH, run:" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "  `$env:PATH += `";$InstallDir`""
        Write-Host "  [Environment]::SetEnvironmentVariable(`"Path`", `$env:PATH + `";$InstallDir`", `"User`")"
        Write-Host ""
    }
    
    Write-Host "🦈 Sharkbait installed successfully!" -ForegroundColor Cyan
    Write-Host "Run 'sharkbait' to get started."
}

Main
