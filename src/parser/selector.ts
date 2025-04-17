import * as fs from "fs/promises";
import * as path from "path";

/**
 * Læser indholdet af en fil og returnerer antallet af ord.
 * @param filePath - Fuldt sti til filen.
 * @returns Antal ord i filen.
 */
async function getWordCount(filePath: string): Promise<number> {
  try {
    const text = await fs.readFile(filePath, "utf8");
    const words = text.trim().split(/\s+/);
    return words.filter((word) => word.length > 0).length;
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error);
    return 0;
  }
}

/**
 * Sammenligner OCR-output og native tekst-output for et givet basename.
 * Vælger den fil, der har flest ord, og kopierer den til den endelige output-mappe.
 *
 * @param basename - Grundnavn for filen (uden .txt).
 * @param folderOCR - Mappen, hvor OCR-resultaterne ligger (fx output/pdf_ocr).
 * @param folderText - Mappen, hvor native tekst-resultaterne ligger (fx output/pdf_text).
 * @param folderFinal - Destination, hvor den valgte fil skal placeres (fx output/pdf).
 */
async function selectBestFileForPdf(
  basename: string,
  folderOCR: string,
  folderText: string,
  folderFinal: string
): Promise<void> {
  const fileName = `${basename}.txt`;
  const fileOCR = path.join(folderOCR, fileName);
  const fileText = path.join(folderText, fileName);

  let wordCountOCR = 0;
  let wordCountText = 0;

  try {
    await fs.access(fileOCR);
    wordCountOCR = await getWordCount(fileOCR);
  } catch (error) {
    console.warn(`Filen ${fileName} findes ikke i OCR-output (${folderOCR}).`);
  }

  try {
    await fs.access(fileText);
    wordCountText = await getWordCount(fileText);
  } catch (error) {
    console.warn(
      `Filen ${fileName} findes ikke i native tekst-output (${folderText}).`
    );
  }

  let selectedFile: string;
  if (wordCountOCR >= wordCountText) {
    selectedFile = fileOCR;
    console.log(
      `For ${basename}: OCR output valgt (${wordCountOCR} ord vs. ${wordCountText}).`
    );
  } else {
    selectedFile = fileText;
    console.log(
      `For ${basename}: Native tekst output valgt (${wordCountText} ord vs. ${wordCountOCR}).`
    );
  }

  // Sørg for, at den endelige output-mappe findes, og kopier den valgte fil derhen.
  try {
    await fs.mkdir(folderFinal, { recursive: true });
    const destination = path.join(folderFinal, fileName);
    await fs.copyFile(selectedFile, destination);
    console.log(`Kopieret ${basename}.txt til ${folderFinal}`);
  } catch (error) {
    console.error(
      `Fejl ved kopiering af ${basename}.txt til final output:`,
      error
    );
  }
}

/**
 * Gennemløber output-mapperne (OCR og native) og vælger for hver PDF det bedste output.
 * Det antages, at filerne har samme basenavn i begge mapper.
 */
async function selectBestFiles(): Promise<void> {
  // Angiv stier til de to output-mapper og den endelige output-mappe.
  const folderOCR = path.join(__dirname, "../..", "output", "pdf_ocr");
  const folderText = path.join(__dirname, "../..", "output", "pdf_text");
  const folderFinal = path.join(__dirname, "../..", "output", "pdf");

  // Læs alle txt-filer fra OCR-mappen (som vi forudsætter at har de relevante basenavne)
  let filesOCR: string[] = [];
  try {
    filesOCR = await fs.readdir(folderOCR);
  } catch (error) {
    console.error(`Fejl ved læsning af mappen ${folderOCR}:`, error);
    return;
  }

  // Filtrer for at få kun .txt-filer og udtræk basenavnene.
  const basenames = new Set<string>();
  for (const file of filesOCR) {
    if (path.extname(file).toLowerCase() === ".txt") {
      basenames.add(path.basename(file, ".txt"));
    }
  }

  // Alternativt, læs native-mappen og tilføj basenavnene hvis der mangler
  let filesText: string[] = [];
  try {
    filesText = await fs.readdir(folderText);
  } catch (error) {
    console.warn(`Fejl ved læsning af mappen ${folderText}:`, error);
  }

  for (const file of filesText) {
    if (path.extname(file).toLowerCase() === ".txt") {
      basenames.add(path.basename(file, ".txt"));
    }
  }

  // For hver basis-fil, evaluer og kopier den bedste version.
  for (const basename of basenames) {
    await selectBestFileForPdf(basename, folderOCR, folderText, folderFinal);
  }
}

selectBestFiles().catch((error) => {
  console.error("Error in selection process:", error);
});
