# Script tạo self-signed certificate cho code signing
# Chạy bằng PowerShell với quyền Administrator

param(
    [string]$CertName = "Dino Isekai",
    [string]$Publisher = "FoxStudio",
    [string]$OutputPath = "$PSScriptRoot\..\certs",
    [string]$Password = "Dino Isekai2024"
)

# Tạo thư mục certs nếu chưa có
if (-not (Test-Path $OutputPath)) {
    New-Item -ItemType Directory -Path $OutputPath | Out-Null
}

$pfxPath = Join-Path $OutputPath "code-signing.pfx"

Write-Host "Tạo self-signed certificate..." -ForegroundColor Cyan

# Tạo certificate
$cert = New-SelfSignedCertificate `
    -Type CodeSigningCert `
    -Subject "CN=$Publisher, O=$Publisher, C=VN" `
    -FriendlyName "$CertName Code Signing" `
    -KeyUsage DigitalSignature `
    -KeyAlgorithm RSA `
    -KeyLength 2048 `
    -HashAlgorithm SHA256 `
    -NotAfter (Get-Date).AddYears(5) `
    -CertStoreLocation "Cert:\CurrentUser\My"

Write-Host "Certificate tạo thành công: $($cert.Thumbprint)" -ForegroundColor Green

# Export sang .pfx
$securePassword = ConvertTo-SecureString -String $Password -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $securePassword | Out-Null

Write-Host "Đã export: $pfxPath" -ForegroundColor Green
Write-Host ""
Write-Host "Thêm vào .env file:" -ForegroundColor Yellow
Write-Host "CSC_LINK=$pfxPath"
Write-Host "CSC_KEY_PASSWORD=$Password"
Write-Host ""
Write-Host "Lưu ý: Self-signed cert sẽ hiện cảnh báo 'Unknown publisher' trên Windows." -ForegroundColor Yellow
Write-Host "Để bỏ cảnh báo, cần mua certificate từ DigiCert/Sectigo (~$200/năm)." -ForegroundColor Yellow
