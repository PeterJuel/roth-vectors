import * as fs from "fs/promises";
import * as path from "path";

// Hjælpefunktion: Normaliser URL ved at fjerne "http://" eller "https://"
function canonicalUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").toLowerCase();
}

/**
 * Returnerer true, hvis URL'en skal springes over, dvs. hvis den ender med .jpg, .png, .bin eller .zip.
 * Før udtræk fjernes query-parametre og fragmenter.
 * @param url - URL'en, der skal kontrolleres.
 */
function shouldSkipURL(url: string): boolean {
  const cleanUrl = url.split("?")[0].split("#")[0];
  const ext = path.extname(cleanUrl).toLowerCase();
  return [".jpg", ".png", ".bin", ".zip"].includes(ext);
}

/**
 * Læser og processerer summary.json:
 * - Fjerner dublerede URL'er (hvor både http og https findes, foretrækker https)
 * - Fjerner "images"-feltet, så kun felterne url, title, textFile og pdfs bevares
 * - Filtrerer dokumenter fra, hvis URL'en ender med .jpg, .png, .bin eller .zip.
 * - Fjerner dubletter i "pdfs"-arrayet, og fjerner præfikset "pdfs/" fra hvert element.
 * - Fjerner præfikset "text/" fra feltet textFile.
 * - Skriver det endelige output til output/process.json.
 */
async function processSummary() {
  try {
    const summaryPath = path.join(
      __dirname,
      "..",
      "..",
      "input",
      "summary.json"
    );
    const summaryContent = await fs.readFile(summaryPath, "utf8");
    const documents = JSON.parse(summaryContent) as any[];

    // Dedupliker dokumenterne baseret på canonical URL (prioriterer HTTPS)
    const docMap: Map<string, any> = new Map();
    for (const doc of documents) {
      const canon = canonicalUrl(doc.url);
      if (docMap.has(canon)) {
        const existing = docMap.get(canon);
        if (!existing.url.startsWith("https") && doc.url.startsWith("https")) {
          docMap.set(canon, doc);
        }
      } else {
        docMap.set(canon, doc);
      }
    }

    // Byg et nyt array med kun de ønskede felter, samtidig med at vi fjerner præfikser:
    const processedDocs = Array.from(docMap.values())
      .filter((doc) => !shouldSkipURL(doc.url))
      .map((doc) => ({
        url: doc.url,
        title: doc.title,
        // Fjern "text/" præfikset, hvis det findes
        textFile:
          typeof doc.textFile === "string"
            ? doc.textFile.replace(/^text\//, "")
            : doc.textFile,
        // Fjern dubletter i pdfs-arrayet samt "pdfs/" præfikset
        pdfs: Array.isArray(doc.pdfs)
          ? Array.from(
              new Set(doc.pdfs.map((p: string) => p.replace(/^pdfs\//, "")))
            )
          : [],
      }));

    // Opret final output objekt (uden extensionStats)
    const finalOutput = { documents: processedDocs };

    // Gem output til output/process.json (antaget at output ligger i projektroden)
    const outputPath = path.join(
      __dirname,
      "..",
      "..",
      "output",
      "process.json"
    );
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(
      outputPath,
      JSON.stringify(finalOutput, null, 2),
      "utf8"
    );
    console.log(`Processed summary saved to ${outputPath}`);
  } catch (error) {
    console.error("Error processing summary.json:", error);
  }
}

processSummary();
