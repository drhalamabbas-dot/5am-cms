# =============================================================================
#  5A&M — تشغيل الموقع ولوحة التحكم.
#
#  يشغّل قاعدة البيانات ثم الموقع ثم يفتح المتصفح. ما كان شغّالًا لا يُشغَّل
#  مرتين، فتكرار التشغيل غير ضارّ.
#
#  لا يُستدعى مباشرة عادةً: شغّل start.bat بالضغط عليه مرتين.
#
#  الرسائل بالإنجليزية عمدًا: نافذة الأوامر في ويندوز لا ترسم العربية من
#  اليمين لليسار، فتظهر حروفها معكوسة ومقطّعة.
# =============================================================================
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$Host.UI.RawUI.WindowTitle = '5A&M - Start'

$mysqld = 'C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqld.exe'
# بيانات القاعدة في مجلد ثابت داخل مجلد المستخدم، لا في AppData: برامج ويندوز
# المغلّفة (MSIX) ترى AppData نسخةً خاصة بها، فيختلف المكان باختلاف من يشغّل
# الملف، وتُحذف تلك النسخة مع حذف البرنامج.
$dataRoot = Join-Path $env:USERPROFILE '5am-data'
$myCnf  = Join-Path $dataRoot 'my.ini'
$port   = 3000

function Listening($p) {
  $null -ne (Get-NetTCPConnection -State Listen -LocalPort $p -ErrorAction SilentlyContinue)
}

# نسخة القاعدة التي يشغّلها هذا المشروع وحدها — تُعرف بمجلد بياناتها في سطر
# أوامرها. على الجهاز قد تعمل نسخة MySQL أخرى لتطبيق آخر (XAMPP مثلًا)،
# والخلط بينهما يجعل التشغيل ينتظر نسخةً ليست لنا ثم يفشل.
# ولو تعذّرت قراءة سطر الأوامر (نسخة بمستخدم آخر) لا تُعدّ لنا.
function OurMysqld {
  Get-CimInstance Win32_Process -Filter "Name='mysqld.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and $_.CommandLine -like "*$dataRoot*" }
}

function Wait-Port($p, $seconds, $what) {
  for ($i = 0; $i -lt $seconds; $i++) {
    if (Listening $p) { return $true }
    Start-Sleep -Seconds 1
  }
  Write-Host ''
  Write-Host "   [ERROR] $what did not start within $seconds seconds." -ForegroundColor Red
  return $false
}

function Fail($msg) {
  Write-Host "   [ERROR] $msg" -ForegroundColor Red
  Write-Host ''
  Read-Host '   Press Enter to close'
  exit 1
}

Write-Host ''
Write-Host '   ===========================================' -ForegroundColor DarkCyan
Write-Host '      5A&M  -  Starting the website' -ForegroundColor Cyan
Write-Host '   ===========================================' -ForegroundColor DarkCyan
Write-Host ''

# ------------------------------------------------------------ 1) قاعدة البيانات
#  نسختان من القاعدة على المجلد نفسه خطر: ضغطتان على start.bat في الثانية
#  نفسها كانتا تشغّلان اثنتين. ما بدأ ولم يفتح المنفذ بعد يُنتظر، لا يُكرَّر.
$starting = OurMysqld
if (Listening 3306) {
  # المنفذ مفتوح لكن ليس لنا؟ الموقع سيفشل لاحقًا برسالة «تعذّر الاتصال
  # بالقاعدة» ولن يعرف أحد السبب. فيُقال هنا صراحةً.
  if (-not $starting) {
    Write-Host '   [1/3] Database ............ port 3306 is used by another MySQL' -ForegroundColor Yellow
    Write-Host '         The site will not find its own data. Stop that MySQL, or change' -ForegroundColor DarkGray
    Write-Host "         the port in: $myCnf  (and DB_PORT in .env.local)" -ForegroundColor DarkGray
  } else {
    Write-Host '   [1/3] Database ............ already running' -ForegroundColor DarkGray
  }
} elseif ($starting) {
  Write-Host '   [1/3] Database ............ already starting, waiting' -NoNewline
  if (-not (Wait-Port 3306 60 'The database')) { Fail 'Close all windows, double-click stop.bat, then start.bat again.' }
  Write-Host ' - OK' -ForegroundColor Green
} else {
  if (-not (Test-Path $mysqld)) { Fail "MySQL was not found at: $mysqld" }
  if (-not (Test-Path $myCnf))  { Fail "Database folder was not found: $dataRoot  (it holds my.ini and mysql-data)" }
  Write-Host '   [1/3] Database ............ starting' -NoNewline
  Start-Process -FilePath $mysqld -ArgumentList "--defaults-file=`"$myCnf`"" -WindowStyle Hidden
  if (-not (Wait-Port 3306 40 'The database')) { Fail 'Check that no other MySQL is using port 3306.' }
  Write-Host ' - OK' -ForegroundColor Green
}

# ----------------------------------------------------------------- 2) الموقع
if (Listening $port) {
  Write-Host "   [2/3] Website ............. already running on port $port" -ForegroundColor DarkGray
} else {
  if (-not (Test-Path 'node_modules')) {
    Write-Host '   [2/3] First run - installing packages, this can take a few minutes...' -ForegroundColor Yellow
    & npm install
    if ($LASTEXITCODE -ne 0) { Fail 'Installing packages failed (is Node.js installed?).' }
  }
  Write-Host '   [2/3] Website ............. starting' -NoNewline
  # نافذة مستقلّة مصغّرة تبقى مفتوحة: فيها سجلّ الموقع، وإغلاقها يوقفه
  Start-Process -FilePath 'cmd.exe' -WindowStyle Minimized `
    -ArgumentList '/k', "title 5AM Site - do not close && cd /d `"$root`" && npm run dev"
  if (-not (Wait-Port $port 90 'The website')) { Fail 'Open the window named "5AM Site" on the taskbar to see why.' }
  Write-Host ' - OK' -ForegroundColor Green
}

# ---------------------------------------------------------------- 3) المتصفح
Write-Host '   [3/3] Browser ............. opening' -NoNewline
# أول طلب يبني الصفحة، فيُنتظر حتى تردّ فعلًا لا حتى يفتح المنفذ
for ($i = 0; $i -lt 40; $i++) {
  try {
    Invoke-WebRequest "http://localhost:$port/?lang=ar" -UseBasicParsing -TimeoutSec 10 | Out-Null
    break
  } catch { Start-Sleep -Seconds 2 }
}
Start-Process "http://localhost:$port/?lang=ar"
Write-Host ' - OK' -ForegroundColor Green

Write-Host ''
Write-Host '   ===========================================' -ForegroundColor DarkCyan
Write-Host '      READY' -ForegroundColor Green
Write-Host '   ===========================================' -ForegroundColor DarkCyan
Write-Host ''
Write-Host "      Website     http://localhost:$port/"
Write-Host "      Dashboard   http://localhost:$port/admin"
Write-Host ''
Write-Host '      Keep the "5AM Site" window (on the taskbar) open while you work.' -ForegroundColor DarkGray
Write-Host '      To stop everything: double-click stop.bat' -ForegroundColor DarkGray
Write-Host ''
Write-Host '   This window closes by itself in 10 seconds.' -ForegroundColor DarkGray
Start-Sleep -Seconds 10
