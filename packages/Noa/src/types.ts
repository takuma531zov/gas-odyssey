export type ReceiptData = {
  店舗名: string;
  日付: string;
  合計金額税込: string;
  "税率8%対象金額税込": string;
  "税率10%対象金額税込": string;
  軽減税率対象あり: boolean;
};

export type CreditCardDataItem = {
  引き落とし日: string;
  店舗名: string;
  カード名: string;
  利用日: string;
  金額: string;
  表示用店舗名: string;
};

// ★ ReceiptData も配列で返す前提に統一！
export type AIExtractedData = (ReceiptData | CreditCardDataItem)[];
