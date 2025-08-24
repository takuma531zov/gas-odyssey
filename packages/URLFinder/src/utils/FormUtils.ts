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

  /**
   * JavaScript フォーム検出: <script>タグ + reCAPTCHA存在
   * @param html HTML文字列
   * @returns JavaScriptフォーム（reCAPTCHA）が存在するか
   */
  static hasScriptAndRecaptcha(html: string): boolean {
    // <script>タグの存在チェック
    const hasScript = /<script[^>]*>[\s\S]*?<\/script>/gi.test(html) || /<script[^>]*src=[^>]*>/gi.test(html);
    
    if (!hasScript) {
      console.log('No script tags found');
      return false;
    }

    console.log('Script tags found, checking for reCAPTCHA...');

    // reCAPTCHA検出パターン
    const recaptchaPatterns = [
      // Google reCAPTCHA スクリプトURL
      /https:\/\/www\.google\.com\/recaptcha\/api\.js/gi,
      /recaptcha\/api\.js/gi,
      
      // reCAPTCHA HTML要素
      /<div[^>]*class=["|'][^"|']*g-recaptcha[^"|']*["|']/gi,
      /<div[^>]*id=["|'][^"|']*recaptcha[^"|']*["|']/gi,
      
      // reCAPTCHA データ属性
      /data-sitekey=["|'][^"|']*["|']/gi,
      
      // reCAPTCHA テキスト（日本語・英語）
      /私はロボットではありません/gi,
      /I'm not a robot/gi,
      /reCAPTCHA/gi
    ];

    console.log('Checking reCAPTCHA patterns...');
    
    for (let i = 0; i < recaptchaPatterns.length; i++) {
      const pattern = recaptchaPatterns[i];
      if (!pattern) continue;
      
      const matches = html.match(pattern);
      
      if (matches && matches.length > 0) {
        console.log(`✅ reCAPTCHA pattern ${i + 1} matched: ${matches[0].substring(0, 100)}`);
        return true;
      }
    }

    console.log('No reCAPTCHA patterns found');
    return false;
  }
}