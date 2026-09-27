/// <reference lib="deno.ns" />

/**
 * @file tag-version.ts
 * @description CLI para criação e publicação de tag git baseada na versão do deno.json[c].
 * Gera tags no formato vMAJOR.MINOR e publica no repositório remoto.
 */

import { tagVersionCli, }  from "@vanaware/buildit/cli/tag-version";
async function getLastVersion(): Promise<string | null> {
  const fetchCmd = new Deno.Command("git", {
    args: ["fetch", "--tags", "--quiet"],
    stdout: "piped",
    stderr: "piped",
  });
  const fetchResult = await fetchCmd.output();
  if (fetchResult.code !== 0) {
    const err = new TextDecoder().decode(fetchResult.stderr);
    console.warn(`⚠️  git fetch --tags falhou: ${err.trim()}`);
  }

  const tagCmd = new Deno.Command("git", {
    args: ["tag", "--sort=-creatordate"],
    stdout: "piped",
    stderr: "piped",
  });
  const { code, stdout, stderr } = await tagCmd.output();

  if (code !== 0) {
    const err = new TextDecoder().decode(stderr);
    console.warn(`⚠️  git tag falhou: ${err.trim()}`);
    return null;
  }

  const tags = new TextDecoder()
    .decode(stdout)
    .trim()
    .split("\n")
    .filter(Boolean);

  const [firstTag] = tags;
  if (!firstTag) return null;

  return firstTag.replace(/^v/, "");
}

async function changeLog(majorVersion: number, minorVersion: number) {
  const newVersion = `${majorVersion}.${minorVersion}`;
  const lastVersion = await getLastVersion();

  // Se não houver tag anterior, pega o log inteiro até HEAD.
  const range = lastVersion ? `v${lastVersion}..HEAD` : "HEAD";

  const gitLogCmd = new Deno.Command("git", {
    args: ["log", "--pretty=format:%h %s", range],
    stdout: "piped",
    stderr: "piped",
  });
  const { code, stdout, stderr } = await gitLogCmd.output();

  if (code !== 0) {
    const err = new TextDecoder().decode(stderr);
    throw new Error(`git log falhou: ${err.trim()}`);
  }

  const logOutput = new TextDecoder().decode(stdout);

  const changelog = `## v${newVersion} (${new Date().toISOString().slice(0, 10)})\n\n${
    logOutput.trim()
      ? logOutput.split("\n").map((line) => "- " + line).join("\n")
      : "- Sem alterações relevantes"
  }`;

  // Escreve no CHANGELOG.md (prepend).
  const changelogHeader = await Deno.readTextFile("CHANGELOG.md").catch(() => "");
  await Deno.writeTextFile("CHANGELOG.md", `${changelog}\n\n${changelogHeader}`);

  // Atualiza o README.md com um resumo.
  let readme = await Deno.readTextFile("README.md");
  const changelogSummary = changelog
    .split("\n")
    .slice(0, 6)
    .join("\n")
    .replace(/^## v\d+\.\d+\.\d+.*$/m, "### 📦 Últimas atualizações");

  const changelogSection =
    `<!-- START:changelog -->\n${changelogSummary}\n<!-- END:changelog -->`;

  if (readme.includes("<!-- START:changelog -->")) {
    readme = readme.replace(
      /<!-- START:changelog -->[\s\S]*<!-- END:changelog -->/,
      changelogSection,
    );
  } else {
    readme += `\n\n## 📦 Últimas Atualizações\n\n${changelogSummary}`;
  }

  await Deno.writeTextFile("README.md", readme);

  console.log(`✅ Changelog atualizado para v${newVersion} (baseado em v${lastVersion ?? "—"})`);
}

if (import.meta.main) {

  
  const cli = tagVersionCli();
  await cli.parse(Deno.args,);
}
