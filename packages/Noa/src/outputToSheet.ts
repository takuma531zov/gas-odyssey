import type { AIExtractedData } from "./types";
import { getCurrentDate } from "../../common/src/utils";

export function outputToSheet(data: AIExtractedData[]): void {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheets()[0]; // 最初のシートを取得
  const now = getCurrentDate(); // ← JSTの文字列で日時を取得

  type RowData = {
    month: string; // 月（文字列）
    day: string; // 日（文字列）
    kind: "receipt" | "credit"; // データ種別（レシート or クレジットカード明細）
    values: (string | number)[]; // スプレッドシートに出力する行のセルデータ配列
  };

  const allRows: RowData[] = [];

  for (const item of data) {
    if (Array.isArray(item)) {
      // クレジットカード明細の場合（複数明細の配列）
      for (const { 引き落とし日, 表示用店舗名, 金額 } of item) {
        // 日付を「月」「日」に分割
        const [month, day] = 引き落とし日.split("/");
        // allRows にクレカ明細の行データを追加
        allRows.push({
          month,
          day,
          kind: "credit",
          // 実際にシートに出力する値の配列（A列空白・月・日・店舗名・空白・金額・空白・処理日時）
          values: ["", month, day, 表示用店舗名, "", 金額, "", now],
        });
      }
    } else {
      // レシート形式の場合
      const [month, day] = item.日付.split("/");
      const { 店舗名, 合計金額税込, 軽減税率対象あり } = item;
      // 税率ごとの金額を数値化
      const amount8 = Number(item["税率8%対象金額税込"] || 0);
      const amount10 = Number(item["税率10%対象金額税込"] || 0);

      if (軽減税率対象あり) {
        // 軽減税率ありの場合、税率10%・8%それぞれ行を分けて出力
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
          // 税率10%が0の場合は合計金額（税込）を使う
          const value = amount10 === 0 ? 合計金額税込 : amount8;
          allRows.push({
            month,
            day,
            kind: "receipt",
            values: ["", month, day, `${店舗名} 税率8%`, "", value, "", now],
          });
        }
      } else {
        // 軽減税率なしは合計金額をそのまま出力
        allRows.push({
          month,
          day,
          kind: "receipt",
          values: ["", month, day, 店舗名, "", 合計金額税込, "", now],
        });
      }
    }
  }

  // ソート処理：月日を連結して数値化して昇順に並べる
  // 同じ日付なら、レシート（receipt）を先に、クレカ（credit）を後に並べる
  allRows.sort((a, b) => {
    const aNum = Number(a.month.padStart(2, "0") + a.day.padStart(2, "0"));
    const bNum = Number(b.month.padStart(2, "0") + b.day.padStart(2, "0"));
    if (aNum !== bNum) return aNum - bNum;

    // 同じ日付なら、receipt → credit の順に並べる
    if (a.kind === b.kind) return 0;
    return a.kind === "receipt" ? -1 : 1;
  });

  // 並べ替えた後、スプレッドシートに書き込む値だけ抽出
  const valuesOnly = allRows.map((row) => row.values);

  // 出力処理（スプレッドシートの該当範囲に一括書き込み）
  // A列には空のチェックボックスを挿入
  if (valuesOnly.length > 0) {
    const startRow = sheet.getLastRow() + 1; // 書き込み開始行を決定（シートの最終行の次）
    sheet
      .getRange(startRow, 1, valuesOnly.length, valuesOnly[0].length)
      .setValues(valuesOnly);
    sheet.getRange(startRow, 1, valuesOnly.length, 1).insertCheckboxes(); // A列にチェックボックスを追加
  }
}
