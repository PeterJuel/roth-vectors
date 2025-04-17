import * as fs from "fs/promises";
import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config();

// ----- Configuration Settings -----
const OVERWRITE: boolean = false; // Set to true to overwrite clean files; false to skip if they already exist.
const LIMIT: number = 1000; // Process only the first LIMIT files (for testing).
const CONCURRENCY_LIMIT: number = 5; // Maximum number of concurrent requests to OpenAI.
const MODEL: string = "gpt-4o"; // Model name, adjust as needed.

// Define folder paths.
const inputFolder = path.join(__dirname, "..", "..", "output", "cleaned_split");
const outputFolder = path.join(__dirname, "..", "..", "output", "clean");

// Ensure output folder exists.
async function ensureFolder(folderPath: string): Promise<void> {
  try {
    await fs.mkdir(folderPath, { recursive: true });
  } catch (error) {
    console.error(`Error ensuring folder "${folderPath}":`, error);
  }
}

// The final cleaning prompt.
const FINAL_CLEANING_PROMPT = `
You are provided with a text document that has been stitched together from multiple sources scraped from the ROTH website.
This document primarily contains content about ROTH’s heating systems but has undergone prior LLM processing and may include typical errors,
such as leftover ChatGPT comments (e.g., "I am sorry but ..."), OCR artifacts, and content in multiple languages.

Your tasks are as follows:
1. Content Cleaning and Language Filtering:
   - Remove all leftovers from any ChatGPT comments.
   - Translate any non-Danish content into Danish.
2. Structural Enhancement:
   - Preserve important contextual elements like paragraph breaks.
   - Improve readability by inserting natural language titles and subtitles where appropriate.
   - Ensure that the structural markers accurately reflect the content and enhance its flow.
3. Re-chunking (if needed):
   - If the final cleaned text is too lengthy, divide it into coherent segments of approximately 1000–1500 tokens per segment,
     ensuring that each segment remains self-contained and contextually complete.
   - For chunks beyond the first one, if the main header (or title) is not already included, ensure that it is added at the top of each chunk so that all chunks remain self-contained.
4. Handling Overlap Sections:
   - The text may include overlap sections denoted by "=== OVERLAP_START ===" and "=== OVERLAP_END ===".
   - Remove all content within these markers from the final output.

Return only the final cleaned, structured, and refined text (in Danish) without any additional commentary or annotations.
Output the result as valid JSON in the following format:
{
  "chunks": [
    {
      "chunkNumber": 1,
      "cleanedText": "..."
    },
    {
      "chunkNumber": 2,
      "cleanedText": "..."
    }
  ]
}
Do not include any extra keys or commentary.
`;

// ----- Simple Concurrency Limiter -----
async function runConcurrent<T>(
  tasks: Array<() => Promise<T>>,
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

// Function to send text to OpenAI and return the cleaned result as JSON.
async function sendToOpenAI(text: string): Promise<any> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set in the .env file.");
  }

  const requestBody = {
    model: MODEL,
    messages: [
      { role: "system", content: FINAL_CLEANING_PROMPT },
      { role: "user", content: text },
    ],
    temperature: 0.0,
    max_tokens: 4096,
    response_format: { type: "json_object" },
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
    const errText = await response.text();
    throw new Error(
      `OpenAI API error: ${response.status} ${response.statusText}: ${errText}`
    );
  }

  const responseData = await response.json();
  // Extract the response (assuming it's in choices[0].message.content).
  const cleanedOutput = responseData.choices[0].message.content.trim();
  try {
    return JSON.parse(cleanedOutput);
  } catch (parseError) {
    throw new Error(
      `Failed to parse JSON response: ${parseError}. Response content: ${cleanedOutput}`
    );
  }
}

// Process a single file.
async function processFile(fileName: string): Promise<void> {
  const inputFilePath = path.join(inputFolder, fileName);
  const baseName = path.parse(fileName).name; // Remove extension if any.
  const outputFileName = `${baseName}.json`;
  const outputFilePath = path.join(outputFolder, outputFileName);

  if (!OVERWRITE) {
    try {
      await fs.access(outputFilePath);
      console.log(`File ${outputFileName} already exists. Skipping.`);
      return;
    } catch {
      // File does not exist; continue processing.
    }
  }

  let content: string;
  try {
    content = await fs.readFile(inputFilePath, "utf8");
  } catch (error) {
    console.error(`Error reading file ${fileName}:`, error);
    return;
  }

  console.log(`Sending ${fileName} to OpenAI for final cleaning...`);

  let cleanedJSON: any;
  try {
    cleanedJSON = await sendToOpenAI(content);
  } catch (error) {
    console.error(
      `Error processing file ${fileName} through OpenAI API:`,
      error
    );
    return;
  }

  try {
    await fs.writeFile(
      outputFilePath,
      JSON.stringify(cleanedJSON, null, 2),
      "utf8"
    );
    console.log(`Saved cleaned JSON to ${outputFileName}`);
  } catch (error) {
    console.error(`Error writing output file ${outputFileName}:`, error);
  }
}

async function main() {
  await ensureFolder(inputFolder);
  await ensureFolder(outputFolder);

  let fileNames: string[] = [];
  try {
    fileNames = await fs.readdir(inputFolder);
  } catch (error) {
    console.error("Error reading input folder:", error);
    return;
  }

  if (fileNames.length === 0) {
    console.warn(`No files found in ${inputFolder}`);
    return;
  }

  // Apply file limit.
  fileNames = fileNames.slice(0, LIMIT);

  // Create an array of tasks.
  const tasks = fileNames.map((fileName) => () => processFile(fileName));

  try {
    await runConcurrent(tasks, CONCURRENCY_LIMIT);
  } catch (error) {
    console.error("Error processing files concurrently:", error);
  }
}

main().catch((error) => {
  console.error("Error in LLM processing pipeline:", error);
});
