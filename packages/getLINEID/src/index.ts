import { LINE_BOT_TOKEN } from "./env";

/**
 * シートをクリアしてヘッダーを設定
 */
function initSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("WebhookLog");

  // シートが存在しない場合は作成
  if (!sheet) {
    sheet = ss.insertSheet("WebhookLog");
  }

  // シート全体をクリア
  sheet.clear();

  // ヘッダー行を追加
  sheet.appendRow(["タイムスタンプ", "メッセージ"]);
  sheet.getRange(1, 1, 1, 2).setFontWeight("bold");

  return sheet;
}

/**
 * ログをスプレッドシートに書き込む
 * @param sheet シートオブジェクト
 * @param message ログメッセージ
 */
function writeToSheet(
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
  message: string,
) {
  try {
    // ログを追記
    sheet.appendRow([new Date(), message]);
  } catch (error) {
    // スプレッドシート書き込みに失敗してもエラーにしない
    Logger.log(`シート書き込みエラー: ${error}`);
  }
}

/**
 * WebhookからのPOSTリクエストを受け取る
 * LINEからのメッセージイベントを処理してグループIDを取得
 */
function doPost(e: GoogleAppsScript.Events.DoPost) {
  // シートをクリアして初期化
  const sheet = initSheet();

  try {
    // リクエストボディをパース
    const data = JSON.parse(e.postData.contents);

    // 全データをシートに出力
    writeToSheet(sheet, "=== 受信データ ===");
    writeToSheet(sheet, JSON.stringify(data, null, 2));

    // イベントを処理
    if (data.events && data.events.length > 0) {
      for (const event of data.events) {
        // ソースタイプに応じてIDを取得
        const source = event.source;
        let idInfo = "";
        let idValue = "";

        if (source.type === "group") {
          idInfo = `【グループID】 ${source.groupId}`;
          idValue = source.groupId;
        } else if (source.type === "room") {
          idInfo = `【ルームID】 ${source.roomId}`;
          idValue = source.roomId;
        } else if (source.type === "user") {
          idInfo = `【ユーザーID】 ${source.userId}`;
          idValue = source.userId;
        }

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
      }
    }

    // LINEに200 OKを返す
    return ContentService.createTextOutput(
      JSON.stringify({ status: "ok" }),
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    const errorMsg = `エラー: ${error}`;
    writeToSheet(sheet, errorMsg);
    return ContentService.createTextOutput(
      JSON.stringify({ status: "error", message: String(error) }),
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 指定したグループの詳細情報を取得（オプション）
 * @param groupId グループID
 */
function getGroupInfo(groupId: string) {
  if (!LINE_BOT_TOKEN) {
    throw new Error("LINE_BOT_TOKENが設定されていません");
  }

  const url = `https://api.line.me/v2/bot/group/${groupId}/summary`;

  const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: "get",
    headers: {
      Authorization: `Bearer ${LINE_BOT_TOKEN}`,
    },
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const groupInfo = JSON.parse(response.getContentText());

    Logger.log("グループ情報:");
    Logger.log(`グループID: ${groupInfo.groupId}`);
    Logger.log(`グループ名: ${groupInfo.groupName}`);
    Logger.log(`グループ画像URL: ${groupInfo.pictureUrl || "なし"}`);

    return groupInfo;
  } catch (error) {
    Logger.log(`グループ情報取得エラー: ${error}`);
    throw error;
  }
}

// GASから呼び出せるようにグローバル関数として公開
declare const global: {
  doPost: typeof doPost;
  getGroupInfo: typeof getGroupInfo;
};

global.doPost = doPost;
global.getGroupInfo = getGroupInfo;
