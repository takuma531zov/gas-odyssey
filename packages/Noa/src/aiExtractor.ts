import * as env from "./env";
const API_KEY = env.OPEN_AI_API_KEY;
const AI_MODEL = env.OPEN_AI_MODEL;

import { promptToAI } from "./prompt";
import type { AIExtractedData, ReceiptData, CreditCardDataItem } from "./types";

// デバッグ用（true/falseを切り替えるだけ）
const DEBUG = true;

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
 * 緊急時の手動パース（デバッグ用）
 */
function tryManualParse(ocrText: string): AIExtractedData | null {
  try {
    const lines = ocrText.split("\n").filter((line) => line.trim());
    const results: CreditCardDataItem[] = [];

    DEBUG && console.log(`[DEBUG] 処理対象行数: ${lines.length}`);

    // データが3行または2行セットで構成されている場合の処理
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      DEBUG && console.log(`[DEBUG] 行${i + 1}: ${line}`);

      // パターン1: 1行に全て含まれている場合
      let match = line.match(
        /(\d{4}\/\d{1,2}\/\d{1,2})\s+(.+?)\s+(.+?)\s+¥([\d,]+)/,
      );
      if (match) {
        const [, date, storeName, category, amount] = match;
        const item: CreditCardDataItem = {
          引き落とし日: "",
          店舗名: storeName.trim(),
          品目: category.trim(),
          カード名: "",
          利用日: date,
          金額: amount.replace(/,/g, ""),
        };
        results.push(item);
        DEBUG &&
          console.log(
            `[DEBUG] 1行マッチ成功: ${date} ${storeName.trim()} ${amount}`,
          );
      }

      // パターン2: 複数行に分かれている場合
      if (line.match(/^\d{4}\/\d{1,2}\/\d{1,2}$/)) {
        // 日付行を発見
        const date = line;
        let storeName = "";
        let category = "";
        let amount = "";

        // 次の行から店舗名+品目を探す
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1];
          // 店舗名 品目 の形式をパース
          const storeMatch = nextLine.match(/^(.+?)\s+(.+)$/);
          if (storeMatch) {
            storeName = storeMatch[1].trim();
            category = storeMatch[2].trim();
          }
        }

        // 金額行を探す
        if (i + 2 < lines.length && lines[i + 2].match(/^¥[\d,]+$/)) {
          amount = lines[i + 2].replace(/¥|,/g, "");
        }

        if (storeName && category && amount) {
          const item: CreditCardDataItem = {
            引き落とし日: "",
            店舗名: storeName,
            品目: category,
            カード名: "",
            利用日: date,
            金額: amount,
          };
          results.push(item);
          DEBUG &&
            console.log(
              `[DEBUG] 複数行マッチ成功: ${date} ${storeName} ${category} ${amount}`,
            );
          i += 2; // 処理した行をスキップ
        }
      }

      // パターン3: 日付+店舗名+品目が1行の場合
      match = line.match(/(\d{4}\/\d{1,2}\/\d{1,2})\s+(.+?)\s+(.+)$/);
      if (match && i + 1 < lines.length && lines[i + 1].match(/^¥[\d,]+$/)) {
        const [, date, storeName, category] = match;
        const amount = lines[i + 1].replace(/¥|,/g, "");

        const item: CreditCardDataItem = {
          引き落とし日: "",
          店舗名: storeName.trim(),
          品目: category.trim(),
          カード名: "",
          利用日: date,
          金額: amount,
        };
        results.push(item);
        DEBUG &&
          console.log(
            `[DEBUG] 日付+店舗マッチ成功: ${date} ${storeName.trim()} ${amount}`,
          );
        i++; // 金額行をスキップ
      }
    }

    DEBUG &&
      console.log(`[DEBUG] 手動パース結果: ${results.length}件のデータを抽出`);
    return results.length > 0 ? results : null;
  } catch (e) {
    console.log("[DEBUG] 手動パース失敗:", e);
    return null;
  }
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

