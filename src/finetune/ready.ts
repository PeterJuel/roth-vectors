import * as fs from "fs/promises";
import * as path from "path";

interface DocumentEntry {
  url: string;
  title: string;
  textFile: string;
  pdfs: string[];
}

interface ProcessJSON {
  documents: DocumentEntry[];
}

interface FileContent {
  chunks: any[];
  url?: string;
  title?: string;
  fullUrl?: string;
  fullTitle?: string;
  // additional keys can be present
}

// Helper function to load full links from pdf-full-links.json
async function loadPdfFullLinks(): Promise<any[]> {
  const pdfFullLinksPath = path.join(
    __dirname,
    "..",
    "..",
    "input",
    "pdf-full-links.json"
  );
  try {
    const content = await fs.readFile(pdfFullLinksPath, "utf8");
    return JSON.parse(content);
  } catch (error) {
    console.error("Error reading pdf-full-links.json:", error);
    return [];
  }
}

async function main() {
  const processPath = path.join(
    __dirname,
    "..",
    "..",
    "output",
    "process.json"
  );
  const inputFolder = path.join(
    __dirname,
    "..",
    "..",
    "output",
    "clean_stiched"
  );
  const readyFolder = path.join(__dirname, "..", "..", "output", "ready");

  // Ensure the ready folder exists.
  await fs.mkdir(readyFolder, { recursive: true });

  // Load process.json
  let processData: ProcessJSON;
  try {
    const processContent = await fs.readFile(processPath, "utf8");
    processData = JSON.parse(processContent);
  } catch (error) {
    console.error("Error reading or parsing process.json:", error);
    return;
  }

  // Load full PDF links from pdf-full-links.json
  const pdfFullLinks = await loadPdfFullLinks();

  // Read all files from output/clean_stiched
  let fileNames: string[];
  try {
    fileNames = await fs.readdir(inputFolder);
  } catch (error) {
    console.error("Error reading clean_stiched folder:", error);
    return;
  }

  for (const fileName of fileNames) {
    const inputFilePath = path.join(inputFolder, fileName);
    let fileContentStr: string;
    try {
      fileContentStr = await fs.readFile(inputFilePath, "utf8");
    } catch (error) {
      console.error(`Error reading file ${fileName}:`, error);
      continue;
    }

    let fileJSON: FileContent;
    try {
      fileJSON = JSON.parse(fileContentStr);
    } catch (error) {
      console.error(`Error parsing JSON from file ${fileName}:`, error);
      continue;
    }

    // Check if the file is a PDF and look up the fullUrl and fullTitle
    if (fileName.endsWith(".pdf.txt")) {
      const pdfName = fileName.replace(".txt", "");
      const pdfLink = pdfFullLinks.find((link) => link.pdf === pdfName);

      if (pdfLink) {
        // Set the fullUrl and fullTitle
        fileJSON.fullUrl = pdfLink.fullUrl;
        fileJSON.fullTitle = pdfName;
      } else {
        console.warn(`No full URL found for PDF: ${pdfName}`);
      }
    }

    // Create lookup keys:
    // lookupKeyExact: file name as-is (lowercase).
    // lookupKeyNoTxt: file name with trailing ".txt" removed, if present.
    const lookupKeyExact = fileName.toLowerCase();
    const lookupKeyNoTxt = lookupKeyExact.endsWith(".txt")
      ? lookupKeyExact.substring(0, lookupKeyExact.length - 4)
      : lookupKeyExact;

    // Initialize variables to store the matching URL and title.
    let matchUrl: string | undefined;
    let matchTitle: string | undefined;

    // Search in the process documents.
    for (const doc of processData.documents) {
      // First, check the textFile field.
      if (doc.textFile && doc.textFile.toLowerCase() === lookupKeyExact) {
        matchUrl = doc.url;
        matchTitle = doc.title;
        break;
      }
      // Next, check in the pdfs array.
      if (doc.pdfs && Array.isArray(doc.pdfs)) {
        for (const pdfEntry of doc.pdfs) {
          // For PDF entries, remove any ".txt" extension if present.
          let pdfLookup = pdfEntry.toLowerCase();
          if (pdfLookup.endsWith(".txt")) {
            pdfLookup = pdfLookup.substring(0, pdfLookup.length - 4);
          }
          if (pdfLookup === lookupKeyNoTxt) {
            matchUrl = doc.url;
            matchTitle = doc.title;
            break;
          }
        }
        if (matchUrl) {
          break;
        }
      }
    }

    if (!matchUrl || !matchTitle) {
      console.warn(`No matching document found for file ${fileName}.`);
      continue;
    }

    // Update the JSON object with found metadata.
    fileJSON.url = matchUrl;
    fileJSON.title = matchTitle;

    // Save the updated JSON to output/ready with the same file name.
    const outputFilePath = path.join(readyFolder, fileName);
    try {
      await fs.writeFile(
        outputFilePath,
        JSON.stringify(fileJSON, null, 2),
        "utf8"
      );
      console.log(
        `Updated file ${fileName} with metadata and saved to ready folder.`
      );
    } catch (error) {
      console.error(`Error writing updated file ${fileName}:`, error);
    }
  }
}

main().catch((error) => {
  console.error("Error in metadata attachment process:", error);
});
