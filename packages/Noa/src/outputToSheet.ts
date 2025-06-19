/**
 * 指定のスプレッドシートに抽出データを出力する
 */
import type { AIExtractedData } from "./types";

export function outputToSheet(data: AIExtractedData[]): void {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName("出力結果") || spreadsheet.insertSheet("出力結果");

  // ヘッダーを書き出し（初回のみ）
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["", "月", "日", "店舗名（表示用）", "", "金額"]);
  }

  for (const item of data) {
    // レシート形式か、クレカ明細形式か判定
    if (Array.isArray(item)) {
      // クレジットカード明細（複数件）
      for (const cc of item) {
        const [month, day] = cc.利用日.split("/");
        sheet.appendRow([
          "",            // A列（使わない）
          month,         // B列：月
          day,           // C列：日
          cc.表示用店舗名, // D列：店舗名（表示用）
          "",            // E列（使わない）
          cc.金額        // F列：金額
        ]);
      }
    } else {
      // レシート形式
      const [month, day] = item.日付.split("/");

      const hasReducedTax = item.軽減税率対象あり;
      const amount8 = parseInt(item["税率8対象金額税込"] || "0", 10);
      const amount10 = parseInt(item["税率10対象金額税込"] || "0", 10);

      if (hasReducedTax) {
        if (amount10 > 0) {
          sheet.appendRow([
            "",
            month,
            day,
            `${item.店舗名} 税率10%`,
            "",
            amount10.toString(),
          ]);
        }

        if (amount8 > 0) {
          const value = amount10 === 0 ? item.合計金額税込 : amount8.toString(); // 税率10%がなければ合計金額
          sheet.appendRow([
            "",
            month,
            day,
            `${item.店舗名} 税率8%`,
            "",
            value,
          ]);
        }
      } else {
        // 税率区分なしの通常出力
        sheet.appendRow([
          "",
          month,
          day,
          item.店舗名,
          "",
          item.合計金額税込  // 合計金額は税込で出力
        ]);
      }
    }
  }
}
