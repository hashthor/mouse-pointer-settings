<#
.SYNOPSIS
    Apply a Windows cursor theme from a JSON map of cursor slot names to .cur file paths.

.PARAMETER CursorJson
    JSON string: { "Arrow": "C:\\path\\Arrow.cur", "Hand": "C:\\path\\Hand.cur", ... }
    Pass an empty JSON object "{}" to reset to the Windows default cursors.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File apply-cursor.ps1 -CursorJson '{"Arrow":"C:\\...\\Arrow.cur"}'
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$CursorJson
)

$ErrorActionPreference = 'Stop'

# ── Registry key ────────────────────────────────────────────────────────────
$regPath = 'HKCU:\Control Panel\Cursors'

# Map of registry value names to their slot identifiers
$slotMap = @{
    'Arrow'        = 'Arrow'
    'Help'         = 'Help'
    'AppStarting'  = 'AppStarting'
    'Wait'         = 'Wait'
    'Crosshair'    = 'Crosshair'
    'IBeam'        = 'IBeam'
    'NWPen'        = 'NWPen'
    'No'           = 'No'
    'SizeNS'       = 'SizeNS'
    'SizeWE'       = 'SizeWE'
    'SizeNWSE'     = 'SizeNWSE'
    'SizeNESW'     = 'SizeNESW'
    'SizeAll'      = 'SizeAll'
    'UpArrow'      = 'UpArrow'
    'Hand'         = 'Hand'
}

$cursorPaths = $CursorJson | ConvertFrom-Json

$isReset = ($CursorJson.Trim() -eq '{}')

if ($isReset) {
    # Clearing all values resets to Windows built-in default cursors
    foreach ($slot in $slotMap.Keys) {
        Set-ItemProperty -Path $regPath -Name $slot -Value '' -ErrorAction SilentlyContinue
    }
    # Set scheme name to empty (no named scheme)
    Set-ItemProperty -Path $regPath -Name '(Default)' -Value '' -ErrorAction SilentlyContinue
} else {
    # Write each cursor path into the registry
    foreach ($slot in $slotMap.Keys) {
        $filePath = $cursorPaths.$slot
        if ($filePath) {
            Set-ItemProperty -Path $regPath -Name $slot -Value $filePath
        }
    }
    Set-ItemProperty -Path $regPath -Name '(Default)' -Value 'MouseHunter'
}

# ── Broadcast SPI_SETCURSORS so Windows reloads cursors immediately ──────────
$csCode = @"
using System;
using System.Runtime.InteropServices;
public class CursorReloader {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SystemParametersInfo(
        uint uiAction, uint uiParam, IntPtr pvParam, uint fWinIni);

    public const uint SPI_SETCURSORS = 0x0057;
    public const uint SPIF_UPDATEINIFILE = 0x0001;
    public const uint SPIF_SENDCHANGE    = 0x0002;

    public static void Reload() {
        SystemParametersInfo(
            SPI_SETCURSORS, 0, IntPtr.Zero,
            SPIF_UPDATEINIFILE | SPIF_SENDCHANGE);
    }
}
"@

Add-Type -TypeDefinition $csCode -Language CSharp
[CursorReloader]::Reload()

Write-Output "OK"
