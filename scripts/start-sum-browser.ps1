param(
  [ValidateSet('auto', 'chrome', 'brave')]
  [string]$Browser = 'auto',
  [ValidateRange(1024, 65535)]
  [int]$Port = 9222,
  [string]$Executable
)

$ErrorActionPreference = 'Stop'
$profileDirectory = $null
$browserProcess = $null

try {
  if ($Executable) {
    if (-not (Test-Path -LiteralPath $Executable -PathType Leaf)) {
      throw 'El ejecutable indicado no existe.'
    }
    $browserExecutable = (Resolve-Path -LiteralPath $Executable).Path
  } else {
    $products = @('chrome', 'brave')
    if ($Browser -ne 'auto') { $products = @($Browser) }
    $roots = @($env:ProgramFiles, ${env:ProgramFiles(x86)}, $env:LOCALAPPDATA)
    $browserExecutable = $null
    foreach ($product in $products) {
      $relative = 'Google\Chrome\Application\chrome.exe'
      if ($product -eq 'brave') { $relative = 'BraveSoftware\Brave-Browser\Application\brave.exe' }
      foreach ($root in $roots) {
        if (-not $root) { continue }
        $candidate = Join-Path $root $relative
        if (Test-Path -LiteralPath $candidate -PathType Leaf) {
          $browserExecutable = $candidate
          break
        }
      }
      if ($browserExecutable) { break }
    }
    if (-not $browserExecutable) {
      throw 'No se encontro Chrome/Brave. Instala uno o indica -Executable.'
    }
  }

  $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
  try { $listener.Start() }
  catch { throw 'El puerto CDP esta ocupado. Cierra la instancia anterior o usa -Port.' }
  finally { $listener.Stop() }

  # A separate profile is required by modern Chrome; never reuse the daily profile.
  $profileDirectory = Join-Path ([System.IO.Path]::GetTempPath()) ('sum-playwright-' + [guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $profileDirectory | Out-Null
  $arguments = @(
    "--remote-debugging-port=$Port",
    '--remote-debugging-address=127.0.0.1',
    "--user-data-dir=`"$profileDirectory`"",
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank'
  )
  $browserProcess = Start-Process -FilePath $browserExecutable -ArgumentList $arguments -PassThru
  $endpoint = "http://127.0.0.1:$Port"
  $ready = $false
  $deadline = (Get-Date).AddSeconds(25)
  while ((Get-Date) -lt $deadline -and -not $browserProcess.HasExited) {
    try {
      $response = Invoke-WebRequest -Uri "$endpoint/json/version" -UseBasicParsing -TimeoutSec 2
      if ($response.StatusCode -eq 200) { $ready = $true; break }
    } catch { }
    Start-Sleep -Milliseconds 250
  }
  if (-not $ready) { throw 'El navegador no inicio CDP. Comprueba sus politicas o usa otro navegador.' }

  Write-Host "Navegador listo: $endpoint"
  Write-Host 'Manten esta terminal abierta. Usa otra terminal para el exportador o reinicia Codex para el MCP.'
  Read-Host 'Pulsa Enter para cerrar esta instancia y eliminar su perfil temporal' | Out-Null
} catch {
  Write-Error $_
} finally {
  if ($profileDirectory -and $browserProcess) {
    # Match our unique profile only; leave other Chrome/Brave processes alone.
    Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -in @('chrome.exe', 'brave.exe') -and $_.CommandLine -and $_.CommandLine.Contains($profileDirectory) } |
      ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  }
  if ($profileDirectory) {
    for ($attempt = 0; $attempt -lt 10; $attempt++) {
      try { Remove-Item -LiteralPath $profileDirectory -Recurse -Force -ErrorAction Stop; break }
      catch { Start-Sleep -Milliseconds 300 }
    }
    if (Test-Path -LiteralPath $profileDirectory) {
      Write-Warning "No se pudo eliminar el perfil temporal. Eliminalo manualmente: $profileDirectory"
    }
  }
}
