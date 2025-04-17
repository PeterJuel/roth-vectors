import * as fs from "fs/promises";
import * as path from "path";
import { splitIntoChunks, countTokens } from "./chunkUtils";

async function clearPreparedFolder(folderPath: string): Promise<void> {
  try {
    // Remove the folder and its contents, then recreate the folder.
    await fs.rm(folderPath, { recursive: true, force: true });
    await fs.mkdir(folderPath, { recursive: true });
    console.log(`Cleared folder: ${folderPath}`);
  } catch (error) {
    console.error(`Error clearing folder ${folderPath}:`, error);
  }
}

async function main() {
  const preparedFolder = path.join(__dirname, "..", "..", "output", "prepared");
  await clearPreparedFolder(preparedFolder);

  // Read the files.json from the output folder.
  const filesJsonPath = path.join(
    __dirname,
    "..",
    "..",
    "output",
    "files.json"
  );
  let fileMap: { [filename: string]: { type: string; length?: number } };

  try {
    const jsonStr = await fs.readFile(filesJsonPath, "utf8");
    fileMap = JSON.parse(jsonStr);
  } catch (error) {
    console.error("Error reading files.json:", error);
    return;
  }

  // Take only the first 2 entries from the file map.
  const entries = Object.entries(fileMap).slice(0, 200000000);

  // Process each file entry.
  for (const [filename, info] of entries) {
    let filePath: string;
    if (info.type === "text") {
      // For text files, look in input/text folder.
      filePath = path.join(__dirname, "..", "..", "input", "text", filename);
    } else if (info.type === "pdf") {
      // For PDFs, assume the processed text file is in output/pdf with .txt extension.
      // e.g., "Installation_QuickBox.pdf" becomes "Installation_QuickBox.txt" for reading.
      const base = path.basename(filename, ".pdf");
      filePath = path.join(
        __dirname,
        "..",
        "..",
        "output",
        "pdf",
        base + ".txt"
      );
    } else {
      console.warn(`Unknown file type for ${filename}`);
      continue;
    }

    // Read the file content.
    let content = "";
    try {
      content = await fs.readFile(filePath, "utf8");
    } catch (error) {
      console.error(`Error reading file at ${filePath}:`, error);
      continue;
    }

    // Split the content into chunks of 1500 tokens with an overlap of 200 tokens.
    const chunks = splitIntoChunks(content, 1500, 200);

    // Save each chunk to the prepared folder with the proper naming convention.
    for (let i = 0; i < chunks.length; i++) {
      let outputFileName: string;
      const chunkNumber = i + 1;

      if (info.type === "text") {
        // Remove the trailing .txt from a text file name.
        outputFileName =
          filename.replace(/\.txt$/i, "") + `-${chunkNumber}.txt`;
      } else if (info.type === "pdf") {
        // For pdf files, keep the original file name (with .pdf) and append the chunk indicator and new extension.
        outputFileName = filename + `-${chunkNumber}.txt`;
      } else {
        continue;
      }

      const outputFilePath = path.join(preparedFolder, outputFileName);

      try {
        await fs.writeFile(outputFilePath, chunks[i], "utf8");
        console.log(
          `Written chunk ${chunkNumber} for ${filename} to ${outputFileName} (Token count: ${countTokens(
            chunks[i]
          )})`
        );
      } catch (error) {
        console.error(`Error writing file ${outputFilePath}:`, error);
      }
    }
  }
}

main().catch((error) => {
  console.error("Error in cleansing process:", error);
});
