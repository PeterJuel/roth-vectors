import * as fs from "fs/promises";
import * as path from "path";
import pdfParse from "pdf-parse";

export async function processPdfText(
  inputFilePath: string,
  outputFolder: string
): Promise<void> {
  try {
    const dataBuffer = await fs.readFile(inputFilePath);
    const pdfData = await pdfParse(dataBuffer);
    const extractedText = pdfData.text;
    const baseName = path.basename(inputFilePath, path.extname(inputFilePath));
    const outputFilePath = path.join(outputFolder, `${baseName}.txt`);
    await fs.writeFile(outputFilePath, extractedText, "utf8");
    console.log(
      `Processed with pdf-parse: ${inputFilePath} -> ${outputFilePath}`
    );
  } catch (error) {
    console.error(`Error processing PDF ${inputFilePath}:`, error);
  }
}
