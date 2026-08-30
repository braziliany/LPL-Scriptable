param(
  [string]$ScriptableDirectory
)

$projectRoot = Split-Path -Parent $PSScriptRoot
$source = Join-Path $projectRoot "Installer-Dev.js"

if ([string]::IsNullOrWhiteSpace($ScriptableDirectory)) {
  $projectDrive = Split-Path -Qualifier $projectRoot
  $iCloudRoots = @(
    (Join-Path $env:USERPROFILE "iCloudDrive"),
    (Join-Path $projectDrive "iCloudDrive")
  )

  foreach ($iCloudRoot in $iCloudRoots) {
    $directPath = Join-Path $iCloudRoot "Scriptable"
    if (Test-Path -LiteralPath $directPath -PathType Container) {
      $ScriptableDirectory = $directPath
      break
    }

    if (Test-Path -LiteralPath $iCloudRoot -PathType Container) {
      $providerPath = Get-ChildItem -LiteralPath $iCloudRoot -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -like "iCloud~*~Scriptable" } |
        Select-Object -First 1 -ExpandProperty FullName
      if ($providerPath) {
        $ScriptableDirectory = $providerPath
        break
      }
    }
  }
}

if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
  throw "Installer-Dev.js was not found. Run npm run dev:installer from the project root first."
}

if (-not (Test-Path -LiteralPath $ScriptableDirectory -PathType Container)) {
  throw "The iCloud Scriptable directory does not exist: $ScriptableDirectory. Configure iCloud for Windows or pass the correct -ScriptableDirectory path."
}

$destination = Join-Path $ScriptableDirectory "Installer-Dev.js"
Copy-Item -LiteralPath $source -Destination $destination -Force
Write-Output "Synced: $destination"
