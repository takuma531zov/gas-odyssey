/**
 * シートを初期化してヘッダーを設定
 * @returns 初期化されたシート
 */
export const initSheet = (): GoogleAppsScript.Spreadsheet.Sheet => {
  const GET_LINE_ID_SHEET = "LINE_ID";
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet =
    ss.getSheetByName(GET_LINE_ID_SHEET) ?? ss.insertSheet(GET_LINE_ID_SHEET);

  // シート全体をクリア
  sheet.clear();

  // ヘッダー行を追加
  sheet.appendRow(["タイムスタンプ", "メッセージ"]);
  sheet.getRange("A1:B1").setFontWeight("bold");

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
