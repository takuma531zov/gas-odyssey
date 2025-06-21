import * as env from "./env";

const API_KEY = env.CLOUD_VISION_API_KEY;

/**
 * 単一ファイルに対して OCR を実行し、抽出されたテキストを返す
 * @param file Google Drive 上の画像ファイル
 * @returns OCR結果のテキスト（失敗時は空文字列）
 */
export function runOcr(file: GoogleAppsScript.Drive.File): string {
  try {
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

    const text = result.responses?.[0]?.fullTextAnnotation?.text || "";
    console.log("抽出されたテキスト:", text.slice(0, 100)); // 最初の100文字だけ表示
    return text;
  } catch (error) {
    console.error("OCR処理中にエラー:", error);
    return "";
  }
}
