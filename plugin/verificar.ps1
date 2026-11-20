<#
  Guardia de savvy-progress-customized. Sale con codigo 1 si:
    1. algun archivo cambio, falta o sobra respecto de huellas.sha256;
    2. el codigo del mod contiene red, eval, import() u otras salidas;
    3. el validador de Claude Code ve eventos o llamadas fuera de la lista permitida,
       hosts de red, telemetria, clientes o cambios a los sustantivos de $.
  Uso:  powershell -NoProfile -ExecutionPolicy Bypass -File verificar.ps1
  Limite: protege contra cambios no revisados (una actualizacion, una copia equivocada).
  Quien pueda editar esta carpeta tambien puede editar huellas.sha256.
#>
param([string]$Mod = $PSScriptRoot)
$ErrorActionPreference = 'Stop'
$fallas = New-Object System.Collections.Generic.List[string]
$raiz = (Resolve-Path -LiteralPath $Mod).Path.TrimEnd('\')

function Get-Rel([string]$full) { ($full.Substring($raiz.Length + 1)) -replace '\\', '/' }

# 1. Huellas SHA-256 de cada archivo (menos los tipos que escribe el motor).
$esperadas = @{}
foreach ($linea in Get-Content -LiteralPath (Join-Path $raiz 'huellas.sha256') -Encoding UTF8) {
  if ($linea -match '^([0-9a-f]{64}) [ *](.+)$') { $esperadas[$Matches[2]] = $Matches[1] }
}
# Directory.GetFiles arma cada ruta con la raiz tal como se le dio (corta o larga),
# asi la ruta relativa no depende de como Windows escriba la carpeta.
$archivos = [System.IO.Directory]::GetFiles($raiz, '*', [System.IO.SearchOption]::AllDirectories) | Where-Object {
  $rel = Get-Rel $_
  -not $rel.StartsWith('.claude-plugin/types/') -and $rel -ne 'huellas.sha256'
}
foreach ($f in $archivos) {
  $rel = Get-Rel $f
  $h = (Get-FileHash -LiteralPath $f -Algorithm SHA256).Hash.ToLower()
  if (-not $esperadas.ContainsKey($rel)) { $fallas.Add("archivo nuevo sin revisar: $rel") }
  elseif ($esperadas[$rel] -ne $h) { $fallas.Add("archivo cambiado: $rel") }
  $esperadas.Remove($rel)
}
foreach ($rel in @($esperadas.Keys)) { $fallas.Add("falta el archivo: $rel") }

# 2. Texto prohibido en el codigo que carga el motor (las pruebas no se cargan).
$prohibido = @(
  '\bfetch\s*\(', '\beval\s*\(', 'new\s+Function\b', '\bimport\s*\(', '\brequire\s*\(',
  'globalThis', '\bWebSocket\b', 'XMLHttpRequest', 'sendBeacon', 'EventSource',
  '\$\.(http|fs|process|model|net|store|session|agent(?!\.list\()|tool|skill|permissions|settings\.write)\b',
  # Cada hook pasa el evento intacto: un next() con otro argumento reescribiria
  # lo que sigue (un prompt, una llamada, un resultado).
  '\bnext\((?!e\))'
)
$codigo = Get-ChildItem -LiteralPath (Join-Path $raiz 'hooks') -Recurse -File |
  Where-Object { $_.Name -notmatch '\.test\.' -and $_.Extension -match '^\.(ts|tsx|js|jsx|mjs|cjs|mts|cts)$' }
foreach ($f in $codigo) {
  $texto = [System.IO.File]::ReadAllText($f.FullName)
  foreach ($p in $prohibido) { if ($texto -match $p) { $fallas.Add("patron prohibido '$p' en $($f.Name)") } }
}

# 3. Lo que el validador de Claude Code ve en el modulo.
$eventos = @('session.start', 'command.run', 'tool.call', 'agent.spawn', 'turn.step', 'turn.complete', 'ui.render')
# agent.list: solo lectura, para saber con certeza cuándo terminó cada subagente.
$llamadas = @('agent.list', 'clock.every', 'clock.now', 'command.register', 'env.get', 'settings.read', 'state.get', 'state.set',
  'ui.close', 'ui.open', 'ui.panes', 'ui.resolve')
$json = (& claude plugin validate --json $raiz 2>$null) -join "`n"
if ($LASTEXITCODE -ne 0) { $fallas.Add('claude plugin validate fallo') }
$r = $json | ConvertFrom-Json
$mods = @($r.contents | Where-Object { $_.type -eq 'hooks' } | ForEach-Object { $_.modules })
if ($mods.Count -ne 1 -or $mods[0].module -ne './register.tsx') { $fallas.Add('se esperaba un unico modulo ./register.tsx') }
foreach ($m in $mods) {
  foreach ($ev in $m.uses.events) { if ($eventos -notcontains $ev) { $fallas.Add("evento no permitido: $ev") } }
  foreach ($c in $m.uses.calls) { if ($llamadas -notcontains $c) { $fallas.Add("llamada no permitida: `$.$c") } }
  if (@($m.uses.hosts.named).Count -or @($m.uses.hosts.unread).Count) { $fallas.Add('el modulo nombra hosts de red') }
  if (@($m.uses.env.writes).Count) { $fallas.Add('el modulo escribe variables de entorno') }
  if (@($m.telemetry).Count) { $fallas.Add('el modulo envia telemetria') }
  if (@($m.clients).Count) { $fallas.Add('el modulo abre clientes') }
  $n = $m.nouns
  if (@($n.adds).Count -or @($n.addsUnlessThere).Count -or @($n.withholds).Count -or @($n.replaces).Count) {
    $fallas.Add('el modulo cambia los sustantivos de $')
  }
  foreach ($h in $m.hooks) {
    if ($h.pattern -eq 'tool.call' -and $h.matcher.has.tool.is -ne 'Agent') { $fallas.Add('hook de tool.call fuera de Agent') }
  }
}

if ($fallas.Count) {
  Write-Host 'FALLA: savvy-progress-customized no coincide con la copia revisada:' -ForegroundColor Red
  $fallas | ForEach-Object { Write-Host "  - $_" }
  exit 1
}
Write-Host 'OK: coincide con la copia revisada y solo usa capacidades permitidas.' -ForegroundColor Green
exit 0
