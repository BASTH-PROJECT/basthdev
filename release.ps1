# PowerShell script to build and install release APK
# Usage: .\release.ps1

$ErrorActionPreference = "Stop"

# Set JAVA_HOME and add to PATH
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-17.0.16.8-hotspot"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"

$LogFile = "build-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"

function Write-Log {
    param($Message, $Color = "White")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] $Message"
    Write-Host $logMessage -ForegroundColor $Color
    Add-Content -Path $LogFile -Value $logMessage
}

Write-Log "=== ONI CashApp Release Build Started ===" "Cyan"
Write-Log "Log file: $LogFile" "Gray"

# Check if android directory exists
if (-not (Test-Path "android")) {
    Write-Log "ERROR: android directory not found. Run 'npx expo prebuild' first." "Red"
    exit 1
}

# Navigate to android directory
Write-Log "Navigating to android directory..." "Yellow"
Set-Location android

# Clean previous builds
# Write-Log "Cleaning previous builds..." "Yellow"
# .\gradlew clean 2>&1 | Tee-Object -FilePath "..\$LogFile" -Append

# Build release APK
Write-Log "Building release APK..." "Yellow"
Write-Log "This may take several minutes..." "Gray"
.\gradlew assembleRelease 2>&1 | Tee-Object -FilePath "..\$LogFile" -Append

if ($LASTEXITCODE -ne 0) {
    Write-Log "ERROR: Build failed with exit code $LASTEXITCODE" "Red"
    Set-Location ..
    exit 1
}

# Find the APK
$apkPath = "app\build\outputs\apk\release\app-release.apk"
if (-not (Test-Path $apkPath)) {
    Write-Log "ERROR: APK not found at $apkPath" "Red"
    Set-Location ..
    exit 1
}

$fullApkPath = (Resolve-Path $apkPath).Path
Write-Log "APK built successfully: $fullApkPath" "Green"

# Get APK size
$apkSize = (Get-Item $apkPath).Length / 1MB
Write-Log "APK size: $([math]::Round($apkSize, 2)) MB" "Cyan"

# Check if device is connected
Write-Log "Checking for connected devices..." "Yellow"
$devices = adb devices | Select-String -Pattern "device$"
if ($devices.Count -eq 0) {
    Write-Log "WARNING: No Android devices connected" "Yellow"
    Write-Log "APK location: $fullApkPath" "Cyan"
    Set-Location ..
    exit 0
}

Write-Log "Found $($devices.Count) connected device(s)" "Green"

# Install APK
Write-Log "Installing APK to device..." "Yellow"
adb install -r $apkPath 2>&1 | Tee-Object -FilePath "..\$LogFile" -Append

if ($LASTEXITCODE -eq 0) {
    Write-Log "APK installed successfully!" "Green"
} else {
    Write-Log "ERROR: Installation failed with exit code $LASTEXITCODE" "Red"
    Set-Location ..
    exit 1
}

# Return to root directory
Set-Location ..

Write-Log "=== Build and Install Completed ===" "Cyan"
Write-Log "APK: $fullApkPath" "Cyan"
Write-Log "Log: $LogFile" "Gray"
Write-Log "Log: Developed by BasthDev" "Gray"
