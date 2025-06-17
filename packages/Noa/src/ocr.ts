import { OCR_FOLDER_ID, DONE_OCR_FOLDER_ID, CLOUD_VISION_API_KEY } from "./env";
const FOLDER_ID = OCR_FOLDER_ID; // ← OCR対象の画像フォルダID
const DONE_FOLDER_ID = DONE_OCR_FOLDER_ID; // ← OCR処理完了後の画像を移動するフォルダID
const API_KEY = CLOUD_VISION_API_KEY; // ← Google Cloud Vision API

export function runOcr(): string[] {
  // Google DriveからOCR対象の画像が保存されているフォルダを取得
  const folder = DriveApp.getFolderById(FOLDER_ID);
  // 処理済みの画像を移動するフォルダを取得
  const doneFolder = DriveApp.getFolderById(DONE_FOLDER_ID);
  const files = folder.getFiles();

  const results: string[] = [];

  while (files.hasNext()) {
    const file = files.next();
    const blob = file.getBlob();
    const base64Image = Utilities.base64Encode(blob.getBytes());

    // Google Cloud Vision APIに送信するためのペイロードを作成（画像のテキストを抽出するリクエスト）
    const payload = {
      requests: [
        {
          image: {
            // 解析対象の画像情報
            content: base64Image, // 画像データをBase64エンコードした文字列
          },
          features: [
            // 画像解析の機能を指定
            {
              type: "TEXT_DETECTION", // テキスト検出を指定
            },
          ],
        },
      ],
    };

    // リクエストオプションを設定
    const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    };

    const url = `https://vision.googleapis.com/v1/images:annotate?key=${API_KEY}`;
    // Google Cloud Vision APIにリクエストを送信
    const response = UrlFetchApp.fetch(url, options);
    // レスポンスをJSON形式で解析
    const result = JSON.parse(response.getContentText());
    // レスポンスから抽出されたテキストを取得
    const ocrText =
      result.responses?.[0]?.fullTextAnnotation?.text || "テキスト抽出失敗";
    console.log("抽出されたテキスト:", ocrText);
    results.push(ocrText);

    // 処理済みフォルダへ「移動」
    doneFolder.addFile(file);
    folder.removeFile(file);
  }
  return results;
}
