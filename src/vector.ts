import * as fs from "fs/promises";
import * as path from "path";
import * as dotenv from "dotenv";
import pLimit from "p-limit";
dotenv.config();

// ----- Configuration Settings -----
const FILE_PROCESS_LIMIT: number = 20; // Process 10 files at a time
const CONCURRENCY_LIMIT: number = 2; // Maximum number of concurrent file processing requests.
const OPENAI_EMBEDDING_MODEL = "text-embedding-3-large"; // Using the specified embedding model
const TOTAL_FILE_LIMIT: number = 80; // Limit to 80 total files processed across all runs

// Pinecone settings read from environment variables:
const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_INDEX = process.env.PINECONE_INDEX;
const PINECONE_ENVIRONMENT = process.env.PINECONE_ENVIRONMENT;

if (
  !process.env.OPENAI_API_KEY ||
  !PINECONE_API_KEY ||
  !PINECONE_INDEX ||
  !PINECONE_ENVIRONMENT
) {
  throw new Error(
    "One or more required env variables (OPENAI_API_KEY, PINECONE_API_KEY, PINECONE_INDEX, PINECONE_ENVIRONMENT) are missing."
  );
}

// Folder paths:
const readyFolder = path.join(__dirname, "..", "output", "ready");
const processedFilesPath = path.join(
  __dirname,
  "..",
  "output",
  "processed_files.json"
);

// Construct Pinecone upsert endpoint URL, for example:
// https://<INDEX>.<ENVIRONMENT>.pinecone.io/vectors/upsert
const pineconeUrl = `https://${PINECONE_INDEX}.${PINECONE_ENVIRONMENT}.pinecone.io/vectors/upsert`;

// ----- Helper functions -----
async function loadProcessedFiles(): Promise<Set<string>> {
  try {
    const content = await fs.readFile(processedFilesPath, "utf8");
    const processedFiles = JSON.parse(content);
    return new Set(processedFiles);
  } catch (error) {
    console.error("Error reading processed files log:", error);
    return new Set();
  }
}

async function saveProcessedFiles(processedFiles: Set<string>): Promise<void> {
  try {
    const processedFilesArray = Array.from(processedFiles);
    await fs.writeFile(
      processedFilesPath,
      JSON.stringify(processedFilesArray, null, 2),
      "utf8"
    );
    console.log("Processed files log updated.");
  } catch (error) {
    console.error("Error saving processed files log:", error);
  }
}

async function getEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  const requestBody = {
    model: OPENAI_EMBEDDING_MODEL,
    input: text,
  };

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(
      `OpenAI Embedding API error: ${response.status} ${response.statusText}: ${errText}`
    );
  }

  const responseData = await response.json();
  // Assuming responseData.data is an array of objects with an "embedding" field.
  if (
    responseData.data &&
    Array.isArray(responseData.data) &&
    responseData.data.length > 0
  ) {
    return responseData.data[0].embedding;
  }
  throw new Error("Unexpected response from OpenAI Embedding API.");
}

async function upsertVectors(vectors: any[]): Promise<void> {
  const requestBody = { vectors };

  const response = await fetch(pineconeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Api-Key": PINECONE_API_KEY as string,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(
      `Pinecone upsert error: ${response.status} ${response.statusText}: ${errText}`
    );
  }
  console.log(`Successfully upserted ${vectors.length} vectors into Pinecone.`);
}

// ----- Process files -----
async function processFile(fileName: string): Promise<any[]> {
  const filePath = path.join(readyFolder, fileName);
  let fileContentStr: string;
  try {
    fileContentStr = await fs.readFile(filePath, "utf8");
  } catch (error) {
    console.error(`Error reading file ${fileName}:`, error);
    return [];
  }

  let fileJSON: any;
  try {
    fileJSON = JSON.parse(fileContentStr);
  } catch (error) {
    console.error(`Error parsing JSON in file ${fileName}:`, error);
    return [];
  }

  const vectors: any[] = [];
  const baseName = path.parse(fileName).name; // e.g., "Minishunt_Plus"
  // Process each chunk.
  for (const chunk of fileJSON.chunks) {
    const text = chunk.cleanedText;
    let embedding: number[];
    try {
      embedding = await getEmbedding(text);
    } catch (error) {
      console.error(
        `Error getting embedding for chunk ${chunk.chunkNumber} in ${fileName}:`,
        error
      );
      continue;
    }
    // Create a unique vector ID, e.g., "Minishunt_Plus-1"
    const vectorId = `${baseName}-${chunk.chunkNumber}`;
    // Create vector object with metadata including source.
    const vector = {
      id: vectorId,
      values: embedding,
      metadata: {
        url: fileJSON.url,
        title: fileJSON.title,
        chunkNumber: chunk.chunkNumber,
        source: "website",
        pageContent: chunk.cleanedText,
      },
    };
    vectors.push(vector);
  }
  return vectors;
}

async function main() {
  const fileNames = await fs.readdir(readyFolder);
  if (!fileNames.length) {
    console.warn(`No files found in ${readyFolder}`);
    return;
  }

  const processedFiles = await loadProcessedFiles();
  // Filter out already‑done files:
  const toDo = fileNames.filter((f) => !processedFiles.has(f));
  // Only look at up to TOTAL_FILE_LIMIT files:
  const limited = toDo.slice(0, TOTAL_FILE_LIMIT);

  // Break into batches of size FILE_PROCESS_LIMIT:
  const batches: string[][] = [];
  for (let i = 0; i < limited.length; i += FILE_PROCESS_LIMIT) {
    batches.push(limited.slice(i, i + FILE_PROCESS_LIMIT));
  }

  // Set up concurrency limiter:
  const limit = pLimit(CONCURRENCY_LIMIT);

  for (const [batchIdx, batch] of batches.entries()) {
    console.log(
      `Processing batch ${batchIdx + 1}/${batches.length}: ${
        batch.length
      } files`
    );

    // Map each file in this batch to a limited Promise:
    const batchPromises = batch.map((fileName) =>
      limit(() => processFile(fileName))
    );

    // Wait for _all_ embeddings in this batch:
    const results = await Promise.all(batchPromises);
    const vectors = results.flat();

    if (vectors.length) {
      console.log(` → Upserting ${vectors.length} vectors…`);
      await upsertVectors(vectors);
    } else {
      console.warn(" → No vectors generated in this batch, skipping upsert");
    }

    // Mark these files as done:
    batch.forEach((f) => processedFiles.add(f));
    await saveProcessedFiles(processedFiles);
  }

  console.log("All batches complete.");
}

main().catch((err) => {
  console.error("Fatal error in vector pipeline:", err);
});
