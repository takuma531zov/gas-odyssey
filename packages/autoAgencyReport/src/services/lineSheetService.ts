/**
 * シートを初期化してヘッダーを設定
 * @returns 初期化されたシート
 */
export const initSheet = (): GoogleAppsScript.Spreadsheet.Sheet => {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("LINE_ID");

  // シートが存在しない場合は作成
  if (!sheet) {
    sheet = ss.insertSheet("LINE_ID");
  }

  // シート全体をクリア
  sheet.clear();

  // ヘッダー行を追加
  sheet.appendRow(["タイムスタンプ", "メッセージ"]);
  sheet.getRange(1, 1, 1, 2).setFontWeight("bold");

  return sheet;
};

/**
 * ログをスプレッドシートに書き込む
 * @param sheet シートオブジェクト
 * @param message ログメッセージ
 */
export const writeToSheet = (
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
  message: string,
): void => {
  try {
    // ログを追記
    sheet.appendRow([new Date(), message]);
  } catch (error) {
    // スプレッドシート書き込みに失敗してもエラーにしない
    Logger.log(`シート書き込みエラー: ${error}`);
  }
};
