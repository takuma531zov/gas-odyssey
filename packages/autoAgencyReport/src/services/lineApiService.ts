import { LINE_BOT_TOKEN } from "../env";

/**
 * LINEグループ情報
 */
interface GroupInfo {
  groupId: string;
  groupName: string;
  pictureUrl?: string;
}

/**
 * 指定したグループの詳細情報を取得
 * @param groupId グループID
 * @returns グループ情報
 */
export const getGroupInfo = (groupId: string): GroupInfo => {
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
    const groupInfo = JSON.parse(response.getContentText()) as GroupInfo;

    Logger.log("グループ情報:");
    Logger.log(`グループID: ${groupInfo.groupId}`);
    Logger.log(`グループ名: ${groupInfo.groupName}`);
    Logger.log(`グループ画像URL: ${groupInfo.pictureUrl || "なし"}`);

    return groupInfo;
  } catch (error) {
    Logger.log(`グループ情報取得エラー: ${error}`);
    throw error;
  }
};
