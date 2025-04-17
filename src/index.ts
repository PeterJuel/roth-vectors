/**
 * Index File - Processing Pipeline
 *
 * This file runs the tasks in the following order:
 * 1. parser/main.ts      - Extract PDF text and OCR processing.
 * 2. prepare/main.ts     - Process and prepare summary.json.
 * 3. prepare/list.ts     - Generate files.json from process.json.
 * 4. cleanse/main.ts     - Clean the content (remove noise, filter languages, fix OCR errors, etc).
 *
 * Currently, the first three modules are commented out to keep the focus on cleansing.
 * Uncomment them to run the full pipeline.
 */

// Uncomment these to run the full processing pipeline:
// import "./parser/main";
// import "./prepare/main";
// import "./prepare/list";
// import "./cleanse/main";
// import "./llm/main";
// import "./llm/stich";
// import "./llm/split_by_chars";
// import "./finetune/main";
// import "./finetune/stitchCleaned";
// import "./finetune/ready";
//import "./finetune/readyFull";
import "./vector";