// 返却を常に配列形式に統一する
export function extractDataFromAI(ocrText: string): AIExtractedData | null {
  DEBUG && console.log("[DEBUG] 処理開始", { ocrLength: ocrText.length });
  DEBUG &&
    console.log(
      "[DEBUG] OCRテキスト内容:",
      ocrText.slice(0, 200) + (ocrText.length > 200 ? "..." : ""),
    );

  const prompt = promptToAI(ocrText);
  if (DEBUG) {
    console.log("[DEBUG] 生成されたプロンプト長:", prompt.length);
    console.log("[DEBUG] プロンプト全文:");
    console.log("=== プロンプト開始 ===");
    console.log(prompt);
    console.log("=== プロンプト終了 ===");
  }

  const payload = {
    model: AI_MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
  };

  const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  try {
    DEBUG && console.log("[DEBUG] API呼び出し中...");
    const response = UrlFetchApp.fetch(
      "https://api.openai.com/v1/chat/completions",
      options,
    );
    DEBUG && console.log("[DEBUG] API応答", response.getResponseCode());

    const result = JSON.parse(response.getContentText());
    DEBUG &&
      console.log(
        "[DEBUG] API完全レスポンス:",
        JSON.stringify(result, null, 2),
      );

    const rawText = result.choices?.[0]?.message?.content;

    if (!rawText) {
      DEBUG &&
        console.log("[DEBUG] 空の応答 - result.choices:", result.choices);
      return null;
    }

    // レスポンスをクリーニングしてからJSON.parse
    const cleanedText = cleanAIResponse(rawText);
    DEBUG && console.log("AI生レスポンス:", rawText);
    DEBUG && console.log("クリーニング後:", cleanedText);

    // nullチェック
    if (cleanedText === "null") {
      DEBUG &&
        console.log(
          "[DEBUG] AIがnullを返却 - 理由: データが認識できない、またはプロンプトに問題がある可能性",
        );
      DEBUG && console.log("[DEBUG] 元のOCRテキストを再確認:", ocrText);
      DEBUG && console.log("[DEBUG] プロンプト再確認が必要です");

      // 緊急時の手動パース（デバッグ用）
      if (DEBUG && ocrText.includes("¥")) {
        console.log("[DEBUG] 手動パースを試行中...");
        console.log("[DEBUG] OCRデータにある行数:", ocrText.split("\n").length);
        const manualResult = tryManualParse(ocrText);
        if (manualResult) {
          console.log("[DEBUG] 手動パース成功:", manualResult.length, "件");
          console.log(
            "[DEBUG] 手動パース結果サンプル:",
            JSON.stringify(manualResult[0], null, 2),
          );
          return manualResult;
        }
        console.log("[DEBUG] 手動パースも失敗");
      }

      return null;
    }

    const parsed = JSON.parse(cleanedText);
    DEBUG &&
      console.log("[DEBUG] パース成功", typeof parsed, Array.isArray(parsed));

    // ★ 単一オブジェクトだった場合は配列に変換
    let result_data: AIExtractedData;
    if (Array.isArray(parsed)) {
      result_data = parsed;
    } else if (typeof parsed === "object" && parsed !== null) {
      result_data = [parsed];
      DEBUG && console.log("[DEBUG] 配列変換");
    } else {
      DEBUG && console.log("[DEBUG] 不正なデータ形式", parsed);
      return null;
    }

    // ★ クレジットカード明細の引き落とし日を自動設定
    const { year, month } = getCurrentYearMonth();
    const lastWeekday = getLastWeekdayOfMonth(year, month);

    result_data = result_data.map((item) => {
      if ("引き落とし日" in item) {
        // クレジットカード明細の場合、引き落とし日を当月平日最終日に設定
        item.引き落とし日 = lastWeekday;
        DEBUG && console.log(`クレカ明細の引き落とし日を設定: ${lastWeekday}`);
      }
      return item;
    });

    DEBUG && console.log("[DEBUG] 処理完了", { 件数: result_data.length });
    return result_data;
  } catch (e) {
    DEBUG && console.log("[DEBUG] エラー発生", e);
    console.error("extractDataFromAI JSONパース失敗:", e);
    if (e instanceof Error) {
      console.error("エラー詳細:", e.message);
    }
    return null;
  }
}

