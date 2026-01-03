/**
 * 画像アップロード
 * microCMSに画像をアップロードし、URLマッピングを作成
 */

import { MICRO_CMS_API_KEY } from "../env";
import { logInfo, logError } from "../utils/logger";
import type {
  ImageFile,
  ImageUrlMap,
  MicroCMSMediaResponse,
} from "../types";

/**
 * 画像を1件アップロード
 * @param imageFile 画像ファイル
 * @param serviceId microCMSサービスID
 * @returns 画像URL
 */
const uploadSingleImage = (
  imageFile: ImageFile,
  serviceId: string,
): string => {
  const apiUrl = `https://${serviceId}.microcms-management.io/api/v1/media`;

  logInfo(`画像をアップロード中: ${imageFile.filename}`);

  // FormDataの作成（GASではURLFetchAppのpayloadで代用）
  const boundary = "----GASBoundary" + Math.random().toString(36).substring(2);
  const payload = Utilities.newBlob(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${imageFile.filename}"\r\n` +
      `Content-Type: ${imageFile.blob.getContentType()}\r\n\r\n`,
  )
    .getBytes()
    .concat(imageFile.blob.getBytes())
    .concat(
      Utilities.newBlob(`\r\n--${boundary}--\r\n`).getBytes(),
    );

  const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: "post",
    headers: {
      "X-MICROCMS-API-KEY": MICRO_CMS_API_KEY,
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
    payload: payload,
    muteHttpExceptions: true,
  };

  const response = UrlFetchApp.fetch(apiUrl, options);
  const statusCode = response.getResponseCode();

  if (statusCode !== 201 && statusCode !== 200) {
    const errorBody = response.getContentText();
    logError(`画像アップロード失敗: ${imageFile.filename}`, {
      statusCode,
      errorBody,
    });
    throw new Error(
      `画像をアップロードできませんでした: ${imageFile.filename} (HTTP ${statusCode})`,
    );
  }

  const data: MicroCMSMediaResponse = JSON.parse(response.getContentText());

  logInfo(
    `画像をアップロードしました: ${imageFile.filename} → ${data.url}`,
  );

  return data.url;
};

/**
 * 複数の画像をアップロード
 * 1秒に3回以下に制限（429エラー回避）
 * @param imageFiles 画像ファイル配列
 * @param serviceId microCMSサービスID（例: "your-service"）
 * @returns ファイル名→URLマッピング
 */
export const uploadImages = (
  imageFiles: ImageFile[],
  serviceId: string,
): ImageUrlMap => {
  if (imageFiles.length === 0) {
    logInfo("アップロードする画像がありません");
    return {};
  }

  logInfo(`${imageFiles.length}件の画像をアップロード開始`);

  const imageUrlMap: ImageUrlMap = {};

  imageFiles.forEach((imageFile, index) => {
    try {
      const url = uploadSingleImage(imageFile, serviceId);
      imageUrlMap[imageFile.filename] = url;

      // 1秒に3回以下に制限（350ms待機）
      // 最後の画像の後は待機不要
      if (index < imageFiles.length - 1) {
        Utilities.sleep(350);
      }
    } catch (error) {
      logError(`画像アップロード中にエラー: ${imageFile.filename}`, error);
      throw error; // エラーを上位に伝播
    }
  });

  logInfo(`${imageFiles.length}件の画像アップロードが完了しました`);

  return imageUrlMap;
};
