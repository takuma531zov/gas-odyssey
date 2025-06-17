import { OPEN_AI_API_KEY, OPEN_AI_MODEL } from "./env";
const API_KEY = OPEN_AI_API_KEY; // OpenAI APIキー
const AI_MODEL = OPEN_AI_MODEL; // OpenAIモデル名
import { promptToAI } from "./prompt";

export function extractDataFromAI(ocrText: string): unknown | null {
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
