/**
 * スプレッドシート処理システム
 * GASスプレッドシート操作の統合管理
 */

export class SpreadsheetProcessor {
  /**
   * MAX_COUNT設定値を取得
   */
  static getMaxCountSetting(): number {
    try {
      console.log('PropertiesService.getScriptProperties()実行中...');
      const properties = PropertiesService.getScriptProperties();
      console.log('プロパティサービス取得完了');

      console.log('MAX_COUNTプロパティ取得中...');
      const maxCountStr = properties.getProperty('MAX_COUNT');
      console.log(`MAX_COUNTプロパティ値: "${maxCountStr}"`);

      if (!maxCountStr) {
        console.log('MAX_COUNTが未設定、デフォルト値10を使用');
        return 10;
      }

      const parsed = parseInt(maxCountStr, 10);
      if (isNaN(parsed) || parsed <= 0) {
        console.log(`MAX_COUNTの値が無効: "${maxCountStr}", デフォルト値10を使用`);
        return 10;
      }

      console.log(`MAX_COUNT設定値: ${parsed}`);
      return parsed;
    } catch (error) {
      console.error('getMaxCountSetting()エラー:', error);
      return 10; // デフォルト値
    }
  }
}