/**
 * AIレスポンスをクリーニングしてJSON形式にする
 * @param response AI APIの生レスポンス
 * @returns クリーニングされたJSON文字列
 */
function cleanAIResponse(response: string): string {
  let cleaned = response;

  // 1. マークダウンのコードブロックを除去
  cleaned = cleaned.replace(/```json\s*/g, "");
  cleaned = cleaned.replace(/```\s*/g, "");

  // 2. BOM除去
  cleaned = cleaned.replace(/^\uFEFF/, "");

  // 3. 前後の空白を除去
  cleaned = cleaned.trim();

  // 4. 特殊な引用符を正規化
  cleaned = cleaned.replace(/[""]/g, '"');
  cleaned = cleaned.replace(/['']/g, "'");

  // 5. JSON開始文字より前の文字を除去
  const jsonStartPatterns = [
    cleaned.indexOf("{"),
    cleaned.indexOf("["),
    cleaned.indexOf("null"),
  ].filter((index) => index !== -1);

  if (jsonStartPatterns.length > 0) {
    const startIndex = Math.min(...jsonStartPatterns);
    if (startIndex > 0) {
      cleaned = cleaned.substring(startIndex);
    }
  }

  // 6. JSON終了文字より後の文字を除去
  let jsonEndIndex = -1;
  if (cleaned.startsWith("{")) {
    jsonEndIndex = cleaned.lastIndexOf("}");
  } else if (cleaned.startsWith("[")) {
    jsonEndIndex = cleaned.lastIndexOf("]");
  } else if (cleaned.trim() === "null") {
    return "null";
  }

  if (jsonEndIndex > 0) {
    cleaned = cleaned.substring(0, jsonEndIndex + 1);
  }

  // 7. 最終トリム
  cleaned = cleaned.trim();

  return cleaned;
}
// import * as env from "./env";
// const API_KEY = env.OPEN_AI_API_KEY;
// const AI_MODEL = env.OPEN_AI_MODEL;

// import { promptToAI } from "./prompt";
// import type { AIExtractedData, ReceiptData, CreditCardDataItem } from "./types";

// /**
//  * 指定年月の平日最終日を取得
//  * @param year 年
//  * @param month 月（1-12）
//  * @returns MM/DD形式の日付文字列
//  */
// function getLastWeekdayOfMonth(year: number, month: number): string {
//   const lastDay = new Date(year, month, 0); // 月末日を取得

//   // 平日最終日を見つける（土日を避ける）
//   while (lastDay.getDay() === 0 || lastDay.getDay() === 6) { // 日曜(0)または土曜(6)
//     lastDay.setDate(lastDay.getDate() - 1);
//   }

//   const mm = String(month).padStart(2, '0');
//   const dd = String(lastDay.getDate()).padStart(2, '0');
//   return `${mm}/${dd}`;
// }

// /**
//  * 現在の年月を取得
//  * @returns {year: number, month: number}
//  */
// function getCurrentYearMonth(): {year: number, month: number} {
//   const now = new Date();
//   return {
//     year: now.getFullYear(),
//     month: now.getMonth() + 1 // getMonth()は0ベースなので+1
//   };
// }

// // 返却を常に配列形式に統一する
// export function extractDataFromAI(ocrText: string): AIExtractedData | null {
//   const prompt = promptToAI(ocrText);

//   const payload = {
//     model: AI_MODEL,
//     messages: [{ role: "user", content: prompt }],
//     temperature: 0.2,
//   };

