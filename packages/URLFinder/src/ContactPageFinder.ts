/**
 * ContactPageFinder - リファクタリング版メインオーケストレーター
 * 役割: 各戦略の順次実行とフォールバック管理
 * 
 * 設計思想:
 * - 既存APIとの完全互換性を維持
 * - Strategy パターンによる戦略の切り替え
 * - 責務分離による保守性向上
 * - Phase 3で作成したモジュールとの統合
 */

import { ContactPageResult, SearchStrategy } from './types/interfaces';
import { UrlPatternStrategy } from './strategies/UrlPatternStrategy';
import { HtmlAnalysisStrategy } from './strategies/HtmlAnalysisStrategy';
import { FallbackStrategy } from './strategies/FallbackStrategy';

export class ContactPageFinder {
  
  /**
   * 検索戦略の配列（優先順位順）
   * 各戦略は独立してテスト可能
   */
  private static strategies: SearchStrategy[] = [
    new UrlPatternStrategy(),    // Step1: URLパターン推測
    new HtmlAnalysisStrategy(),  // Step2: HTML解析
    new FallbackStrategy()       // 最終フォールバック
  ];

  /**
   * 問い合わせページ検索の実行
   * 
   * @param baseUrl 検索対象のベースURL
   * @returns ContactPageResult 検索結果
   * 
   * 既存APIとの完全互換性を維持:
   * - 入力パラメータ: string (baseURL)
   * - 出力形式: ContactPageResult
   * - 戻り値構造: 一切の変更なし
   * - 既存の呼び出し元コードは無修正で動作
   * 
   * 新機能追加:
   * - Strategy パターンによる柔軟な戦略追加
   * - 各戦略の独立テスト対応
   * - エラーハンドリングの統一化
   * - ログ出力の標準化
   */
  static findContactPage(baseUrl: string): ContactPageResult {
    console.log(`\n=== ContactPageFinder開始: ${baseUrl} ===`);
    const startTime = Date.now();

    try {
      // 入力値検証
      if (!baseUrl || typeof baseUrl !== 'string') {
        console.log('❌ 無効なURL入力');
        return {
          contactUrl: null,
          actualFormUrl: null,
          foundKeywords: ['invalid_input'],
          searchMethod: 'invalid_input'
        };
      }

      // 各戦略を順次実行
      for (const strategy of this.strategies) {
        const strategyName = strategy.getStrategyName();
        console.log(`\n--- ${strategyName} 実行開始 ---`);
        
        try {
          const result = strategy.search(baseUrl);
          
          if (result && result.contactUrl) {
            const elapsed = Date.now() - startTime;
            console.log(`✅ ${strategyName} 成功! (${elapsed}ms)`);
            console.log(`   結果URL: ${result.contactUrl}`);
            console.log(`   検索手法: ${result.searchMethod}`);
            console.log(`   キーワード: ${result.foundKeywords.join(', ')}`);
            
            return result;
          } else {
            console.log(`❌ ${strategyName} 失敗 - 次の戦略へ`);
          }
          
        } catch (error) {
          console.log(`💥 ${strategyName} エラー: ${error}`);
          // エラーが発生しても次の戦略を試行
          continue;
        }
      }

      // 全戦略失敗時
      const elapsed = Date.now() - startTime;
      console.log(`❌ 全戦略失敗 (${elapsed}ms) - 問い合わせページ未発見`);
      
      return {
        contactUrl: null,
        actualFormUrl: null,
        foundKeywords: ['not_found'],
        searchMethod: 'all_strategies_failed'
      };

    } catch (error) {
      console.log(`💥 ContactPageFinder致命的エラー: ${error}`);
      
      return {
        contactUrl: null,
        actualFormUrl: null,
        foundKeywords: ['system_error'],
        searchMethod: 'system_error'
      };
    }
  }

  /**
   * 利用可能な戦略一覧を取得（デバッグ用）
   * @returns 戦略名の配列
   */
  static getAvailableStrategies(): string[] {
    return this.strategies.map(strategy => strategy.getStrategyName());
  }

  /**
   * 特定戦略のみを実行（テスト用）
   * @param baseUrl 検索対象URL
   * @param strategyIndex 戦略インデックス（0: URL Pattern, 1: HTML Analysis, 2: Fallback）
   * @returns 検索結果
   */
  static executeSpecificStrategy(baseUrl: string, strategyIndex: number): ContactPageResult | null {
    if (strategyIndex < 0 || strategyIndex >= this.strategies.length) {
      console.log(`❌ 無効な戦略インデックス: ${strategyIndex}`);
      return null;
    }

    const strategy = this.strategies[strategyIndex];
    console.log(`🎯 特定戦略実行: ${strategy.getStrategyName()}`);
    
    try {
      return strategy.search(baseUrl);
    } catch (error) {
      console.log(`💥 戦略実行エラー: ${error}`);
      return null;
    }
  }

  /**
   * 戦略の動的追加（拡張用）
   * 新しい検索手法を実行時に追加可能
   * @param strategy 追加する戦略
   * @param position 挿入位置（省略時は末尾）
   */
  static addStrategy(strategy: SearchStrategy, position?: number): void {
    if (position !== undefined && position >= 0 && position <= this.strategies.length) {
      this.strategies.splice(position, 0, strategy);
    } else {
      this.strategies.push(strategy);
    }
    
    console.log(`✅ 戦略追加: ${strategy.getStrategyName()}`);
    console.log(`   現在の戦略数: ${this.strategies.length}`);
  }

  /**
   * 戦略のリセット（テスト用）
   * デフォルト戦略に戻す
   */
  static resetStrategies(): void {
    this.strategies = [
      new UrlPatternStrategy(),
      new HtmlAnalysisStrategy(),
      new FallbackStrategy()
    ];
    console.log('🔄 戦略をデフォルトにリセット');
  }
}