import * as fs from "fs/promises";
import * as path from "path";

// Path to the "ready" folder containing your JSON (.json or .txt) files
const readyDir = path.join(__dirname, "..", "output", "ready");

// Recursively walk a directory and collect all file paths
async function walkDir(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkDir(fullPath)));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

// Helper to extract a safe message from unknown errors
function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function main() {
  try {
    // Get all files under readyDir
    const allFiles = await walkDir(readyDir);
    // Filter to only JSON or TXT files (case-insensitive)
    const dataFiles = allFiles.filter((f) => {
      const ext = path.extname(f).toLowerCase();
      return ext === ".json" || ext === ".txt";
    });

    console.log(
      `Found ${dataFiles.length} data file(s) (.json/.txt) under ${readyDir}`
    );

    let totalChunks = 0;

    for (const filePath of dataFiles) {
      let content: string;
      try {
        content = await fs.readFile(filePath, "utf-8");
      } catch (err: unknown) {
        console.warn(
          `Skipping ${filePath}: unable to read (${getErrorMessage(err)})`
        );
        continue;
      }

      let parsed: any;
      try {
        parsed = JSON.parse(content);
      } catch (err: unknown) {
        console.warn(
          `Skipping ${filePath}: invalid JSON (${getErrorMessage(err)})`
        );
        continue;
      }

      if (Array.isArray(parsed.chunks)) {
        totalChunks += parsed.chunks.length;
      } else {
        console.warn(`Skipping ${filePath}: no chunks array found`);
      }
    }

    // Final output
    console.log(`Number of files processed: ${dataFiles.length}`);
    console.log(`Total chunks: ${totalChunks}`);
  } catch (err: unknown) {
    console.error("Error counting files/chunks:", getErrorMessage(err));
    process.exit(1);
  }
}

main();
