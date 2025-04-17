/**
 * Splits a text string into chunks based on whitespace tokens.
 * Each chunk has a maximum of `chunkSize` tokens, with an overlap of `overlap` tokens.
 * In every chunk after the first one, the overlapped portion is wrapped in
 * <OVERLAP_START> and <OVERLAP_END> markers.
 *
 * @param text - The text to be split.
 * @param chunkSize - Maximum token count per chunk.
 * @param overlap - Number of tokens to overlap between subsequent chunks.
 * @returns An array of text chunks with marked overlap (if applicable).
 */
export function splitIntoChunks(
  text: string,
  chunkSize: number,
  overlap: number
): string[] {
  // Tokenize by splitting on whitespace and remove any empty tokens.
  const tokens = text.split(/\s+/).filter((token) => token.length > 0);
  const chunks: string[] = [];
  let start = 0;

  while (start < tokens.length) {
    // Determine end index for the current chunk.
    const end = Math.min(start + chunkSize, tokens.length);
    // Get the current slice of tokens.
    const currentTokens = tokens.slice(start, end);

    let chunk = "";
    // For chunks after the first, mark the first `overlap` tokens.
    if (start > 0 && currentTokens.length > overlap) {
      const overlapTokens = currentTokens.slice(0, overlap).join(" ");
      const remainingTokens = currentTokens.slice(overlap).join(" ");
      chunk = `<OVERLAP_START> ${overlapTokens} <OVERLAP_END> ${remainingTokens}`;
    } else {
      // First chunk or chunks too short for an overlap marker.
      chunk = currentTokens.join(" ");
    }
    chunks.push(chunk);

    // If we've reached the end, break.
    if (end === tokens.length) break;

    // Start the next chunk, overlapping by the last `overlap` tokens.
    start = end - overlap;
  }
  return chunks;
}

/**
 * Counts tokens in a given text string by splitting on whitespace.
 * @param text - The text whose tokens should be counted.
 * @returns The number of tokens.
 */
export function countTokens(text: string): number {
  return text.split(/\s+/).filter((token) => token.length > 0).length;
}
