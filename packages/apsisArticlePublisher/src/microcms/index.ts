/**
 * microCMS連携
 * 著者・タグID取得、画像アップロード、記事投稿
 *
 * 処理フロー：
 * 1. getAuthorId() - 著者名からmicroCMS著者IDを取得
 * 2. getTagIds() - タグslug配列からmicroCMSタグID配列を取得
 * 3. uploadImages() - 画像ファイルをmicroCMSにアップロード（画像ID→URL変換マップ作成）
 * 4. replaceImagePaths() - マークダウン内の画像パスをmicroCMS URLに置換
 * 5. publishArticle() - 記事をmicroCMSに下書き保存（?status=draft）
 */

export * from "./getAuthorId";
export * from "./getTagIds";
export * from "./uploadImage";
export * from "./replaceImagePaths";
export * from "./publishArticle";
