/**
 * 🐛 URLFinder デバッグ専用モジュール
 *
 * 開発・検証・ステークホルダー説明用の可視化機能を提供
 * 本番処理には影響せず、デバッグ時のみ使用
 *
 * 主な用途:
 * - 処理フロー理解
 * - ステークホルダー向けデモ
 * - 開発時のトラブルシューティング
 * - 新規開発者の学習支援
 */

import type { ContactPageResult } from "./common/types";
import {
  createEmptyState,
  getCandidateCount,
  getValidUrls,
} from "./common/state";
import type { SearchStateData } from "./common/types";
import { extractDomain } from "./common/network/url";
import { snsCheck, domainCheck } from "./flows/00_preprocessing";
import { urlPatternSearch } from "./flows/01_urlPattern";
import { htmlAnalysisSearch } from "./flows/02_htmlAnalysis";
import { fallbackSearch } from "./flows/03_fallback";

/**
 * 🎯 URLFinder処理フロー完全可視化関数
 *
 * 既存ロジックを100%維持しながら、各関数を順次呼び出して処理フローを詳細表示
 * contactPageFinder.tsのfindContactPageと完全に同じ処理順序・結果を保証
 *
 * ロジック保護: 既存のContactPageFinder.findContactPageと完全同一の処理
 * 可視化強化: 各ステップの実行状況と結果を詳細にコンソール出力
 * デバッグ支援: エラー箇所の特定、処理時間の測定、中間状態の確認
 *
 * 使用方法: 関数内のTEST_URLを変更して実行
 */
