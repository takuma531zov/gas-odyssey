import { runOcr } from "./ocr";
import { extractDataFromAI } from "./aiExtractor";

// メイン処理

function main() {
  console.log("=== main関数開始 ===");

  // 関数の存在確認
  console.log("runOcr関数の存在:", typeof runOcr);
  console.log("extractDataFromAI関数の存在:", typeof extractDataFromAI);

  // 実行前確認
  console.log("runOcr実行前");
  const ocrResults = runOcr();
  console.log("runOcr実行後");

  // 結果確認
  console.log("ocrResultsの型:", typeof ocrResults);
  console.log("ocrResultsはArray:", Array.isArray(ocrResults));
  console.log("ocrResults:", ocrResults);
  console.log("OCR結果数:", ocrResults ? ocrResults.length : "undefined");

  if (ocrResults && Array.isArray(ocrResults) && ocrResults.length > 0) {
    console.log("処理ループ開始");
    for (let i = 0; i < ocrResults.length; i++) {
      const ocrText = ocrResults[i];
      console.log(`=== 処理${i + 1}/${ocrResults.length}開始 ===`);
      console.log("OCRテキスト長さ:", ocrText.length);
      console.log("OCRテキスト先頭:", ocrText.substring(0, 50));

      const result = extractDataFromAI(ocrText);
      console.log("AI抽出結果:", result);
    }
  } else {
    console.log("OCR結果が空または無効です");
    console.log("ocrResultsの詳細:", JSON.stringify(ocrResults));
  }

  console.log("=== main関数終了 ===");
}
