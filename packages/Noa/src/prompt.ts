export const promptToAI = (ocrText: string): string => `
あなたはレシート情報を正確に読み取り、以下の形式で項目を抽出するAIです。

### 入力されたレシート全文:
${ocrText}

### 出力フォーマット:
{
  "店舗名": string,
  "日付": string,
  "合計金額": string
}

上記形式に沿ってJSONで返してください。
`;
