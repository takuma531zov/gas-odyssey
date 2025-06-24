import * as env from "./env";
const API_KEY = env.OPEN_AI_API_KEY;
const AI_MODEL = env.OPEN_AI_MODEL;

import { promptToAI } from "./prompt";
import type { AIExtractedData, ReceiptData, CreditCardDataItem } from "./types";

// 返却を常に配列形式に統一する
export function extractDataFromAI(ocrText: string): AIExtractedData | null {
  const prompt = promptToAI(ocrText);

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
    const response = UrlFetchApp.fetch(
      "https://api.openai.com/v1/chat/completions",
      options,
    );

    const result = JSON.parse(response.getContentText());
    const rawText = result.choices?.[0]?.message?.content;

    if (!rawText) return null;

    const parsed = JSON.parse(rawText);

    // ★ 単一オブジェクトだった場合は配列に変換
    if (Array.isArray(parsed)) {
      return parsed; // 複数レシート or クレカ明細（配列）
    }
    if (typeof parsed === "object" && parsed !== null) {
      return [parsed]; // 単一レシート（オブジェクト → 配列にする）
    }
    return null; // それ以外は無効
  } catch (e) {
    console.error("extractDataFromAI JSONパース失敗:", e);
    return null;
  }
}
