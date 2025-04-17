import * as fs from "fs/promises";
import * as path from "path";

async function generateFileList() {
  try {
    // Read process.json (assumed to be in the output folder at the project root)
    const processPath = path.join(
      __dirname,
      "..",
      "..",
      "output",
      "process.json"
    );
    const processContent = await fs.readFile(processPath, "utf8");
    const data = JSON.parse(processContent);

    // Build a fileMap from documents in process.json
    // Each key is the file name and the value contains type info (and later length)
    const fileMap: { [filename: string]: { type: string; length?: number } } =
      {};

    if (data.documents && Array.isArray(data.documents)) {
      for (const doc of data.documents) {
        // Handle the textFile field (assumed to be in input/text)
        if (typeof doc.textFile === "string") {
          const filename = doc.textFile.trim();
          fileMap[filename] = { type: "text" };
        }
        // Handle the pdfs array; these files (originally PDFs) have been converted
        // to text and are located in output/pdf with a .txt extension.
        if (Array.isArray(doc.pdfs)) {
          for (const pdfPath of doc.pdfs) {
            const filename = pdfPath.trim();
            fileMap[filename] = { type: "pdf" };
          }
        }
      }
    }

    // For each file entry, calculate its character length.
    // For text files: located in input/text folder.
    // For pdf files: located in output/pdf with the extension replaced to .txt.
    const fileEntries = Object.entries(fileMap);
    for (const [filename, fileInfo] of fileEntries) {
      let filePath: string;
      if (fileInfo.type === "text") {
        filePath = path.join(__dirname, "..", "..", "input", "text", filename);
      } else if (fileInfo.type === "pdf") {
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
        continue;
      }

      try {
        const content = await fs.readFile(filePath, "utf8");
        fileInfo.length = content.length;
      } catch (err) {
        console.warn(
          `Could not read file ${filePath} to determine length:`,
          err
        );
        fileInfo.length = 0;
      }
    }

    // Save the resulting file map to output/files.json
    const outputPath = path.join(__dirname, "..", "..", "output", "files.json");
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify(fileMap, null, 2), "utf8");
    console.log(`Unique file list with lengths saved to ${outputPath}`);
  } catch (error) {
    console.error("Error generating file list:", error);
  }
}

generateFileList();
