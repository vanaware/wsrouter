> **INSTRUÇÃO PARA A IA:** 
> O texto abaixo contém o código da biblioteca @vanaware/buildit
> Cada arquivo começa com um título indicando seu caminho relativo exato (ex: `## Arquivo: src/main.ts`).
> Sempre que sugerir alterações, indique claramente qual arquivo deve ser modificado com base nesses caminhos e forneça o novo código completo do arquivo.

---

# Contexto Exportado do Projeto WorkerDB - Modo: UTILS

Gerado automaticamente em: 2026-10-01T22:35:55.056Z

---

## Arquivo: `scripts/export.jsonc`

```json
{
  "$schema": "https://vanaware.github.io/buildit/schema/export.json",
  "projeto": "WorkerDB",
  "modos": {
    "example": {
      "arquivoSaida": "snapshots/example.md",
      "includes": [
        "example/**/*.{tsx,jsx,js,ts,css,html,manifest,json,jsonc,md}"
      ],
      "excludes": [
        "**/node_modules/**",
        "**/.git/**"
      ],
      "incluiVersao": true,
      "instrucaoCustomizada": "O texto abaixo contém os arquivos de CÓDIGO FONTE principais da aplicação exemplo (example).",
      "default": true
    },
    "docs": {
      "arquivoSaida": "snapshots/docs.md",
      "includes": [
        "docs/**/*.{md,txt}",
        "{README.md,LICENSE,.tool-versions,CHANGELOG.md}"
      ],
      "excludes": [
        "**/node_modules/**",
        "**/.git/**"
      ],
      "incluiVersao": false,
      "instrucaoCustomizada": "O texto abaixo contém a DOCUMENTAÇÃO e diretrizes arquiteturais do projeto.",
      "default": true
    },
    "server": {
      "arquivoSaida": "snapshots/server.md",
      "includes": [
        "{src,tests}/**/*.{tsx,jsx,js,ts,css,html,json,jsonc,yaml,yml,md}",
        "{deno.json,deno.jsonc,README.md,.env.example}",
        ".github/workflows/**/*.{yaml,yml}"
      ],
      "excludes": [
        "**/node_modules/**",
        "**/.git/**"
      ],
      "incluiVersao": true,
      "instrucaoCustomizada": "O texto abaixo contém os arquivos de configuração e execução do WSROUTER @vanaware/wsrouter e CI/CD.",
      "default": true
    },
    "utils": {
      "arquivoSaida": "snapshots/utils.md",
      "includes": [
        "scripts/**/*.{ts,jsonc}"
      ],
      "excludes": [
        "**/node_modules/**",
        "**/.git/**"
      ],
      "incluiVersao": false,
      "instrucaoCustomizada": "O texto abaixo contém o código da biblioteca @vanaware/buildit",
      "default": true
    }
  }
}

```

---

## Arquivo: `scripts/export.ts`

```ts
/// <reference lib="deno.ns" />

/**
 * @file export.ts
 * @description CLI de consolidação de contexto para IAs no projeto BuildIt.
 * Delega a execução e regras para a biblioteca @vanaware/buildit
 * e carrega as configurações declarativas de export.jsonc.
 */

import { exportCli, } from "@vanaware/buildit/cli/export";

if (import.meta.main) {
  const cli = exportCli();
  await cli.parse(Deno.args,);
}

```

---

## Arquivo: `scripts/sanitize-version.ts`

```ts
/// <reference lib="deno.ns" />

/**
 * @file sanitize-version.ts
 * @description CLI de sanitização de versão semântica do deno.json[c].
 * Normaliza o campo "version" para o formato estrito semver (MAJOR.MINOR.PATCH).
 */

import { sanitizeVersionCli, } from "@vanaware/buildit/cli/sanitize-version";

if (import.meta.main) {
  const cli = sanitizeVersionCli();
  await cli.parse(Deno.args,);
}

```

---

## Arquivo: `scripts/tag-version.ts`

```ts
/// <reference lib="deno.ns" />

/**
 * @file tag-version.ts
 * @description CLI para criação e publicação de tag git baseada na versão do deno.json[c].
 * Gera tags no formato vMAJOR.MINOR e publica no repositório remoto.
 */

import { tagVersionCli, }  from "@vanaware/buildit/cli/tag-version";

if (import.meta.main) {
  const cli = tagVersionCli();
  await cli.parse(Deno.args,);
}

```

---

## Arquivo: `scripts/update-version.ts`

```ts
import {
    ensureVersionFiles,
    processFilesWithDefines,
    readProjectVersion,
    incrementProjectVersion
} from "@vanaware/buildit"
import { join } from "@std/path/join";

async function newProjectVersion(denoJsonPath : string, baseDir: string) { 
    return incrementProjectVersion({
        denoJsonPath,
        baseDir
    });
}
async function syncVersionFiles() {
    const baseDir = "./"
    const lista = [
            "src/version.ts",
            "example/version.ts",
            "example/public/version.js"
        ]
    for (const arquivo of lista) {
        try {
            await Deno.remove(join(baseDir,arquivo));
            console.log(`✅ Excluído arquivo ${join(baseDir,arquivo)}`);
        } catch (err) {
            if (err instanceof Deno.errors.NotFound) {
                console.log(`✅ Ignorado (não existe) ${join(baseDir,arquivo)}`);
            } else {
                throw err; // qualquer outro erro deve interromper
            }
        }
    }
    const arquivos = await ensureVersionFiles(
        lista,
        baseDir,
        "__APP_VERSION__"
    );
    const version = await newProjectVersion("deno.jsonc",baseDir)
    console.log(`\n📦 Sincronizando versão "${version}" em ${arquivos.length} arquivo(s)...\n`);
    const results = await processFilesWithDefines(
        arquivos,
        {
            "__APP_VERSION__": JSON.stringify(version),
        },
    );
    for (const path of arquivos) {
        console.log(`✅ processado  ${path}`);
    }
    console.log(`\n🎉 Concluído: ${arquivos.length} arquivo(s) sincronizado(s) para v${version}.\n`);
}


if (import.meta.main) {
    try {
        await syncVersionFiles();
    } catch (err) {
        console.error("❌ Falha ao sincronizar versão:", err);
        Deno.exit(1);
    }
}
```

---

