#!/usr/bin/env -S deno run --allow-run --allow-read

console.log("🔍 Rodando testes antes da publicação...");
await new Deno.Command("deno", { args: ["test", "--unstable"] }).spawn().status;

console.log("📦 Publicando no JSR...");
await new Deno.Command("jsr", { args: ["publish", "--yes"] }).spawn().status;

console.log("✅ Publicado com sucesso!");