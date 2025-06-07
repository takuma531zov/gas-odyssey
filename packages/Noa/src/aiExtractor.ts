import { SCRIPT_PROPERTIES } from "./env";
const API_KEY = SCRIPT_PROPERTIES.OPEN_AI_API_KEY; // OpenAI APIキー
const AI_MODEL = SCRIPT_PROPERTIES.OPEN_AI_MODEL; // OpenAIモデル名
import { promptToAI } from "./prompt";
import { runOcr } from "./ocr";
const ocrText = runOcr(); // OCR処理を実行してテキストを取得

function extractDataFromAI(ocrText: string): string | null {
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

  const response = UrlFetchApp.fetch(
    "https://api.openai.com/v1/chat/completions",
    options,
  );
  const result = JSON.parse(response.getContentText());

  try {
    const rawText = result.choices?.[0]?.message?.content;
    return JSON.parse(rawText || "{}");
  } catch (e) {
    console.error("JSONパース失敗:", e);
    return null;
  }
}
