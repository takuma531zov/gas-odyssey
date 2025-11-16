import { writeToSheet } from "./lineSheetService";

/**
 * LINE Webhookイベントのソースタイプ
 */
type LineEventSource =
  | { type: "group"; groupId: string }
  | { type: "room"; roomId: string }
  | { type: "user"; userId: string };

/**
 * LINE Webhookイベント
 */
interface LineEvent {
  type: string;
  source: LineEventSource;
  message?: {
    text?: string;
  };
}

/**
 * LINE Webhook受信データ
 */
interface LineWebhookData {
  events?: LineEvent[];
}

/**
 * イベントソースからID情報を抽出
 * @param source イベントソース
 * @returns ID情報とID値
 */
const extractIdFromSource = (
  source: LineEventSource,
): { idInfo: string; idValue: string } => {
  if (source.type === "group") {
    return {
      idInfo: `【グループID】 ${source.groupId}`,
      idValue: source.groupId,
    };
  }
  if (source.type === "room") {
    return {
      idInfo: `【ルームID】 ${source.roomId}`,
      idValue: source.roomId,
    };
  }
  if (source.type === "user") {
    return {
      idInfo: `【ユーザーID】 ${source.userId}`,
      idValue: source.userId,
    };
  }
  return { idInfo: "", idValue: "" };
};

/**
 * イベント情報をシートに記録
 * @param sheet シートオブジェクト
 * @param event LINEイベント
 */
const logEventToSheet = (
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
  event: LineEvent,
): void => {
  const { idInfo, idValue } = extractIdFromSource(event.source);

  writeToSheet(sheet, `イベントタイプ: ${event.type}`);
  writeToSheet(sheet, idInfo);

  // メッセージイベントの場合、内容も表示
  if (event.type === "message" && event.message) {
    writeToSheet(
      sheet,
      `メッセージ: ${event.message.text || "(テキスト以外)"}`,
    );
  }

  // 重要: IDを目立つ形で表示
  if (idValue) {
    writeToSheet(sheet, `>>> コピーしてください: ${idValue} <<<`);
  }
};

/**
 * Webhookイベントデータを処理
 * @param sheet シートオブジェクト
 * @param data Webhookデータ
 */
export const processWebhookEvents = (
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
  data: LineWebhookData,
): void => {
  // 全データをシートに出力
  writeToSheet(sheet, "=== 受信データ ===");
  writeToSheet(sheet, JSON.stringify(data, null, 2));

  // イベントを処理
  if (data.events && data.events.length > 0) {
    for (const event of data.events) {
      logEventToSheet(sheet, event);
    }
  }
};
