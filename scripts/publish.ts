#!/usr/bin/env -S deno run --allow-run --allow-read

console.log("🔍 Rodando testes antes da publicação...");
await Deno.run({ cmd: ["deno", "test", "--unstable"] }).status();

console.log("📦 Publicando no JSR...");
await Deno.run({ cmd: ["jsr", "publish", "--yes"] }).status();

console.log("✅ Publicado com sucesso!");