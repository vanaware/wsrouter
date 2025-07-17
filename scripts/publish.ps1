# scripts/publish.ps1

Write-Host "🔍 Rodando testes antes da publicação..."
deno test --unstable

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Testes falharam. Corrija antes de continuar."
    exit 1
}

Write-Host "📦 Publicando no JSR..."
deno run --allow-env --allow-read --allow-run https://jsr.io/ @deno/deno_std/versions/install.ts jsr publish --yes

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Publicado com sucesso!"
} else {
    Write-Host "❌ Erro ao publicar."
}