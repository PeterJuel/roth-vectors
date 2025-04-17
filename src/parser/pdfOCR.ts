import * as fs from "fs/promises";
import * as path from "path";
import { fromPath } from "pdf2pic";
import { createWorker } from "tesseract.js";

/**
 * Konverterer en PDF-fil til billeder ved hjælp af pdf2pic.
 * @param pdfPath - Fuldt filsti til PDF-filen.
 * @param tempOutputFolder - Mappen, hvor de konverterede billeder gemmes midlertidigt.
 * @returns En liste af stier til de genererede billedfiler.
 */
async function convertPdfToImages(
  pdfPath: string,
  tempOutputFolder: string
): Promise<string[]> {
  await fs.mkdir(tempOutputFolder, { recursive: true });

  const options = {
    density: 150,
    saveFilename: "page",
    savePath: tempOutputFolder,
    format: "png",
    width: 1200,
    height: 1600,
  };

  const converter = fromPath(pdfPath, options);
  const result = await converter.bulk(-1); // Konverterer alle sider
  return result.map((r: any) => r.path);
}

/**
 * Udfører OCR på en liste af billeder med tesseract.js og returnerer den samlede tekst.
 * I den nyeste tesseract.js (v6) kommer workeren pre-loaded, så vi angiver blot sproget
 * direkte i recognize()-kaldet.
 * @param imagePaths - Liste af stier til billede-filer.
 * @returns Samlet tekst fra alle billeder.
 */
async function extractTextFromImages(imagePaths: string[]): Promise<string> {
  const worker = (await createWorker()) as any;

  let allText = "";
  for (const imagePath of imagePaths) {
    console.log(`Running OCR on image: ${imagePath}`);
    // Sproget specificeres direkte som parameter, fx "eng" – skift til "dan" for dansk.
    const {
      data: { text },
    } = await worker.recognize(imagePath, "eng");
    allText += text + "\n";
  }
  await worker.terminate();
  return allText;
}

/**
 * Sletter alt indhold i en given mappe.
 * @param folderPath - Stien til mappen, der skal ryddes.
 */
async function deleteFolderContents(folderPath: string): Promise<void> {
  try {
    const files = await fs.readdir(folderPath);
    await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(folderPath, file);
        await fs.rm(filePath, { recursive: true, force: true });
      })
    );
  } catch (error) {
    console.error(`Error deleting folder contents of ${folderPath}:`, error);
  }
}

/**
 * Processerer en PDF-fil med OCR:
 * 1. Konverterer PDF'en til billeder.
 * 2. Kører OCR på hver side.
 * 3. Gemmer den samlede OCR-tekst i output-folderen (pdf_ocr).
 * 4. Rydder de midlertidige billeder.
 *
 * @param pdfPath - Fuldt filsti til PDF.
 * @param outputFolder - Destination for OCR-output (fx output/pdf_ocr).
 */
export async function processPdfWithOCR(
  pdfPath: string,
  outputFolder: string
): Promise<void> {
  try {
    await fs.mkdir(outputFolder, { recursive: true });
    const tempImageFolder = path.join(outputFolder, "temp-ocr");
    await fs.mkdir(tempImageFolder, { recursive: true });

    const imagePaths = await convertPdfToImages(pdfPath, tempImageFolder);
    console.log(`Converted PDF to images:`, imagePaths);

    const extractedText = await extractTextFromImages(imagePaths);
    const baseName = path.basename(pdfPath, path.extname(pdfPath));
    const outputFilePath = path.join(outputFolder, `${baseName}.txt`);
    await fs.writeFile(outputFilePath, extractedText, "utf8");
    console.log(`OCR Processed: ${pdfPath} -> ${outputFilePath}`);

    await deleteFolderContents(tempImageFolder);
    await fs.rmdir(tempImageFolder);
  } catch (error) {
    console.error(`Error processing PDF with OCR ${pdfPath}:`, error);
  }
}
