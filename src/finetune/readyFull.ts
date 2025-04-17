import * as fs from "fs/promises";
import * as path from "path";

async function updateFilesInReadyFolder() {
  const readyFolder = path.join(__dirname, "..", "..", "output", "ready");

  // Read all files in the ready folder
  let fileNames: string[];
  try {
    fileNames = await fs.readdir(readyFolder);
  } catch (error) {
    console.error("Error reading ready folder:", error);
    return;
  }

  for (const fileName of fileNames) {
    const filePath = path.join(readyFolder, fileName);
    let fileContentStr: string;
    try {
      fileContentStr = await fs.readFile(filePath, "utf8");
    } catch (error) {
      console.error(`Error reading file ${fileName}:`, error);
      continue;
    }

    let fileJSON: any;
    try {
      fileJSON = JSON.parse(fileContentStr);
    } catch (error) {
      console.error(`Error parsing JSON from file ${fileName}:`, error);
      continue;
    }

    // If both fullUrl and fullTitle are present, replace url and title, then remove fullUrl and fullTitle
    if (fileJSON.fullUrl && fileJSON.fullTitle) {
      fileJSON.url = fileJSON.fullUrl;
      fileJSON.title = fileJSON.fullTitle;

      // Remove fullUrl and fullTitle
      delete fileJSON.fullUrl;
      delete fileJSON.fullTitle;

      // Save the updated JSON to the same file
      try {
        await fs.writeFile(filePath, JSON.stringify(fileJSON, null, 2), "utf8");
        console.log(
          `Updated file ${fileName} with fullUrl and fullTitle replaced.`
        );
      } catch (error) {
        console.error(`Error writing updated file ${fileName}:`, error);
      }
    }
  }
}

updateFilesInReadyFolder().catch((error) => {
  console.error("Error in updating files:", error);
});
