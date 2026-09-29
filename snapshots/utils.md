> **INSTRUÇÃO PARA A IA:** 
> O texto abaixo contém o código da biblioteca @vanaware/buildit
> Cada arquivo começa com um título indicando seu caminho relativo exato (ex: `## Arquivo: src/main.ts`).
> Sempre que sugerir alterações, indique claramente qual arquivo deve ser modificado com base nesses caminhos e forneça o novo código completo do arquivo.

---

# Contexto Exportado do Projeto WorkerDB - Modo: UTILS

Gerado automaticamente em: 2026-09-29T00:13:12.072Z

---

## Arquivo: `sanitize-version.ts`

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

## Arquivo: `tag-version.ts`

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

