import * as fs from "fs/promises";
import * as path from "path";

interface ChunkInfo {
  fileName: string;
  chunk: number;
}

interface StitchFileMetadata {
  [originalName: string]: { length: number };
}

async function main() {
  // Define folder paths.
  const cleansedFolder = path.join(__dirname, "..", "..", "output", "cleansed");
  const stitchedFolder = path.join(
    __dirname,
    "..",
    "..",
    "output",
    "cleansed_stiched"
  );
  const outputJsonPath = path.join(
    __dirname,
    "..",
    "..",
    "output",
    "stichfile.json"
  );

  // Ensure the stitched output folder exists.
  await fs.mkdir(stitchedFolder, { recursive: true });

  // Read all files from the cleansed folder.
  let fileNames: string[] = [];
  try {
    fileNames = await fs.readdir(cleansedFolder);
  } catch (error) {
    console.error("Error reading cleansed folder:", error);
    return;
  }

  // Group files by their original base name.
  // This regex assumes files are named like: "SomeFileName.pdf-1.txt" or "document.txt-2.txt".
  // It captures the original base name (everything before the final dash) and the chunk number.
  const groups: Map<string, ChunkInfo[]> = new Map();
  const regex = /^(.*)-(\d+)\.txt$/;
  for (const file of fileNames) {
    const match = file.match(regex);
    if (match) {
      const baseName = match[1]; // e.g., "Byt_til_nyt_A5_web.pdf" or "cases_45-aar-gammel-villa.txt"
      const chunkNum = parseInt(match[2], 10);
      if (!groups.has(baseName)) {
        groups.set(baseName, []);
      }
      groups.get(baseName)!.push({ fileName: file, chunk: chunkNum });
    } else {
      console.warn(
        `File "${file}" does not match the expected naming pattern and will be skipped.`
      );
    }
  }

  // Object to store metadata for stitched files.
  const stitchMetadata: StitchFileMetadata = {};

  // For each group, sort by chunk number, stitch the contents, and save using the original base name with a .txt extension.
  for (const [baseName, files] of groups.entries()) {
    // Sort files numerically by chunk.
    files.sort((a, b) => a.chunk - b.chunk);
    let stitchedText = "";
    for (const fileInfo of files) {
      const filePath = path.join(cleansedFolder, fileInfo.fileName);
      try {
        const content = await fs.readFile(filePath, "utf8");
        stitchedText += content + "\n"; // Append newline between chunks.
      } catch (error) {
        console.error(`Error reading file ${fileInfo.fileName}:`, error);
      }
    }

    // Prepend a header containing the original file name without extension.
    // Using path.parse to remove the extension.
    const parsed = path.parse(baseName);
    const header = parsed.name; // For example, "Byt_til_nyt_A5_web" instead of "Byt_til_nyt_A5_web.pdf"
    stitchedText = header + "\n\n" + stitchedText;

    // Determine the output file name. Append ".txt" if it is not already included.
    let outputFileName = baseName;
    if (!outputFileName.toLowerCase().endsWith(".txt")) {
      outputFileName += ".txt";
    }
    const outputFilePath = path.join(stitchedFolder, outputFileName);
    try {
      await fs.writeFile(outputFilePath, stitchedText, "utf8");
      console.log(`Stitched file saved as ${outputFileName}`);
      // Record the length (character count) of the stitched text.
      stitchMetadata[outputFileName] = { length: stitchedText.length };
    } catch (error) {
      console.error(
        `Error writing stitched file for ${outputFileName}:`,
        error
      );
    }
  }

  // Save the metadata as stichfile.json in the output folder.
  try {
    await fs.writeFile(
      outputJsonPath,
      JSON.stringify(stitchMetadata, null, 2),
      "utf8"
    );
    console.log(`Stitch metadata saved as ${outputJsonPath}`);
  } catch (error) {
    console.error(`Error writing stitch metadata to ${outputJsonPath}:`, error);
  }
}

main().catch((error) => {
  console.error("Error in stitching process:", error);
});
