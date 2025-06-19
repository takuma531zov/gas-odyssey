import { runOcr } from "./ocr";
import { extractDataFromAI } from "./aiExtractor";
import { outputToSheet } from "./outputToSheet";
import type { AIExtractedData } from "./types";

function main() {
  console.log("=== main関数開始 ===");

  const ocrResults = runOcr();
  console.log("OCR結果数:", ocrResults?.length ?? "undefined");

  if (ocrResults && Array.isArray(ocrResults) && ocrResults.length > 0) {
    // AI抽出 + null 除去（型ガード付き filter）
    const extractedResults = ocrResults
      .map(extractDataFromAI)
      .filter((item): item is AIExtractedData => item !== null);

    console.log("抽出結果数:", extractedResults.length);
    console.log("出力開始");

    outputToSheet(extractedResults);
  } else {
    console.log("OCR結果が空または無効です");
  }

  console.log("=== main関数終了 ===");
}
