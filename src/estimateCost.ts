import * as fs from "fs/promises";
import * as path from "path";

interface FileInfo {
  type: string;
  length: number;
}

interface FilesMap {
  [filename: string]: FileInfo;
}

async function main() {
  // Read the files.json from the output folder.
  const filesJsonPath = path.join(__dirname, "..", "output", "files.json");
  let fileMap: FilesMap;

  try {
    const jsonStr = await fs.readFile(filesJsonPath, "utf8");
    fileMap = JSON.parse(jsonStr);
  } catch (error) {
    console.error("Error reading files.json:", error);
    return;
  }

  // Sum total characters across all files.
  let totalCharacters = 0;
  for (const file in fileMap) {
    totalCharacters += fileMap[file].length;
  }

  // Heuristic: assume an average of 4 characters per token.
  const totalTokens = totalCharacters / 4;

  // Pricing (per 1,000,000 tokens)
  // For gpt-4o: Input = $2.50, Output = $10.00 => Total = $12.50
  // For gpt-4o-mini: Input = $0.15, Output = $0.60 => Total = $0.75
  const costPerMillionTokens_GPT4o = 12.5;
  const costPerMillionTokens_GPT4oMini = 0.75;

  const estimatedCost_GPT4o =
    (totalTokens / 1_000_000) * costPerMillionTokens_GPT4o;
  const estimatedCost_GPT4oMini =
    (totalTokens / 1_000_000) * costPerMillionTokens_GPT4oMini;

  console.log("==== Cost Estimate ====");
  console.log(`Total characters: ${totalCharacters}`);
  console.log(`Estimated total tokens (approx.): ${Math.round(totalTokens)}`);
  console.log("\n--- GPT-4o Cost Estimate ---");
  console.log(
    `Estimated cost: $${estimatedCost_GPT4o.toFixed(2)} per million tokens`
  );
  console.log("\n--- GPT-4o-mini Cost Estimate ---");
  console.log(
    `Estimated cost: $${estimatedCost_GPT4oMini.toFixed(2)} per million tokens`
  );
}

main().catch((error) => {
  console.error("Error in cost estimation:", error);
});
