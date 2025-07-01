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
 * クレジットカード明細OCRテキストに改行を挿入
 * 日付と金額パターンで取引を分離
 */
function formatCreditCardOCR(ocrText: string): string {
  return ocrText.trim();
}

/**
 * クレジットカード明細に金額を結合
 * OCRテキストから金額のみを抽出して順序で結合
 */
function mergeCreditCardAmounts(ocrText: string, transactions: AIExtractedData): AIExtractedData {
  const lines = ocrText.trim().split('\n');
  
  // 金額行（数字のみの行）を抽出
  const amounts = lines
    .filter(line => /^\d+$/.test(line.trim()) && parseInt(line.trim()) > 0)
    .map(line => line.trim());
  
  if (DEBUG) {
    console.log(`[DEBUG] 金額結合: 取引${transactions.length}件, 金額${amounts.length}件`);
  }

  // 取引数と金額数が一致する場合のみ結合
  if (transactions.length === amounts.length) {
    return transactions.map((transaction, index) => {
      if ("引き落とし日" in transaction) {
        return {
          ...transaction,
          金額: amounts[index]
        };
      }
      return transaction;
    });
  } else {
    if (DEBUG) {
      console.log(`[DEBUG] 金額結合スキップ: 件数不一致`);
    }
    return transactions;
  }
}

/**
 * クレジットカード明細データのクリーニング
 * 重複除去と金額0の行をフィルタリング
 */
function cleanCreditCardData(data: AIExtractedData): AIExtractedData {
  const cleaned: AIExtractedData = [];
  
  for (const item of data) {
    if ("引き落とし日" in item) {
      // クレジットカード明細の場合
      const { 金額 } = item;
      
      // 金額が0または空の場合のみスキップ
      const amount = parseInt(金額 || "0");
      if (amount <= 0) {
        continue;
      }
      
      cleaned.push(item);
    } else {
      // レシート等はそのまま追加
      cleaned.push(item);
    }
  }
  
  return cleaned;
}

// 返却を常に配列形式に統一する
export function extractDataFromAI(ocrText: string): AIExtractedData | null {
  DEBUG && console.log("[DEBUG] 処理開始", { ocrLength: ocrText.length });

  // クレジットカード明細の場合は改行処理を適用
  const formattedText = formatCreditCardOCR(ocrText);
  
  if (DEBUG) {
    console.log("=== OCR前処理デバッグ ===");
    console.log("元OCRテキスト（改行表示）:");
    ocrText.split('\n').forEach((line, index) => {
      console.log(`元行${index + 1}: "${line}"`);
    });
    console.log("\n前処理後テキスト（改行表示）:");
    formattedText.split('\n').forEach((line, index) => {
      console.log(`処理後行${index + 1}: "${line}"`);
    });
    console.log("==========================");
  }

  const prompt = promptToAI(formattedText);

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
    const rawText = result.choices?.[0]?.message?.content;

    if (!rawText) {
      DEBUG && console.log("[DEBUG] 空の応答");
      return null;
    }

    // レスポンスをクリーニングしてからJSON.parse
    const cleanedText = cleanAIResponse(rawText);
    DEBUG && console.log("AI生レスポンス:", rawText.slice(0, 100));
    DEBUG && console.log("クリーニング後:", cleanedText.slice(0, 100));

    // nullチェック
    if (cleanedText === "null") {
      DEBUG && console.log("[DEBUG] null応答");
      return null;
    }

    const parsed = JSON.parse(cleanedText);
    if (DEBUG) {
      console.log("=== AI抽出デバッグ情報 ===");
      console.log("AI生レスポンス（全文）:");
      console.log(rawText);
      console.log("\nクリーニング後（全文）:");
      console.log(cleanedText);
      console.log("\nパース結果:");
      console.log(JSON.stringify(parsed, null, 2));
      console.log("=========================");
    }

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


    // クレジットカード明細のクリーニング処理
    const beforeCleanCount = result_data.length;
    result_data = cleanCreditCardData(result_data);
    
    if (DEBUG) {
      console.log("[DEBUG] クリーニング結果", { 
        処理前件数: beforeCleanCount,
        処理後件数: result_data.length,
        除去件数: beforeCleanCount - result_data.length
      });
    }
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
