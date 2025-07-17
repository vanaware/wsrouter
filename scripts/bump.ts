#!/usr/bin/env -S deno run --allow-run --allow-read --allow-write

// Seu código Deno aqui...
console.log("Rodando script bump...");

import { parse } from "https://deno.land/std @0.224.0/flags/mod.ts";

const args = parse(Deno.args, {
  boolean: ["major", "minor", "patch"],
  default: { patch: true },
});

async function runCmd(cmd: string[]) {
  const p = Deno.run({ cmd });
  const status = await p.status();
  if (!status.success) {
    console.error(`Erro executando: ${cmd.join(" ")}`);
    Deno.exit(1);
  }
}

console.log("🔍 Rodando testes e verificando lint...");
try {
  await runCmd(["deno", "test", "--unstable"]);
  await runCmd(["deno", "lint"]);
  await runCmd(["deno", "fmt", "--check"]);
} catch (e) {
  console.error("❌ Testes, lint ou formatação falharam. Corrija antes de continuar.");
  Deno.exit(1);
}

const versionRaw = await Deno.readTextFile("VERSION");
let [major, minor, patch] = versionRaw
  .replace(/^v/, "")
  .split(".")
  .map(Number);

if (args.major) major += 1;
else if (args.minor) minor += 1;
else if (args.patch) patch += 1;

const newVersion = `${major}.${minor}.${patch}`;
console.log(`Atualizando versão de ${versionRaw} para v${newVersion}`);

await Deno.writeTextFile("VERSION", newVersion);

const denoJson = JSON.parse(await Deno.readTextFile("deno.json"));
denoJson.version = newVersion;
await Deno.writeTextFile("deno.json", JSON.stringify(denoJson, null, 2));

const logOutput = new TextDecoder().decode(
  await Deno.run({
    cmd: ["git", "log", "--pretty=format:%h %s", `v${versionRaw}..HEAD`],
    stdout: "piped",
  }).output()
);

const changelog = `## v${newVersion} (${new Date().toISOString().slice(0, 10)})\n\n${
  logOutput.trim() ? logOutput.split("\n").map((line) => "- " + line).join("\n") : "- Sem alterações relevantes"
}`;

const changelogHeader = await Deno.readTextFile("CHANGELOG.md").catch(() => "");
await Deno.writeTextFile("CHANGELOG.md", `${changelog}\n\n${changelogHeader}`);

let readme = await Deno.readTextFile("README.md");
const changelogSummary = changelog
  .split("\n")
  .slice(0, 6)
  .join("\n")
  .replace(/^## v\d+\.\d+\.\d+.*$/m, "### 📦 Últimas atualizações");

const changelogSection = `<!-- START:changelog -->\n${changelogSummary}\n<!-- END:changelog -->`;

if (readme.includes("<!-- START:changelog -->")) {
  readme = readme.replace(/<!-- START:changelog -->[\s\S]*<!-- END:changelog -->/, changelogSection);
} else {
  readme += `\n\n## 📦 Últimas Atualizações\n\n${changelogSummary}`;
}

await Deno.writeTextFile("README.md", readme);

console.log("Formatando código...");
await runCmd(["deno", "fmt"]);

await runCmd(["git", "add", "."]);
await runCmd(["git", "commit", "-m", `release: v${newVersion}`]);

await runCmd(["git", "tag", `v${newVersion}`]);

await runCmd(["git", "push"]);
await runCmd(["git", "push", "origin", `v${newVersion}`]);

console.log(`✅ Versão atualizada para v${newVersion}`);
console.log("Changelog gerado:");
console.log(changelog);