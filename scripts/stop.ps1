# =============================================================================
#  5A&M — إيقاف الموقع وقاعدة البيانات.
#
#  قاعدة البيانات تُغلق بالطريقة السليمة (mysqladmin shutdown) لا بقتل
#  العملية: القتل أثناء كتابة قد يُتلف ملفات البيانات.
#
#  الرسائل بالإنجليزية عمدًا: نافذة الأوامر في ويندوز لا ترسم العربية من
#  اليمين لليسار، فتظهر حروفها معكوسة ومقطّعة.
# =============================================================================
$ErrorActionPreference = 'SilentlyContinue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$Host.UI.RawUI.WindowTitle = '5A&M - Stop'

$mysqladmin = 'C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqladmin.exe'
$dataRoot = Join-Path $env:USERPROFILE '5am-data'

function Listening($p) {
  $null -ne (Get-NetTCPConnection -State Listen -LocalPort $p -ErrorAction SilentlyContinue)
}

# نسخة القاعدة التي يشغّلها هذا المشروع وحدها — تُعرف بمجلد بياناتها في سطر
# أوامرها. على الجهاز قد تعمل نسخة MySQL أخرى لتطبيق آخر، وقتلها بالعافية
# وهي تكتب قد يُتلف بياناته. وما لا نستطيع قراءة سطر أوامره لا نلمسه.
function OurMysqld {
  Get-CimInstance Win32_Process -Filter "Name='mysqld.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and $_.CommandLine -like "*$dataRoot*" }
}

function Kill-Port($p, $name) {
  $conns = Get-NetTCPConnection -State Listen -LocalPort $p -ErrorAction SilentlyContinue
  if (-not $conns) { Write-Host "   $name was not running" -ForegroundColor DarkGray; return }
  foreach ($id in ($conns | Select-Object -ExpandProperty OwningProcess -Unique)) {
    # الأبناء أولًا: npm يشغّل next في عملية تابعة
    Get-CimInstance Win32_Process -Filter "ParentProcessId=$id" |
      ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    Stop-Process -Id $id -Force -ErrorAction SilentlyContinue
  }
  Write-Host "   $name stopped - OK" -ForegroundColor Green
}

Write-Host ''
Write-Host '   ===========================================' -ForegroundColor DarkCyan
Write-Host '      5A&M  -  Stopping the website' -ForegroundColor Cyan
Write-Host '   ===========================================' -ForegroundColor DarkCyan
Write-Host ''

Kill-Port 3000 'Website ...........'
Kill-Port 8000 'Old website .......'

# بيانات الدخول من .env.local نفسه، فيعمل الإيقاف ولو وُضعت كلمة مرور للقاعدة.
# كلمة المرور تُمرَّر في متغيّر بيئة لا في سطر الأوامر، فلا تظهر في قائمة العمليات.
$dbUser = 'root'; $dbPass = ''
if (Test-Path '.env.local') {
  foreach ($line in Get-Content '.env.local' -Encoding UTF8) {
    if ($line -match '^\s*DB_USER\s*=\s*(.*)$')     { $dbUser = $matches[1].Trim() }
    if ($line -match '^\s*DB_PASSWORD\s*=\s*(.*)$') { $dbPass = $matches[1].Trim() }
  }
}

if (Listening 3306) {
  if (Test-Path $mysqladmin) {
    $env:MYSQL_PWD = $dbPass
    & $mysqladmin -u $dbUser --protocol=tcp shutdown 2>$null
    Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
    for ($i = 0; $i -lt 15 -and (Listening 3306); $i++) { Start-Sleep -Seconds 1 }
    if (Listening 3306) {
      Write-Host '   Database .......... could not be stopped - it is left running (safe)' -ForegroundColor Yellow
    } else {
      Write-Host '   Database .......... stopped - OK' -ForegroundColor Green
    }
  } else {
    Write-Host '   Database .......... mysqladmin not found - left running (safe)' -ForegroundColor Yellow
  }
} else {
  Write-Host '   Database .......... was not running' -ForegroundColor DarkGray
}

# نسخة *من قاعدتنا* لم تفتح المنفذ قط (تشغيلان في الوقت نفسه): لم تفتح الملفات،
# فإيقافها آمن، ولو بقيت لمنعت التشغيل التالي.
#
# ويقتصر هذا على نسختنا وحدها: كان هنا Get-Process mysqld بلا تمييز، فكان
# يقتل أي MySQL آخر على الجهاز — ولو كان يكتب لتلفت بيانات تطبيق لا شأن له بنا.
if (-not (Listening 3306)) {
  $ours = OurMysqld
  if ($ours) {
    $ours | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    Write-Host '   Database .......... a half-started copy of our database was cleared' -ForegroundColor DarkGray
  }
  # نسخة MySQL أخرى على الجهاز تُترك كما هي: ليست لنا.
  $others = Get-Process mysqld -ErrorAction SilentlyContinue
  if ($others -and -not $ours) {
    Write-Host '   Note .............. another MySQL is running on this PC - left untouched' -ForegroundColor DarkGray
  }
}

# نوافذ الأوامر التي فتحها ملف التشغيل
Get-CimInstance Win32_Process -Filter "Name='cmd.exe'" |
  Where-Object { $_.CommandLine -like '*5AM Site*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

Write-Host ''
Write-Host '   DONE - everything is stopped.' -ForegroundColor Green
Write-Host '   This window closes by itself in 5 seconds.' -ForegroundColor DarkGray
Start-Sleep -Seconds 5
