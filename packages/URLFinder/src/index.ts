// ==========================================
// 【URLFinder統合エントリーポイント】
// GAS環境での問い合わせページ検索システム
// ContactPageFinderクラスとGAS統合機能の橋渡し
// ==========================================

import type { ContactPageResult } from './types/interfaces';
import { ContactPageFinder } from './ContactPageFinder';

// ==========================================
// 【後方互換性ラッパー関数】
// 既存のコードとの互換性を維持
// ==========================================

/**
 * 後方互換性維持のためのラッパー関数
 * 既存の呼び出し元コードを変更せずに新しいアーキテクチャを使用可能
 *
 * @param url 検索対象URL
 * @returns ContactPageResult 検索結果
 *
 * 使用例:
 * const result = findContactPage('https://example.com');
 * console.log(result.contactUrl); // 問い合わせページURL
 * console.log(result.searchMethod); // 使用された検索手法
 */
function findContactPage(url: string): ContactPageResult {
  return ContactPageFinder.findContactPage(url);
}

// ==========================================
// 【メインエクスポート】
// ContactPageFinderクラスとGAS統合機能の統合エクスポート
// ==========================================

// ContactPageFinderクラスのエクスポート
export { ContactPageFinder } from './ContactPageFinder';

// 型定義のエクスポート
export type { ContactPageResult } from './types/interfaces';

// GAS統合機能は別ファイルで管理
// 実際のGAS関数は gas-integration.ts を参照

// ==========================================
// 【実行時注意事項】
// GAS環境での実行時は以下の関数群を利用:
// - processContactPageFinder(): メイン処理関数
// - test(): テスト実行関数  
// - executeUrlFinderWithUI(): UI付き実行関数
// これらの実装は gas-integration.ts を参照してください
// ==========================================