//   const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
//     method: "post",
//     contentType: "application/json",
//     headers: {
//       Authorization: `Bearer ${API_KEY}`,
//     },
//     payload: JSON.stringify(payload),
//     muteHttpExceptions: true,
//   };

//   try {
//     const response = UrlFetchApp.fetch(
//       "https://api.openai.com/v1/chat/completions",
//       options,
//     );

//     const result = JSON.parse(response.getContentText());
//     const rawText = result.choices?.[0]?.message?.content;

//     if (!rawText) return null;

//     // レスポンスをクリーニングしてからJSON.parse
//     const cleanedText = cleanAIResponse(rawText);
//     console.log("AI生レスポンス:", rawText.slice(0, 100));
//     console.log("クリーニング後:", cleanedText.slice(0, 100));

//     // nullチェック
//     if (cleanedText === 'null') {
//       return null;
//     }

//     const parsed = JSON.parse(cleanedText);

//     // ★ 単一オブジェクトだった場合は配列に変換
//     let result_data: AIExtractedData;
//     if (Array.isArray(parsed)) {
//       result_data = parsed;
//     } else if (typeof parsed === "object" && parsed !== null) {
//       result_data = [parsed];
//     } else {
//       return null;
//     }

//     // ★ クレジットカード明細の引き落とし日を自動設定
//     const { year, month } = getCurrentYearMonth();
//     const lastWeekday = getLastWeekdayOfMonth(year, month);

//     result_data = result_data.map(item => {
//       if ("引き落とし日" in item) {
//         // クレジットカード明細の場合、引き落とし日を当月平日最終日に設定
//         item.引き落とし日 = lastWeekday;
//         console.log(`クレカ明細の引き落とし日を設定: ${lastWeekday}`);
//       }
//       return item;
//     });

//     return result_data;

//   } catch (e) {
//     console.error("extractDataFromAI JSONパース失敗:", e);
//     if (e instanceof Error) {
//       console.error("エラー詳細:", e.message);
//     }
//     return null;
//   }
// }

// /**
//  * AIレスポンスをクリーニングしてJSON形式にする
//  * @param response AI APIの生レスポンス
//  * @returns クリーニングされたJSON文字列
//  */
// function cleanAIResponse(response: string): string {
//   let cleaned = response;

//   // 1. マークダウンのコードブロックを除去
//   cleaned = cleaned.replace(/```json\s*/g, '');
//   cleaned = cleaned.replace(/```\s*/g, '');

//   // 2. BOM除去
//   cleaned = cleaned.replace(/^\uFEFF/, '');

//   // 3. 前後の空白を除去
//   cleaned = cleaned.trim();

//   // 4. 特殊な引用符を正規化
//   cleaned = cleaned.replace(/[""]/g, '"');
//   cleaned = cleaned.replace(/['']/g, "'");

//   // 5. JSON開始文字より前の文字を除去
//   const jsonStartPatterns = [
//     cleaned.indexOf('{'),
//     cleaned.indexOf('['),
//     cleaned.indexOf('null')
//   ].filter(index => index !== -1);

//   if (jsonStartPatterns.length > 0) {
//     const startIndex = Math.min(...jsonStartPatterns);
//     if (startIndex > 0) {
//       cleaned = cleaned.substring(startIndex);
//     }
//   }

//   // 6. JSON終了文字より後の文字を除去
//   let jsonEndIndex = -1;
//   if (cleaned.startsWith('{')) {
//     jsonEndIndex = cleaned.lastIndexOf('}');
//   } else if (cleaned.startsWith('[')) {
//     jsonEndIndex = cleaned.lastIndexOf(']');
//   } else if (cleaned.trim() === 'null') {
//     return 'null';
//   }

//   if (jsonEndIndex > 0) {
//     cleaned = cleaned.substring(0, jsonEndIndex + 1);
//   }

//   // 7. 最終トリム
//   cleaned = cleaned.trim();

//   return cleaned;
// }
