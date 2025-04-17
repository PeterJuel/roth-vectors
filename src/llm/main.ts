import * as fs from "fs/promises";
import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config();

// ----- Configuration Settings -----
const OVERWRITE: boolean = false; // Set to true to overwrite cleansed files; false to skip if they already exist.
const LIMIT = 10000; // Process only the first LIMIT files (for testing).
const CONCURRENCY_LIMIT = 5; // Maximum number of concurrent requests to OpenAI.

// ----- The cleaning prompt -----
const CLEANING_PROMPT = `You are processing text files scraped from the ROTH website with a focus on content related to their heating systems. These texts originate from OCR processing and may contain typical OCR errors (misrecognized characters, broken words, extraneous symbols, etc.). Your task is to clean each file for ingestion into a vector database by following these instructions:
1. Content Filtering:
* Remove all extraneous content, including menus, addresses, cookie information, marketing text, and any other irrelevant noise.
* When the text contains multiple languages, extract and return only the portions written in Danish (marked with "DK"). If only one language is present, return the text as is.
2. OCR Error Correction:
* Correct common OCR errors such as misrecognized characters, broken or split words, and any unusual formatting artifacts.
* Ensure that the text reads naturally and that errors introduced by the OCR process (e.g., incorrect punctuation, misinterpreted letters, or spurious symbols) are fixed as much as possible.
3. Handling Overlap Sections:
* The text includes overlap sections denoted by <OVERLAP_START> and <OVERLAP_END>. These markers indicate sections included solely for maintaining context.
* Remove all content within these markers from the final output.
4. Output Requirement:
* Return only the cleaned, contextually relevant text without any additional commentary or annotations.
`;

// ----- Function to send text to the OpenAI GPT-4o API for cleaning -----
async function sendToOpenAI(text: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set in the .env file.");
  }

  const requestBody = {
    model: "gpt-4o", // adjust if needed, e.g., "gpt-4o-2024-08-06"
    messages: [
      { role: "system", content: CLEANING_PROMPT },
      { role: "user", content: text },
    ],
    temperature: 0.0,
    max_tokens: 4096,
  };

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `OpenAI API error: ${response.status} ${response.statusText}: ${errorText}`
    );
  }

  const responseData = await response.json();
  // Return the cleaned text found in choices[0].message.content.
  return responseData.choices[0].message.content.trim();
}

// ----- Simple Concurrency Limiter -----
// Runs an array of task functions concurrently, but with a maximum of 'limit' in parallel.
async function runConcurrent<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<T[]> {
  const results: T[] = [];
  let running = 0;
  let index = 0;

  return new Promise((resolve, reject) => {
    const next = () => {
      if (index === tasks.length && running === 0) {
        resolve(results);
        return;
      }
      while (running < limit && index < tasks.length) {
        const currentIndex = index;
        const task = tasks[currentIndex];
        index++;
        running++;
        task()
          .then((result) => {
            results[currentIndex] = result;
            running--;
            next();
          })
          .catch((err) => reject(err));
      }
    };
    next();
  });
}

// ----- Process an individual file -----
// Reads file from "output/prepared", sends its content for cleaning, and saves result to "output/cleansed".
async function processFile(fileName: string): Promise<void> {
  const preparedFolder = path.join(__dirname, "..", "..", "output", "prepared");
  const cleansedFolder = path.join(__dirname, "..", "..", "output", "cleansed");
  const inputFilePath = path.join(preparedFolder, fileName);
  const outputFilePath = path.join(cleansedFolder, fileName);

  // Skip processing if the cleansed file exists and OVERWRITE is false.
  if (!OVERWRITE) {
    try {
      await fs.access(outputFilePath);
      console.log(`File ${outputFilePath} already exists. Skipping.`);
      return;
    } catch {
      // File doesn't exist; proceed.
    }
  }

  let content: string;
  try {
    content = await fs.readFile(inputFilePath, "utf8");
  } catch (error) {
    console.error(`Error reading file ${fileName}:`, error);
    return;
  }

  console.log(`Sending ${fileName} to OpenAI for cleaning...`);
  let cleanedContent: string;
  try {
    cleanedContent = await sendToOpenAI(content);
  } catch (error) {
    console.error(
      `Error processing file ${fileName} through OpenAI API:`,
      error
    );
    return;
  }

  try {
    await fs.writeFile(outputFilePath, cleanedContent, "utf8");
    console.log(`Saved cleansed file as ${outputFilePath}`);
  } catch (error) {
    console.error(`Error writing cleansed file ${outputFilePath}:`, error);
  }
}

async function main() {
  const preparedFolder = path.join(__dirname, "..", "..", "output", "prepared");
  const cleansedFolder = path.join(__dirname, "..", "..", "output", "cleansed");

  // Ensure cleansed folder exists.
  await fs.mkdir(cleansedFolder, { recursive: true });

  // Read files from the prepared folder.
  let fileNames: string[];
  try {
    fileNames = await fs.readdir(preparedFolder);
  } catch (error) {
    console.error("Error reading the prepared folder:", error);
    return;
  }

  // Limit processing to the first LIMIT files.
  const filesToProcess = fileNames.slice(0, LIMIT);
  console.log(
    `Processing ${filesToProcess.length} file(s) from ${preparedFolder}`
  );

  // Create an array of tasks, each processing a file.
  const tasks = filesToProcess.map((fileName) => () => processFile(fileName));

  // Run tasks concurrently with specified concurrency limit.
  try {
    await runConcurrent(tasks, CONCURRENCY_LIMIT);
  } catch (error) {
    console.error("Error processing files concurrently:", error);
  }
}

main().catch((error) => {
  console.error("Error in LLM processing pipeline:", error);
});
