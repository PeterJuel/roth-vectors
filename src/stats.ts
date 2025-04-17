import * as fs from "fs";
import * as path from "path";

const MAX_ITEMS_PER_FOLDER = 20;
const MAX_JSON_PREVIEW_LINES = 100;
const MAX_JSON_ARRAY_PREVIEW_ITEMS = 2;

// Global tæller for filtyper
const fileTypeCounts: { [extension: string]: number } = {};

/**
 * Opdater tælleren for en given fil baseret på dens extension
 * @param filename - Filnavn
 */
function countFile(filename: string) {
  const ext = path.extname(filename).toLowerCase() || "no-extension";
  fileTypeCounts[ext] = (fileTypeCounts[ext] || 0) + 1;
}

/**
 * Forsøger at læse en JSON-fil og vise de første MAX_JSON_ARRAY_PREVIEW_ITEMS elementer,
 * hvis filen er et JSON-array. Hvis det fejler, vises de første MAX_JSON_PREVIEW_LINES linjer.
 *
 * @param filePath - Den fulde sti til JSON-filen.
 */
function showJsonPreview(filePath: string): void {
  console.log(`\n--- JSON-preview af ${filePath} ---`);

  try {
    const content = fs.readFileSync(filePath, "utf8");

    // Forsøg at parse JSON-indholdet
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      console.error(
        `JSON parsing fejlede for ${filePath}, viser raw tekst i stedet:`
      );
      parsed = null;
    }

    if (Array.isArray(parsed)) {
      console.log(
        `Første ${MAX_JSON_ARRAY_PREVIEW_ITEMS} elementer af JSON-arrayet:`
      );
      parsed
        .slice(0, MAX_JSON_ARRAY_PREVIEW_ITEMS)
        .forEach((element, index) => {
          console.log(
            `Element ${index + 1}:`,
            JSON.stringify(element, null, 2)
          );
        });
    } else if (parsed !== null) {
      // Hvis det ikke er en array, men et objekt
      console.log("Parsed JSON objekt:");
      console.log(JSON.stringify(parsed, null, 2));
    } else {
      // Hvis parsing fejlede, fallback til raw tekst preview (100 linjer)
      const lines = content.split(/\r?\n/);
      const previewLines = lines.slice(0, MAX_JSON_PREVIEW_LINES);
      previewLines.forEach((line, index) => {
        console.log(`${index + 1}: ${line}`);
      });
      if (lines.length > MAX_JSON_PREVIEW_LINES) {
        console.log(
          `... (${lines.length - MAX_JSON_PREVIEW_LINES} flere linjer)`
        );
      }
    }
  } catch (error) {
    console.error(`Fejl ved læsning af ${filePath}:`, error);
  }
}

/**
 * Rekursiv funktion til at gennemløbe en mappe, udskrive strukturen (maks. MAX_ITEMS_PER_FOLDER pr. mappe)
 * og vise JSON previews for JSON-filer.
 *
 * @param folder - Den mappe, der skal gennemgås.
 * @param indent - Indrykning for udskrift.
 */
function traverseFolder(folder: string, indent: string = ""): void {
  let items: fs.Dirent[];
  try {
    items = fs.readdirSync(folder, { withFileTypes: true });
  } catch (err) {
    console.error(`Fejl ved læsning af mappe ${folder}:`, err);
    return;
  }

  console.log(`${indent}${path.basename(folder)}/`);

  // Tæl alle elementer i mappen
  items.forEach((item) => {
    const fullPath = path.join(folder, item.name);
    if (item.isDirectory()) {
      traverseFolder(fullPath, indent + "  ");
    } else {
      countFile(item.name);
    }
  });

  // Vis de første MAX_ITEMS_PER_FOLDER elementer for visning
  const displayItems = items.slice(0, MAX_ITEMS_PER_FOLDER);
  displayItems.forEach((item) => {
    const fullPath = path.join(folder, item.name);
    if (item.isDirectory()) {
      console.log(`${indent}  [DIR] ${item.name}/`);
    } else {
      console.log(`${indent}  ${item.name}`);
      // Hvis filen er en JSON-fil, vis dens preview (kun første 2 array-elementer)
      if (path.extname(item.name).toLowerCase() === ".json") {
        showJsonPreview(fullPath);
      }
    }
  });

  if (items.length > MAX_ITEMS_PER_FOLDER) {
    console.log(
      `${indent}  ... (${items.length - MAX_ITEMS_PER_FOLDER} flere elementer)`
    );
  }
}

/**
 * Hovedfunktionen: Sætter stien til input-mappen og kører gennemløbning og udskrift af statistik.
 */
function main() {
  // Juster stien til din input-mappe – her antages mappen "input" ligger ét niveau op fra "src"
  const inputFolder = path.join(__dirname, "..", "input");

  console.log(`Mappestruktur for '${inputFolder}':\n`);
  traverseFolder(inputFolder);

  console.log("\nFiltype-statistik (tæller alle filer):");
  for (const ext in fileTypeCounts) {
    console.log(`  ${ext}: ${fileTypeCounts[ext]}`);
  }
}

main();
