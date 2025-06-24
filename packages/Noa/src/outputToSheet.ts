import type { AIExtractedData } from "./types";
import { getCurrentDate } from "../../common/src/utils";

export function outputToSheet(data: AIExtractedData): void {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheets()[0]; // 最初のシート
  const now = getCurrentDate();

  type RowData = {
    month: string;
    day: string;
    kind: "receipt" | "credit";
    values: (string | number)[];
  };

  const allRows: RowData[] = [];

  for (const item of data) {
    if ("引き落とし日" in item) {
      // クレジットカード明細
      const { 引き落とし日, 表示用店舗名, 金額 } = item;
      const [month, day] = 引き落とし日.split("/");
      allRows.push({
        month,
        day,
        kind: "credit",
        values: ["", month, day, 表示用店舗名, "", 金額, "", now],
      });
    } else if ("日付" in item) {
      // レシート
      const [month, day] = item.日付.split("/");
      const { 店舗名, 合計金額税込, 軽減税率対象あり } = item;
      const amount8 = Number(item["税率8%対象金額税込"] || 0);
      const amount10 = Number(item["税率10%対象金額税込"] || 0);

      if (軽減税率対象あり) {
        if (amount10 > 0) {
          allRows.push({
            month,
            day,
            kind: "receipt",
            values: [
              "",
              month,
              day,
              `${店舗名} 税率10%`,
              "",
              amount10,
              "",
              now,
            ],
          });
        }
        if (amount8 > 0) {
          const value = amount10 === 0 ? 合計金額税込 : amount8;
          allRows.push({
            month,
            day,
            kind: "receipt",
            values: ["", month, day, `${店舗名} 税率8%`, "", value, "", now],
          });
        }
      } else {
        allRows.push({
          month,
          day,
          kind: "receipt",
          values: ["", month, day, 店舗名, "", 合計金額税込, "", now],
        });
      }
    }
  }

  // 並び替え（同日ならレシート → クレカ）
  allRows.sort((a, b) => {
    const aNum = Number(a.month.padStart(2, "0") + a.day.padStart(2, "0"));
    const bNum = Number(b.month.padStart(2, "0") + b.day.padStart(2, "0"));
    return aNum !== bNum ? aNum - bNum : a.kind === "receipt" ? -1 : 1;
  });

  const valuesOnly = allRows.map((r) => r.values);

  if (valuesOnly.length > 0) {
    const startRow = sheet.getLastRow() + 1;
    sheet
      .getRange(startRow, 1, valuesOnly.length, valuesOnly[0].length)
      .setValues(valuesOnly);
    sheet.getRange(startRow, 1, valuesOnly.length, 1).insertCheckboxes(); // A列チェックボックス
  }
}
