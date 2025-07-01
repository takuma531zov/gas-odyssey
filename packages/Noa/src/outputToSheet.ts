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

  // クレジットカード明細を分離して逆順処理
  const creditCardItems = data.filter(item => "引き落とし日" in item).reverse();
  const receiptItems = data.filter(item => "日付" in item);

  // レシートを処理
  for (const item of receiptItems) {
    if ("日付" in item) {
      // レシート処理（既存ロジック）
      const { 日付, 店舗名, 合計金額税込, 軽減税率対象あり } = item;

      // 安全な日付分割処理
      if (!日付 || typeof 日付 !== "string") {
        console.error("日付が無効です:", 日付);
        continue;
      }

      const dateParts = 日付.split("/");
      if (dateParts.length !== 2) {
        console.error("日付の形式が無効です:", 日付);
        continue;
      }

      const [month, day] = dateParts;
      if (!month || !day) {
        console.error("月または日が無効です:", { month, day });
        continue;
      }

      const amount8 = Number(item["税率8%対象金額税込"] || 0);
      const amount10 = Number(item["税率10%対象金額税込"] || 0);

      if (軽減税率対象あり && amount8 > 0) {
        // 軽減税率対象ありかつ8%対象金額がある場合のみ税率別表記
        if (amount10 > 0) {
          allRows.push({
            month,
            day,
            kind: "receipt",
            values: [
              "",
              month,
              day,
              `${店舗名 || ""} 税率10%`,
              "",
              amount10,
              "",
              now,
            ],
          });
        }

        const value = amount10 === 0 ? 合計金額税込 : amount8;
        allRows.push({
          month,
          day,
          kind: "receipt",
          values: [
            "",
            month,
            day,
            `${店舗名 || ""} 税率8%`,
            "",
            value || "",
            "",
            now,
          ],
        });
      } else {
        // 軽減税率対象なしまたは8%対象金額がない場合は通常表記
        allRows.push({
          month,
          day,
          kind: "receipt",
          values: [
            "",
            month,
            day,
            店舗名 || "",
            "",
            合計金額税込 || "",
            "",
            now,
          ],
        });
      }
    }
  }

  // クレジットカード明細を処理（逆順）
  for (const item of creditCardItems) {
    if ("引き落とし日" in item) {
      // クレジットカード明細
      const { 引き落とし日, 店舗名, 品目, カード名, 利用日, 金額 } = item;

      // 安全な日付分割処理
      if (!引き落とし日 || typeof 引き落とし日 !== "string") {
        console.error("引き落とし日が無効です:", 引き落とし日);
        continue;
      }

      const dateParts = 引き落とし日.split("/");
      if (dateParts.length !== 2) {
        console.error("引き落とし日の形式が無効です:", 引き落とし日);
        continue;
      }

      const [month, day] = dateParts;
      if (!month || !day) {
        console.error("月または日が無効です:", { month, day });
        continue;
      }

      // 表示用店舗名を動的生成: "店舗名 品目（カード名 利用日）"
      const displayStoreName = `${店舗名 || ""} ${品目 || ""}（${カード名 || ""} ${利用日 || ""}）`;

      allRows.push({
        month,
        day,
        kind: "credit",
        values: ["", month, day, displayStoreName, "", 金額 || "", "", now],
      });
    }
  }

  // 並び替え（同日ならレシート → クレカ）
  // 安全なpadStart処理
  allRows.sort((a, b) => {
    const aPadded =
      (a.month || "").padStart(2, "0") + (a.day || "").padStart(2, "0");
    const bPadded =
      (b.month || "").padStart(2, "0") + (b.day || "").padStart(2, "0");
    const aNum = Number(aPadded) || 0;
    const bNum = Number(bPadded) || 0;
    return aNum !== bNum ? aNum - bNum : a.kind === "receipt" ? -1 : 1;
  });

  const valuesOnly = allRows.map((r) => r.values);

  if (valuesOnly.length > 0) {
    console.log(`シートに${valuesOnly.length}行のデータを出力します`);
    const startRow = sheet.getLastRow() + 1;
    sheet
      .getRange(startRow, 1, valuesOnly.length, valuesOnly[0].length)
      .setValues(valuesOnly);
    sheet.getRange(startRow, 1, valuesOnly.length, 1).insertCheckboxes(); // A列チェックボックス
  } else {
    console.log("出力するデータがありません");
  }
}
