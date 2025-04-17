import * as fs from "fs/promises";
import * as path from "path";

interface Chunk {
  chunkNumber: number;
  cleanedText: string;
  // Additional keys can be present.
}

interface GroupedJSON {
  chunks: Chunk[];
}

// Files follow the pattern: "<baseName>-<chunkNumber>.json"
// For example: "Brochure_ny_opgraderet_Touchline_SL_20231128_web.pdf-1.json"
const FILE_REGEX = /^(.*)-(\d+)\.json$/;

async function main() {
  // Define folder paths.
  const inputFolder = path.join(__dirname, "..", "..", "output", "clean");
  const outputFolder = path.join(
    __dirname,
    "..",
    "..",
    "output",
    "clean_stiched"
  );

  // Ensure the output folder exists.
  await fs.mkdir(outputFolder, { recursive: true });

  // Read all files from the input folder.
  let fileNames: string[];
  try {
    fileNames = await fs.readdir(inputFolder);
  } catch (error) {
    console.error("Error reading input folder:", error);
    return;
  }

  // Group files by their base name.
  const groups: Map<string, { fileName: string; chunkNum: number }[]> =
    new Map();
  for (const file of fileNames) {
    const match = file.match(FILE_REGEX);
    if (!match) {
      console.warn(
        `File "${file}" does not match the expected pattern and will be skipped.`
      );
      continue;
    }
    const baseName = match[1]; // e.g. "Brochure_ny_opgraderet_Touchline_SL_20231128_web.pdf"
    const chunkNum = parseInt(match[2], 10);
    if (!groups.has(baseName)) {
      groups.set(baseName, []);
    }
    groups.get(baseName)!.push({ fileName: file, chunkNum });
  }

  // Object to store metadata for stitched files.
  const stitchMetadata: { [finalFileName: string]: { length: number } } = {};

  // Process each group: sort by original chunk number, merge chunks, re-index them.
  for (const [baseName, files] of groups.entries()) {
    // Sort the group's files in ascending order of chunkNum.
    files.sort((a, b) => a.chunkNum - b.chunkNum);
    let mergedChunks: Chunk[] = [];

    // Loop through each file in the group and merge their chunks.
    for (const fileInfo of files) {
      const fullPath = path.join(inputFolder, fileInfo.fileName);
      let fileContent: string;
      try {
        fileContent = await fs.readFile(fullPath, "utf8");
      } catch (error) {
        console.error(`Error reading file ${fileInfo.fileName}:`, error);
        continue;
      }
      let jsonData: GroupedJSON;
      try {
        jsonData = JSON.parse(fileContent);
      } catch (error) {
        console.error(
          `Error parsing JSON in file ${fileInfo.fileName}:`,
          error
        );
        continue;
      }

      if (Array.isArray(jsonData.chunks)) {
        mergedChunks.push(...jsonData.chunks);
      } else {
        console.warn(
          `File ${fileInfo.fileName} does not contain a "chunks" array.`
        );
      }
    }

    // Re-index chunks sequentially.
    mergedChunks = mergedChunks.map((chunk, index) => ({
      ...chunk,
      chunkNumber: index + 1,
    }));

    // Determine the final output file name.
    // If there's only one file in the group, we remove a trailing "-1" automatically by using the baseName.
    // Regardless, the final file name must end with ".txt".
    let finalFileName = baseName;
    if (!finalFileName.toLowerCase().endsWith(".txt")) {
      finalFileName += ".txt";
    }

    // Prepare the final JSON object.
    const finalJSON = { chunks: mergedChunks };
    const outputFilePath = path.join(outputFolder, finalFileName);

    try {
      await fs.writeFile(
        outputFilePath,
        JSON.stringify(finalJSON, null, 2),
        "utf8"
      );
      console.log(
        `Merged file saved as ${finalFileName} with ${mergedChunks.length} chunk(s).`
      );
      stitchMetadata[finalFileName] = {
        length: JSON.stringify(finalJSON).length,
      };
    } catch (error) {
      console.error(`Error writing merged file for ${baseName}:`, error);
    }
  }

  // Save the metadata as "stichfile.json" in the output folder.
  const metadataOutputPath = path.join(
    path.dirname(outputFolder),
    "stichfile.json"
  );
  try {
    await fs.writeFile(
      metadataOutputPath,
      JSON.stringify(stitchMetadata, null, 2),
      "utf8"
    );
    console.log(`Stitch metadata saved as ${metadataOutputPath}`);
  } catch (error) {
    console.error(
      `Error writing stitch metadata to ${metadataOutputPath}:`,
      error
    );
  }
}

main().catch((error) => {
  console.error("Error in stitching process:", error);
});
