import * as fs from "fs/promises";
import * as path from "path";
import { processPdfWithOCR } from "./pdfOCR";
import { processPdfText } from "./pdfTextParser";

/**
 * Sletter alt indhold i en given mappe.
 * @param folderPath - Stien til mappen, som skal ryddes.
 */
async function clearFolder(folderPath: string): Promise<void> {
  try {
    await fs.mkdir(folderPath, { recursive: true });
    const files = await fs.readdir(folderPath);
    await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(folderPath, file);
        await fs.rm(filePath, { recursive: true, force: true });
      })
    );
    console.log(`Cleared folder: ${folderPath}`);
  } catch (error) {
    console.error(`Error clearing folder ${folderPath}:`, error);
  }
}

async function main() {
  // Ændr stien: Hvis din "input" mappe ligger i roden af projektet (samme niveau som "src")
  // skal vi gå 2 niveauer op fra "src/parser".
  const inputFolder = path.join(__dirname, "..", "..", "input", "pdfs");
  const outputFolderOCR = path.join(__dirname, "..", "..", "output", "pdf_ocr");
  const outputFolderText = path.join(
    __dirname,
    "..",
    "..",
    "output",
    "pdf_text"
  );

  // Ryd de to output-folderne, inden behandling
  await clearFolder(outputFolderOCR);
  await clearFolder(outputFolderText);

  // Sæt fil til behandling - hvis "ALL", behandles alle PDF-filer, ellers kun den angivne.
  const fileToProcess: string = "ALL"; // eller "ALL"
  let filesToProcess: string[] = [];

  if (fileToProcess === "ALL") {
    const allFiles = await fs.readdir(inputFolder);
    filesToProcess = allFiles.filter(
      (file) => path.extname(file).toLowerCase() === ".pdf"
    );
  } else {
    filesToProcess = [fileToProcess];
  }

  // Processer hver PDF-fil
  for (const file of filesToProcess) {
    const pdfPath = path.join(inputFolder, file);
    console.log(`Processing file: ${file}`);

    // Kør OCR-baseret udtrækning og gem i pdf_ocr mappen
    try {
      await processPdfWithOCR(pdfPath, outputFolderOCR);
    } catch (err) {
      console.error(`OCR processing failed for ${file}:`, err);
    }

    // Kør native tekstudtrækning og gem i pdf_text mappen
    try {
      await processPdfText(pdfPath, outputFolderText);
    } catch (err) {
      console.error(`Native text extraction failed for ${file}:`, err);
    }
  }
}

main();
