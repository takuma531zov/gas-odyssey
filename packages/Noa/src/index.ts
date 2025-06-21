import { runOcr } from "./ocr";
import * as env from "./env";
import { extractDataFromAI } from "./aiExtractor";
import { outputToSheet } from "./outputToSheet";
import type { AIExtractedData } from "./types";

// メイン処理

function main() {
  const sourceFolder = DriveApp.getFolderById(env.OCR_FOLDER_ID);
  const doneFolder = DriveApp.getFolderById(env.DONE_OCR_FOLDER_ID);
  const errorFolder = DriveApp.getFolderById(env.ERROR_OCR_FOLDER_ID);

  const files = sourceFolder.getFiles();
  const extractedResults: AIExtractedData[] = [];

  // エラー集計用カウンタ
  let ocrErrorCount = 0;
  let aiErrorCount = 0;
  let totalFiles = 0;

  while (files.hasNext()) {
    const file = files.next();
    totalFiles++;

    try {
      const ocrText = runOcr(file);
      if (!ocrText || ocrText === "テキスト抽出失敗") {
        ocrErrorCount++;
        throw new Error("OCR失敗");
      }

      const extracted = extractDataFromAI(ocrText);
      if (!extracted) {
        aiErrorCount++;
        throw new Error("AI抽出失敗");
      }

      extractedResults.push(extracted);
      doneFolder.createFile(file.getBlob());
      file.setTrashed(true);
    } catch (e) {
      // 既にエラー件数は増やしているのでここではログだけ
      errorFolder.createFile(file.getBlob());
      file.setTrashed(true);
      console.error(`ファイル処理エラー: ${file.getName()}`, e);
    }
  }

  if (extractedResults.length > 0) {
    outputToSheet(extractedResults);
  }

  // 処理結果メッセージ作成
  const ui = SpreadsheetApp.getUi();
  const successCount = extractedResults.length;
  const errorCount = ocrErrorCount + aiErrorCount;

  let message = `実行完了\n総ファイル数: ${totalFiles}\n正常処理件数: ${successCount}\n処理エラー件数: ${errorCount}\n`;

  if (errorCount > 0) {
    message += "エラー内訳:\n";
    if (ocrErrorCount > 0) message += ` - OCRエラー: ${ocrErrorCount}件\n`;
    if (aiErrorCount > 0) message += ` - 項目抽出エラー: ${aiErrorCount}件\n`;
  }

  // ポップアップ表示
  ui.alert(message);
}
