/**
 * フォーム処理ユーティリティ
 * 44ac0de最適版から安全に抽出された関数群
 */

export class FormUtils {
  // 送信系ボタンキーワード（BtoB問い合わせ特化）
  private static readonly SUBMIT_BUTTON_KEYWORDS = [
    // 基本送信キーワード
    '送信', '送る', 'submit', 'send',

    // 問い合わせ関連のみ（営業系削除）
    'お問い合わせ', '問い合わせ', 'お問合せ', '問合せ',
    'ご相談', '相談', 'contact', 'inquiry'
  ];

  /**
   * 送信系キーワードの存在確認
   * @param buttonHTML ボタンのHTML文字列
   * @returns 送信系キーワードが含まれているか
   */
  static containsSubmitKeyword(buttonHTML: string): boolean {
    const lowerHTML = buttonHTML.toLowerCase();

    for (const keyword of this.SUBMIT_BUTTON_KEYWORDS) {
      if (lowerHTML.includes(keyword.toLowerCase())) {
        console.log(`Submit keyword found: ${keyword}`);
        return true;
      }
    }

    return false;
  }
}