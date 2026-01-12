// index.ts は純粋なGASエントリーポイント: ロジックは呼び出しのみ
// 機能: Instagram Webhook 検証およびイベント転送

import { handleDoGet } from "./modules/verify";
import { handleDoPost } from "./modules/forward";

/**
 * GETエンドポイント: Instagram Webhook 検証
 * - フロー: リクエスト受領 -> 検証ハンドラ呼び出し -> TextOutput返却
 */
function doGet(e: GoogleAppsScript.Events.DoGet) {
  return handleDoGet(e);
}

/**
 * POSTエンドポイント: Instagram WebhookイベントをDifyへ転送
 * - フロー: リクエスト受領 -> 転送ハンドラ呼び出し -> JSONレスポンス返却
 */
function doPost(e: GoogleAppsScript.Events.DoPost) {
  return handleDoPost(e);
}

// GASから呼び出せるようにグローバル関数として公開
declare const global: { [k: string]: unknown };
global.doGet = doGet;
global.doPost = doPost;
