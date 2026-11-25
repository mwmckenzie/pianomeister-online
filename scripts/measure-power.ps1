# Battery drain and Chrome's processor use over a time (docs/performance.md): run on battery, with
# only the measured Chrome window open.
#   .\measure-power.ps1 -Label paused -Seconds 120
param([string]$Label = 'run', [int]$Seconds = 120)

function ChromeTime { (Get-Process chrome -ErrorAction SilentlyContinue | Measure-Object -Property CPU -Sum).Sum }
function Battery { Get-CimInstance -Namespace root/wmi -ClassName BatteryStatus -ErrorAction SilentlyContinue | Select-Object -First 1 }

$first = Battery
if ($null -eq $first) { Write-Host 'No battery readings here: only processor use is measured.' }
elseif (-not $first.Discharging) { Write-Host 'The battery is not discharging: unplug the charger.' }
$before = ChromeTime
$watch = [Diagnostics.Stopwatch]::StartNew()
$rates = @()
while ($watch.Elapsed.TotalSeconds -lt $Seconds) {
  Start-Sleep -Seconds 2
  $b = Battery
  if ($null -ne $b -and $b.Discharging) { $rates += $b.DischargeRate }
}
$took = $watch.Elapsed.TotalSeconds
$core = 100 * ((ChromeTime) - $before) / $took
$drain = if ($rates.Count -gt 0) { '{0:N2} W' -f (($rates | Measure-Object -Average).Average / 1000) } else { 'n/a' }
'{0}: battery {1} ({2} readings), Chrome {3:N0} % of one core, {4:N0} s' -f $Label, $drain, $rates.Count, $core, $took
