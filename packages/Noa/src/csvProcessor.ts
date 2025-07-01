import type { CreditCardDataItem } from "./types";

/**
 * 指定年月の平日最終日を取得
 * @param year 年
 * @param month 月（1-12）
 * @returns MM/DD形式の日付文字列
 */
function getLastWeekdayOfMonth(year: number, month: number): string {
  const lastDay = new Date(year, month, 0); // 月末日を取得

  // 平日最終日を見つける（土日を避ける）
  while (lastDay.getDay() === 0 || lastDay.getDay() === 6) {
    // 日曜(0)または土曜(6)
    lastDay.setDate(lastDay.getDate() - 1);
  }

  const mm = String(month).padStart(2, "0");
  const dd = String(lastDay.getDate()).padStart(2, "0");
  return `${mm}/${dd}`;
}

/**
 * 現在の年月を取得
 * @returns {year: number, month: number}
 */
function getCurrentYearMonth(): { year: number; month: number } {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1, // getMonth()は0ベースなので+1
  };
}

/**
 * CSVファイルからクレジットカード明細データを読み込み
 * @param file CSVファイル
 * @returns クレジットカード明細データ配列
 */
export function processCreditCardCSV(file: GoogleAppsScript.Drive.File): CreditCardDataItem[] {
  try {
    console.log("CSV処理開始:", file.getName());
    
    const csvContent = file.getBlob().getDataAsString('UTF-8');
    const lines = csvContent.trim().split('\n');
    
    if (lines.length < 1) {
      console.log("データが不足しています");
      return [];
    }
    
    const results: CreditCardDataItem[] = [];
    
    // 引き落とし日を自動設定
    const { year, month } = getCurrentYearMonth();
    const lastWeekday = getLastWeekdayOfMonth(year, month);
    
    // 2行目以降を処理（1行目のタイトルをスキップ）
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      
      // CSVパース: "日付,店舗名 品目,金額"
      const parts = line.split(',');
      if (parts.length !== 3) continue;
      
      const rawDate = parts[0].trim();
      const storeAndItem = parts[1].trim();
      const amount = parts[2].trim();
      
      // 日付変換: 2025/5/24 → 05/24
      const dateMatch = rawDate.match(/\d{4}\/(\d{1,2})\/(\d{1,2})/);
      if (!dateMatch) continue;
      
      const month = dateMatch[1].padStart(2, '0');
      const day = dateMatch[2].padStart(2, '0');
      const formattedDate = `${month}/${day}`;
      
      // 店舗名と品目を分離（最後のスペースで区切り）
      const lastSpaceIndex = storeAndItem.lastIndexOf(' ');
      let storeName = storeAndItem;
      let item = "";
      
      if (lastSpaceIndex > 0) {
        storeName = storeAndItem.substring(0, lastSpaceIndex);
        item = storeAndItem.substring(lastSpaceIndex + 1);
      }
      
      results.push({
        引き落とし日: lastWeekday, // 直接設定
        店舗名: storeName,
        品目: item,
        カード名: "三井住友カード",
        利用日: formattedDate,
        金額: amount
      });
    }
    
    console.log(`CSV処理完了: ${results.length}件の取引を読み込みました`);
    console.log(`引き落とし日設定: ${lastWeekday}`);
    return results;
    
  } catch (error) {
    console.error("CSV処理エラー:", error);
    return [];
  }
}

/**
 * CSVファイルかどうかを判定
 * @param file ファイル
 * @returns CSVファイルの場合true
 */
export function isCSVFile(file: GoogleAppsScript.Drive.File): boolean {
  const fileName = file.getName().toLowerCase();
  return fileName.endsWith('.csv');
}