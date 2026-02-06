# data.json 매일 백업 스크립트
# 날짜별로 backup 폴더에 저장 (최근 30일 보관)

$BackupDir = "D:\ai\backup"
$Source = "D:\ai\data.json"
$Date = Get-Date -Format "yyyy-MM-dd"
$Time = Get-Date -Format "HHmm"

# 백업 폴더 생성
if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir | Out-Null
}

# 백업 실행
if (Test-Path $Source) {
    Copy-Item $Source "$BackupDir\data_${Date}_${Time}.json" -Force
    Write-Host "[$Date $Time] data.json backup complete"
} else {
    Write-Host "[$Date] data.json not found"
}

# 30일 이상 된 백업 삭제
Get-ChildItem "$BackupDir\data_*.json" | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } | Remove-Item -Force
