export type InvoiceData = {
  請求日: string;
  請求書番号: string;
  顧客名?: string;
  入金締切日?: string;
  件名?: string;
  摘要?: string;
  数量?: string;
  単価?: string;
  備考?: string;
  登録日時?: string;
};

export type SpreadsheetOutputData = {
  請求日: string;
  請求書番号: string;
  住所: string;
  入金締切日: string;
  金額: number;
  備考: string;
};