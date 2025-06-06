import { SCRIPT_PROPERTIES } from "./env";
const API_KEY = SCRIPT_PROPERTIES.OPEN_AI_API_KEY; // OpenAI APIキー
const AI_MODEL = SCRIPT_PROPERTIES.OPEN_AI_MODEL; // OpenAIモデル名

function extractDataFromAI(ocrText: string): any {
  const prompt = `
次のレシートテキストから店名、日付、金額を抽出し、以下のJSON形式で出力してください：

{
  "store_name": "",
  "date": "",
  "amount": ""
}

テキスト:
${ocrText}
  `;

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
