/**
 * 🔧 前処理フロー統合モジュール
 *
 * URLFinderの事前検証処理を統合実行
 * SNS判定とドメイン可用性チェックを一元化
 */

import { isSNSPage, checkDomainAvailability } from "../../common/network/fetch";
import type { ContactPageResult } from "../../common/types";

/**
 * SNSページ判定実行
 * @param baseUrl 判定対象URL
 * @returns SNSページの場合は結果オブジェクト、それ以外はnull
 */
export function snsCheck(baseUrl: string): ContactPageResult | null {
  if (isSNSPage(baseUrl)) {
    return {
      contactUrl: null,
      actualFormUrl: null,
      foundKeywords: ["sns_page"],
      searchMethod: "sns_not_supported",
    };
  }
  return null;
}

/**
 * エラーメッセージに基づき、検索エラーの種別を判定する
 * @param errorMessage ドメイン可用性チェック時のエラーメッセージ
 * @returns 分類された検索エラー種別
 */
function getSearchMethod(errorMessage: string): string {
  // エラーメッセージとエラー種別の対応ルール
  const rules: { test: (msg: string) => boolean; value: string }[] = [
    // DNS関連のエラー
    { test: (msg) => msg.includes("DNS"), value: "dns_error" },
    // Bot判定によるブロック or 特定のHTTPステータスコード
    { test: (msg) => /bot|Bot|403|501/.test(msg), value: "bot_blocked" },
    // タイムアウト関連のエラー
    {
      test: (msg) => msg.includes("timeout") || msg.includes("タイムアウト"),
      value: "timeout_error",
    },
    // デフォルトのエラーメッセージ（サイト閉鎖）
    { test: (msg) => msg === "サイトが閉鎖されています", value: "site_closed" },
  ];

  // マッチするルールを探す
  const rule = rules.find((r) => r.test(errorMessage));
  // マッチすればその値を、しなければ汎用エラーを返す
  return rule ? rule.value : "error";
}

/**
 * ドメインが有効かどうかをチェック
 * @param baseUrl チェック対象URL
 * @returns true: アクセス可能, false: 不可
 */
export function isDomainValid(baseUrl: string): boolean {
  const domainCheckResult = checkDomainAvailability(baseUrl);
  return domainCheckResult.available;
}

/**
 * ドメインエラー時の結果オブジェクトを作成
 * @param baseUrl チェック対象URL
 * @returns ドメインエラーの結果オブジェクト
 */
export function createDomainErrorResult(baseUrl: string): ContactPageResult {
  const domainCheckResult = checkDomainAvailability(baseUrl);
  const errorMessage = domainCheckResult.error || "サイトが閉鎖されています";
  const searchMethod = getSearchMethod(errorMessage);

  return {
    contactUrl: null,
    actualFormUrl: null,
    foundKeywords: [errorMessage],
    searchMethod,
  };
}
