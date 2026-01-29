#!/usr/bin/env pwsh
# Sharkbait launcher script
$env:DOTENV_CONFIG_PATH = Join-Path $PSScriptRoot ".env"

# Load .env
$envFile = Join-Path $PSScriptRoot ".env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^([^#][^=]+)=(.*)$') {
            [System.Environment]::SetEnvironmentVariable($matches[1], $matches[2])
        }
    }
}

# Run with bun
& bun run (Join-Path $PSScriptRoot "src/cli.ts") @args
