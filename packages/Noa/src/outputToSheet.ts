import type { AIExtractedData } from "./types";

export function outputToSheet(data: AIExtractedData[]): void {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName("出力結果") || spreadsheet.insertSheet("出力結果");


  const rows: (string | number)[][] = [];

  data.forEach(item => {
    if (Array.isArray(item)) {
      // クレジットカード明細（複数件）
      item.forEach(({ 引き落とし日, 表示用店舗名, 金額 }) => {
        const [month, day] = 引き落とし日.split("/");
        rows.push(["", month, day, 表示用店舗名, "", 金額]);
      });
      return;
    }

    // レシート形式
    const [month, day] = item.日付.split("/");
    const { 店舗名, 合計金額税込, 軽減税率対象あり } = item;
    const amount8 = Number(item["税率8%対象金額税込"] || 0);
    const amount10 = Number(item["税率10%対象金額税込"] || 0);

    if (軽減税率対象あり) {
      if (amount10 > 0) {
        rows.push(["", month, day, `${店舗名} 税率10%`, "", amount10]);
      }
      if (amount8 > 0) {
        const value = amount10 === 0 ? 合計金額税込 : amount8;
        rows.push(["", month, day, `${店舗名} 税率8%`, "", value]);
      }
    } else {
      rows.push(["", month, day, 店舗名, "", 合計金額税込]);
    }
  });

  // 出力
  if (rows.length > 0) {
    const startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows);


  // A列（1列目）にチェックボックスを設定
  const checkboxRange = sheet.getRange(startRow, 1, rows.length, 1);
  checkboxRange.insertCheckboxes();
}
}