export function findContactPageWithVisibility(): ContactPageResult {
  // 🎯 テスト対象URL（ここを変更して実行）
  const TEST_URL = "https://example.co.jp/";

  const baseUrl = TEST_URL;
  console.log("");
  console.log("=== 🐛 URLFinder デバッグモード: 完全可視化処理フロー開始 ===");
  console.log(`🔍 対象URL: ${baseUrl}`);
  console.log(`⏱️  開始時刻: ${new Date().toLocaleTimeString()}`);
  console.log("");

  const startTime = Date.now();

  // ============================================
  // ステップ1: SearchState初期化（既存ロジック完全維持）
  // ============================================
  console.log("🔧 ステップ1: SearchState初期化");
  console.log("  └─ 検索状態管理オブジェクトを作成");
  console.log("      ├─ 候補ページ蓄積用配列初期化");
  console.log("      ├─ 有効URL記録用配列初期化");
  console.log("      └─ HTMLキャッシュ初期化");
  let state = createEmptyState();
  console.log("  ✅ SearchState初期化完了");
  console.log("");

  // ============================================
  // ステップ2: SNSページ判定（既存ロジック完全維持）
  // ============================================
  console.log("📱 ステップ2: SNSページ判定");
  console.log(
    "  └─ Twitter、Facebook、Instagram、LinkedIn等のSNSサイトかチェック",
  );
  const snsResult = snsCheck(baseUrl);

  if (snsResult) {
    console.log("  ❌ SNSページと判定 → URLFinderは非対応のため処理終了");
    console.log(
      "      理由: SNSサイトは問い合わせフォームの構造が特殊で検出困難",
    );
    console.log(`  ⏱️  処理時間: ${Date.now() - startTime}ms`);
    console.log(
      "=== 🐛 URLFinder デバッグモード: 完全可視化処理フロー完了 ===",
    );
    return snsResult;
  }
  console.log("  ✅ 一般Webサイトと判定 → 処理続行");
  console.log("");

  // ============================================
  // ステップ3: ドメイン可用性チェック（既存ロジック完全維持）
  // ============================================
  console.log("🌐 ステップ3: ドメイン可用性チェック");
  console.log("  └─ サイトアクセス可能性を事前検証");
  console.log("      ├─ DNS解決可能性チェック");
  console.log("      ├─ 基本的なHTTP接続テスト");
  console.log("      └─ Bot検出・アクセス拒否の確認");
  const domainCheckResult = domainCheck(baseUrl);

  if (domainCheckResult) {
    const errorMessage =
      domainCheckResult.foundKeywords[0] || "サイトが閉鎖されています";
    console.log(`  ❌ ドメインアクセスエラー: ${errorMessage}`);

    console.log(`  ⏱️  処理時間: ${Date.now() - startTime}ms`);
    console.log(
      "=== 🐛 URLFinder デバッグモード: 完全可視化処理フロー完了 ===",
    );
    return domainCheckResult;
  }
  console.log("  ✅ ドメイン正常アクセス可能 → 検索処理へ進行");
  console.log("");

  // ============================================
  // ステップ4: ドメインURL抽出（既存ロジック完全維持）
  // ============================================
  console.log("🔗 ステップ4: ドメインURL正規化");
  console.log("  └─ 検索対象URLを標準ドメイン形式に正規化");
  console.log("      ├─ プロトコル統一 (http/https)");
  console.log("      ├─ 末尾スラッシュ正規化");
  console.log("      └─ 不要なパス・クエリパラメータ除去");
  const domainUrl = extractDomain(baseUrl);
  console.log(`  ✅ 正規化完了: ${domainUrl}`);
  console.log(`      差分: ${baseUrl} → ${domainUrl}`);
  console.log("");

  // ============================================
  // ステップ5: 検索戦略1 - URLパターン検索（既存ロジック完全維持）
  // ============================================
  console.log("🎯 ステップ5: URLパターン検索戦略");
  console.log("  └─ 高確率問い合わせページURLパターンを順次テスト");
  console.log(
    "      検索対象パターン: /contact, /inquiry, /form, /contact-us 等",
  );
  console.log("      各パターンでHTTPアクセス → レスポンス解析 → フォーム検証");

  const urlPatternStartTime = Date.now();
  const urlPattern = urlPatternSearch(domainUrl, state);
  state = urlPattern.newState;
  const urlPatternResult = urlPattern.result;
  const urlPatternTime = Date.now() - urlPatternStartTime;

  if (urlPatternResult) {
    console.log("  ✅ URLパターン検索成功!");
    console.log(`      ├─ 発見URL: ${urlPatternResult.contactUrl}`);
    console.log(`      ├─ 実際フォーム: ${urlPatternResult.actualFormUrl}`);
    console.log(`      ├─ 検索方法: ${urlPatternResult.searchMethod}`);
    console.log(
      `      ├─ 発見キーワード: ${urlPatternResult.foundKeywords.join(", ")}`,
    );
    console.log(`      ├─ 処理時間: ${urlPatternTime}ms`);
    console.log("      └─ 高確率パターンで発見のため後続戦略をスキップ");
    console.log(`  ⏱️  総処理時間: ${Date.now() - startTime}ms`);
    console.log(
      "=== 🐛 URLFinder デバッグモード: 完全可視化処理フロー完了 ===",
    );
    return urlPatternResult;
  }
  console.log(`  ⚠️  URLパターン検索失敗 (処理時間: ${urlPatternTime}ms)`);
  console.log("      ├─ 一般的なURLパターンでは問い合わせページが見つからず");
  console.log("      └─ トップページ解析戦略に移行");
  console.log("");

  // ============================================
  // ステップ6: 検索戦略2 - トップページHTML解析（既存ロジック完全維持）
  // ============================================
  console.log("📄 ステップ6: トップページHTML解析戦略");
  console.log("  └─ トップページのHTMLコンテンツを詳細解析");
  console.log("      ├─ 埋め込みHTMLフォーム検出");
  console.log("      ├─ Googleフォーム・外部フォームURL抽出");
  console.log("      ├─ ナビゲーション・フッターリンク解析");
  console.log("      └─ 各候補の品質スコア計算");

  const htmlAnalysisStartTime = Date.now();
  const htmlAnalysis = htmlAnalysisSearch(domainUrl, state);
  state = htmlAnalysis.newState;
  const htmlAnalysisResult = htmlAnalysis.result;
  const htmlAnalysisTime = Date.now() - htmlAnalysisStartTime;

  if (htmlAnalysisResult) {
    console.log("  ✅ HTML解析成功!");
    console.log(`      ├─ 発見URL: ${htmlAnalysisResult.contactUrl}`);
    console.log(`      ├─ 実際フォーム: ${htmlAnalysisResult.actualFormUrl}`);
    console.log(`      ├─ 検索方法: ${htmlAnalysisResult.searchMethod}`);
    console.log(
      `      ├─ 発見キーワード: ${htmlAnalysisResult.foundKeywords.join(", ")}`,
    );
    console.log(`      ├─ 処理時間: ${htmlAnalysisTime}ms`);
    console.log("      └─ HTML解析で発見のためフォールバック戦略をスキップ");
    console.log(`  ⏱️  総処理時間: ${Date.now() - startTime}ms`);
    console.log(
      "=== 🐛 URLFinder デバッグモード: 完全可視化処理フロー完了 ===",
    );
    return htmlAnalysisResult;
  }
  console.log(`  ⚠️  HTML解析失敗 (処理時間: ${htmlAnalysisTime}ms)`);
  console.log("      ├─ トップページに有効な問い合わせフォーム情報なし");
  console.log("      └─ フォールバック戦略で蓄積情報を活用");
  console.log("");

  // ============================================
  // ステップ7: 検索戦略3 - フォールバック戦略（既存ロジック完全維持）
  // ============================================
  console.log("🔄 ステップ7: フォールバック戦略");
  console.log("  └─ SearchStateに蓄積された部分的成功情報を活用");
  console.log("      ├─ URLパターン検索で発見した200 OK URL群を評価");
  console.log("      ├─ 各URLの品質スコア計算 (URL構造、コンテンツ等)");
  console.log(
    "      ├─ 高優先度パターン優先選出 (/contact > /inquiry > /form)",
  );
  console.log("      └─ ベスト候補の最終選択");

  const fallbackStartTime = Date.now();
  const fallback = fallbackSearch(state);
  state = fallback.newState;
  const fallbackResult = fallback.result;
  const fallbackTime = Date.now() - fallbackStartTime;

  if (fallbackResult) {
    console.log("  ✅ フォールバック戦略成功!");
    console.log(`      ├─ 選出URL: ${fallbackResult.contactUrl}`);
    console.log(`      ├─ 実際フォーム: ${fallbackResult.actualFormUrl}`);
    console.log(`      ├─ 検索方法: ${fallbackResult.searchMethod}`);
    console.log(
      `      ├─ 発見キーワード: ${fallbackResult.foundKeywords.join(", ")}`,
    );
    console.log(`      ├─ 処理時間: ${fallbackTime}ms`);
    console.log("      └─ 💡 蓄積情報からベスト候補を選出成功");
    console.log(`  ⏱️  総処理時間: ${Date.now() - startTime}ms`);
    console.log(
      "=== 🐛 URLFinder デバッグモード: 完全可視化処理フロー完了 ===",
    );
    return fallbackResult;
  }
  console.log(`  ❌ フォールバック戦略も失敗 (処理時間: ${fallbackTime}ms)`);
  console.log("      ├─ 蓄積された情報でも有効な候補を特定できず");
  console.log("      └─ 全戦略で問い合わせフォーム検出失敗");
  console.log("");

  // ============================================
  // ステップ8: 全戦略失敗時の処理（既存ロジック完全維持）
  // ============================================
  console.log("💔 ステップ8: 全戦略失敗 - 検出不可能");
  console.log(
    "  └─ すべての検索戦略を実行したが問い合わせフォームを検出できず",
  );
  console.log("      考えられる原因:");
  console.log("      ├─ 問い合わせフォームが存在しない");
  console.log("      ├─ 非標準的な実装・配置");
  console.log("      ├─ JavaScript必須の動的フォーム");
  console.log("      ├─ 特殊な認証・アクセス制限");
  console.log("      └─ 予期しないサイト構造");
  console.log(`  ⏱️  総処理時間: ${Date.now() - startTime}ms`);
  console.log("=== 🐛 URLFinder デバッグモード: 完全可視化処理フロー完了 ===");

  return {
    contactUrl: null,
    actualFormUrl: null,
    foundKeywords: [],
    searchMethod: "not_found",
  };
}

/**
 * 📊 SearchState状態表示用デバッグ関数
 * 処理途中のSearchStateの内部状態を可視化
 */
export function displaySearchStateStatus(searchState: SearchStateData): void {
  console.log("📊 SearchState 現在状態:");
  console.log(`  ├─ 候補ページ数: ${getCandidateCount(searchState)}`);
  console.log(`  ├─ 有効URL数: ${getValidUrls(searchState).length}`);
  console.log("  └─ 蓄積情報を次戦略で活用");
}

// GAS用グローバル登録（デバッグ時のみ使用）
declare const global: {
  findContactPageWithVisibility?: typeof findContactPageWithVisibility;
};

// デバッグ時にのみグローバル関数として使用可能にする
if (typeof global !== "undefined") {
  global.findContactPageWithVisibility = findContactPageWithVisibility;
}
