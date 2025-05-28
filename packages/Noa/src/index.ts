import { CLOUD_VISION_API_KEY } from "./env";

const FILE_ID = "YOUR_FILE_ID_HERE"; // ← 対象の画像ファイルIDに置き換え
const API_KEY = CLOUD_VISION_API_KEY; // ← Google Cloud Vision API

export function ocrReceiptImage(): void {
  const file = DriveApp.getFileById(FILE_ID);
  const blob = file.getBlob();

  const base64Image = Utilities.base64Encode(blob.getBytes());

  const payload = {
    requests: [
      {
        image: {
          content: base64Image,
        },
        features: [
          {
            type: "TEXT_DETECTION",
          },
        ],
      },
    ],
  };

  const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  const url = `https://vision.googleapis.com/v1/images:annotate?key=${API_KEY}`;

  const response = UrlFetchApp.fetch(url, options);
  const result = JSON.parse(response.getContentText());

  const text =
    result.responses?.[0]?.fullTextAnnotation?.text || "テキスト抽出失敗";
  Logger.log(text);
}
