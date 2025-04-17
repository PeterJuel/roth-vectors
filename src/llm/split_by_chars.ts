import * as fs from "fs/promises";
import * as path from "path";

async function main() {
  const inputFolder = path.join(
    __dirname,
    "..",
    "..",
    "output",
    "cleansed_stiched"
  );
  const outputFolder = path.join(
    __dirname,
    "..",
    "..",
    "output",
    "cleaned_split"
  );

  // Ensure the output folder exists.
  await fs.mkdir(outputFolder, { recursive: true });

  // Read all stitched files from the input folder.
  let fileNames: string[] = [];
  try {
    fileNames = await fs.readdir(inputFolder);
  } catch (error) {
    console.error("Error reading cleansed_stiched folder:", error);
    return;
  }

  const CHUNK_SIZE = 10000; // maximum characters per chunk
  const OVERLAP = 200; // number of characters to overlap between chunks

  for (const fileName of fileNames) {
    const filePath = path.join(inputFolder, fileName);
    let content: string = "";
    try {
      content = await fs.readFile(filePath, "utf8");
    } catch (error) {
      console.error(`Error reading file ${fileName}:`, error);
      continue;
    }

    // Extract the base filename without extension (for header and naming).
    const parsed = path.parse(fileName);
    const baseNameWithoutExt = parsed.name; // e.g. "Byt_til_nyt_A5_web" from "Byt_til_nyt_A5_web.pdf.txt"

    // Prepare to split into chunks with overlap.
    const chunks: string[] = [];
    let startIndex = 0;
    while (startIndex < content.length) {
      // Extract chunk of up to CHUNK_SIZE characters.
      let chunk = content.substring(startIndex, startIndex + CHUNK_SIZE);
      // For subsequent chunks (not the first), mark the overlap region.
      if (startIndex > 0) {
        const overlapText = chunk.substring(0, OVERLAP);
        // Insert markers around the first OVERLAP characters.
        chunk =
          "=== OVERLAP_START ===\n" +
          overlapText +
          "\n=== OVERLAP_END ===\n" +
          chunk.substring(OVERLAP);
      }
      chunks.push(chunk);
      // Advance index such that each new chunk overlaps the previous chunk by OVERLAP characters.
      startIndex += CHUNK_SIZE - OVERLAP;
    }

    // Save each chunk.
    for (let i = 0; i < chunks.length; i++) {
      const chunkNumber = i + 1;
      // Prepend a header with the original base filename (without extension).
      const header = baseNameWithoutExt + "\n\n";
      const chunkContent = header + chunks[i];
      const outputFileName = `${baseNameWithoutExt}-${chunkNumber}.txt`;
      const outputFilePath = path.join(outputFolder, outputFileName);
      try {
        await fs.writeFile(outputFilePath, chunkContent, "utf8");
        console.log(
          `Wrote ${outputFileName} (length: ${chunkContent.length} characters)`
        );
      } catch (error) {
        console.error(`Error writing file ${outputFileName}:`, error);
      }
    }
  }
}

main().catch((error) => {
  console.error("Error in splitting process:", error);
});
