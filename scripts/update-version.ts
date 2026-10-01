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