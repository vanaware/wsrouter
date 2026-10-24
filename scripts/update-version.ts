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
    const fileList = [
            "src/version.ts",
            "example/version.ts",
            "example/public/version.js"
        ]
    for (const file of fileList) {
        try {
            await Deno.remove(join(baseDir, file));
            console.log(`✅ File deleted ${join(baseDir, file)}`);
        } catch (err) {
            if (err instanceof Deno.errors.NotFound) {
                console.log(`✅ Skipped (does not exist) ${join(baseDir, file)}`);
            } else {
                throw err; // any other error must interrupt
            }
        }
    }
    const files = await ensureVersionFiles(
        fileList,
        baseDir,
        "__APP_VERSION__"
    );
    const version = await newProjectVersion("deno.jsonc",baseDir)
    console.log(`\n📦 Syncing version "${version}" across ${files.length} file(s)...\n`);
    const results = await processFilesWithDefines(
        files,
        {
            "__APP_VERSION__": JSON.stringify(version),
        },
    );
    for (const path of files) {
        console.log(`✅ processed  ${path}`);
    }
    console.log(`\n🎉 Done: ${files.length} file(s) synced to v${version}.\n`);
}


if (import.meta.main) {
    try {
        await syncVersionFiles();
    } catch (err) {
        console.error("❌ Failed to sync version:", err);
        Deno.exit(1);
    }
}