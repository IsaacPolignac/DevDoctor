<#
.SYNOPSIS
  Installs the DevDoctor command line tool on Windows (current user, no administrator rights).
.DESCRIPTION
  Downloads the latest release zip for x64 Windows, verifies its SHA-256, extracts devdoctor.exe
  into %LOCALAPPDATA%\Programs\DevDoctor and adds that folder to the user PATH.

    irm https://raw.githubusercontent.com/YOUR_GITHUB_USER/devdoctor/main/scripts/install.ps1 | iex

.PARAMETER Version   Release tag to install (default: latest).
.PARAMETER Repo      GitHub repository (owner/name).
.PARAMETER NoPath    Do not modify the user PATH.
#>
param(
  [string]$Version = $env:DEVDOCTOR_VERSION,
  [string]$Repo = $(if ($env:DEVDOCTOR_REPO) { $env:DEVDOCTOR_REPO } else { "YOUR_GITHUB_USER/devdoctor" }),
  [switch]$NoPath
)
$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$arch = if ([Environment]::Is64BitOperatingSystem) { "x86_64" } else { throw "DevDoctor needs 64-bit Windows" }
if ($env:PROCESSOR_ARCHITECTURE -eq "ARM64") { Write-Host "Windows on ARM: installing the x64 build (runs under emulation)." }
$target = "$arch-pc-windows-msvc"

if (-not $Version) {
  $latest = Invoke-RestMethod "https://api.github.com/repos/$Repo/releases/latest" -Headers @{ "User-Agent" = "devdoctor-install" }
  $Version = $latest.tag_name
}
$name = "devdoctor-$Version-$target"
$base = "https://github.com/$Repo/releases/download/$Version"
$tmp = Join-Path ([IO.Path]::GetTempPath()) "devdoctor-install-$([guid]::NewGuid().ToString('n'))"
New-Item -ItemType Directory -Path $tmp | Out-Null
try {
  Write-Host "Downloading DevDoctor $Version for $target ..."
  Invoke-WebRequest "$base/$name.zip" -OutFile "$tmp\$name.zip" -UseBasicParsing
  Invoke-WebRequest "$base/$name.zip.sha256" -OutFile "$tmp\$name.zip.sha256" -UseBasicParsing
  $expected = ((Get-Content "$tmp\$name.zip.sha256" -Raw) -split '\s+')[0].ToLower()
  $actual = (Get-FileHash "$tmp\$name.zip" -Algorithm SHA256).Hash.ToLower()
  if ($expected -ne $actual) { throw "checksum mismatch (expected $expected, got $actual); aborting" }

  $dir = Join-Path $env:LOCALAPPDATA "Programs\DevDoctor"
  New-Item -ItemType Directory -Path $dir -Force | Out-Null
  Expand-Archive "$tmp\$name.zip" -DestinationPath $tmp -Force
  Copy-Item "$tmp\devdoctor.exe" (Join-Path $dir "devdoctor.exe") -Force
  Unblock-File (Join-Path $dir "devdoctor.exe")

  if (-not $NoPath) {
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    if (($userPath -split ";") -notcontains $dir) {
      [Environment]::SetEnvironmentVariable("Path", (($userPath.TrimEnd(";")), $dir -join ";"), "User")
      $env:Path = "$env:Path;$dir"
      Write-Host "Added $dir to your user PATH (new terminals will see it)."
    }
  }
  $version = & (Join-Path $dir "devdoctor.exe") --version
  Write-Host "Installed $dir\devdoctor.exe ($version)"
  Write-Host "Run: devdoctor scan"
} finally {
  Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
}
