export type SSheet = GoogleAppsScript.Spreadsheet.Sheet;

export const COL_NUM = {
  FIRST: 1,
  SECOND: 2,
} as const;

export const NUM_ROWS = {
  ONE: 1,
  TWO: 2,
} as const;

/**
 * シートオブジェクトを取得
 * @param sheetName
 * @returns
 */
export const getSheet = (sheetName: string) =>
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName) as SSheet;

/**
 * 選択した範囲の行リストを取得（２次元配列）
 * @param sheet
 * @param headerRowNum
 * @param startDataRowNum
 * @param rowCountNum
 * @param colCountNum
 * @returns
 */
export const getRowData2D = (
  sheet: SSheet,
  headerRowNum: number,
  startDataRowNum: number,
  rowCountNum?: number,
  colCountNum?: number,
) => {
  const colNum = colCountNum || sheet.getLastColumn();
  const rowNum = rowCountNum || sheet.getLastRow();
  const dataRangeRowCount = rowNum - headerRowNum; // 取得データの行数（実データのみのためヘッダー部分は除外）

  return sheet
    .getRange(startDataRowNum, COL_NUM.FIRST, dataRangeRowCount, colNum) // Sheetオブジェクト.getRange(行番号, 列番号, 行数, 列数)
    .getValues() as string[][];
};

/**
 * スクリプトプロパティの値を取得する
 * @param key
 * @returns
 */
export const getScriptPropertyValue = (key: string) => {
  return PropertiesService.getScriptProperties().getProperty(key) || "";
};

/**
 * 指定の場所に値をセット
 * @param sheet
 * @param rowNum
 * @param colNum
 * @param post
 */
export const setValueSheet = (
  sheet: SSheet,
  rowNum: number,
  colNum: number,
  post: string,
) => {
  sheet.getRange(rowNum, colNum).setValue(post);
};
