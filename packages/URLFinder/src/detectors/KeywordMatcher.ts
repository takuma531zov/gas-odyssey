/**
 * キーワード処理統合クラス
 * URL、リンクテキスト、HTML内容のキーワードマッチングを管理
 */

import { PurityResult, KeywordDetectionResult, ContactInfoResult } from '../types/interfaces';

export class KeywordMatcher {

  // 高優先度問い合わせキーワード
  private static readonly HIGH_PRIORITY_CONTACT_KEYWORDS = [
    'お問い合わせ', '問い合わせ', 'お問合せ', '問合せ', 'contact', 'inquiry', 'Contact', 'Inquiry',
    'お問い合わせフォーム', '問い合わせフォーム', 'contact form', 'inquiry form',
    'お問い合わせはこちら', '問い合わせはこちら', 'contact us', 'Contact Us',
    'ご質問', '質問', 'question', 'FAQ', 'よくある質問',
    'ご相談', '相談', 'consultation', 'お気軽にご相談',
    '資料請求', 'request', '見積もり', '見積り', 'estimate', 'quote',
    'サポート', 'support', 'help', 'ヘルプ', 'お困りごと'
  ];

  // 基本問い合わせキーワード（より広範囲）
  private static readonly CONTACT_KEYWORDS = [
    ...this.HIGH_PRIORITY_CONTACT_KEYWORDS,
    'フォーム', 'form', 'Form', 'mail', 'メール', 'email',
    '送信', 'submit', 'send', '投稿', 'post',
    '入力', 'input', '記入', 'fill', 'フィルイン',
    '申し込み', '申込み', 'application', 'apply',
    '登録', 'registration', 'register', 'signup', 'sign up'
  ];

  /**
   * URL・リンクテキストの問い合わせ純度計算
   * @param url 対象URL
   * @param linkText リンクテキスト
   * @param context コンテキスト（オプション）
   * @returns 純度計算結果
   */
  static calculateContactPurity(url: string, linkText: string, context: string = ''): PurityResult {
    const reasons: string[] = [];
    let score = 0;

    if (!url && !linkText) {
      return { score: 0, reasons: ['empty_input'] };
    }

    const lowerUrl = (url || '').toLowerCase();
    const lowerText = (linkText || '').toLowerCase();
    const lowerContext = context.toLowerCase();

    console.log(`Calculating contact purity for: URL="${url}", Text="${linkText}", Context="${context}"`);

    // URL内の高優先度キーワードチェック
    for (const keyword of this.HIGH_PRIORITY_CONTACT_KEYWORDS) {
      const lowerKeyword = keyword.toLowerCase();
      if (lowerUrl.includes(lowerKeyword)) {
        const points = this.getKeywordWeight(keyword, 'url');
        score += points;
        reasons.push(`url_keyword:${keyword}(+${points})`);
        console.log(`  URL keyword match: "${keyword}" (+${points} points)`);
      }
    }

    // リンクテキスト内の高優先度キーワードチェック
    for (const keyword of this.HIGH_PRIORITY_CONTACT_KEYWORDS) {
      const lowerKeyword = keyword.toLowerCase();
      if (lowerText.includes(lowerKeyword)) {
        const points = this.getKeywordWeight(keyword, 'text');
        score += points;
        reasons.push(`text_keyword:${keyword}(+${points})`);
        console.log(`  Text keyword match: "${keyword}" (+${points} points)`);
      }
    }

    //コンテキストボーナス
    if (lowerContext) {
      if (lowerContext.includes('nav')) {
        score += 3;
        reasons.push('navigation_context(+3)');
      } else if (lowerContext.includes('footer')) {
        score += 2;
        reasons.push('footer_context(+2)');
      }
    }

    // URLパターンボーナス
    if (lowerUrl.includes('/contact')) {
      score += 5;
      reasons.push('contact_path_pattern(+5)');
    }
    if (lowerUrl.includes('/inquiry')) {
      score += 4;
      reasons.push('inquiry_path_pattern(+4)');
    }
    if (lowerUrl.includes('/form')) {
      score += 3;
      reasons.push('form_path_pattern(+3)');
    }

    // ネガティブパターンチェック
    const negativePatterns = ['privacy', 'legal', 'terms', 'policy', 'about', 'news', 'blog'];
    for (const negative of negativePatterns) {
      if (lowerUrl.includes(negative) || lowerText.includes(negative)) {
        score -= 2;
        reasons.push(`negative_pattern:${negative}(-2)`);
      }
    }

    console.log(`  Final purity score: ${score} (reasons: ${reasons.join(', ')})`);
    return { score: Math.max(0, score), reasons };
  }

  /**
   * キーワードの重み値を取得
   * @param keyword キーワード
   * @param location 出現場所（'url' | 'text'）
   * @returns 重み値
   */
  private static getKeywordWeight(keyword: string, location: 'url' | 'text'): number {
    const baseWeight = location === 'url' ? 4 : 3;

    // 特別な重み付け
    if (keyword.includes('お問い合わせ') || keyword === 'contact') {
      return baseWeight + 2;
    }
    if (keyword.includes('フォーム') || keyword === 'form') {
      return baseWeight + 1;
    }

    return baseWeight;
  }

  /**
   * HTML内容からキーワード検出
   * @param html HTML文字列
   * @param keywords 検出対象キーワード配列（省略時は標準キーワード使用）
   * @returns キーワード検出結果
   */
  static detectKeywords(html: string, keywords?: string[]): KeywordDetectionResult {
    const targetKeywords = keywords || this.HIGH_PRIORITY_CONTACT_KEYWORDS;
    const lowerHtml = html.toLowerCase();
    const foundKeywords: Set<string> = new Set();

    for (const keyword of targetKeywords) {
      const lowerKeyword = keyword.toLowerCase();
      if (lowerHtml.includes(lowerKeyword)) {
        foundKeywords.add(keyword);
      }
    }

    const foundKeywordsArray = Array.from(foundKeywords);
    console.log(`Keyword detection: found ${foundKeywordsArray.length} unique keywords: ${foundKeywordsArray.join(',')}`);

    return {
      matchCount: foundKeywordsArray.length,
      foundKeywords: foundKeywordsArray
    };
  }

  /**
   * 連絡先情報の検出（電話番号、メールアドレス、フォーム言及）
   * @param content テキスト内容
   * @returns 連絡先情報検出結果
   */
  static extractContactInfo(content: string): ContactInfoResult {
    const lowerContent = content.toLowerCase();

    // 電話番号パターン
    const phonePatterns = [
      /\d{2,4}[-‐]\d{2,4}[-‐]\d{3,4}/g,      // 03-1234-5678
      /\d{3}\.\d{3}\.\d{4}/g,                 // 123.456.7890
      /\(\d{3}\)\s?\d{3}[-‐]\d{4}/g,         // (123) 456-7890
      /tel[:\s]*[\d\-\(\)\s+]{10,}/gi        // tel: 形式
    ];

    const hasPhone = phonePatterns.some(pattern => pattern.test(content));

    // メールアドレスパターン
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const hasEmail = emailPattern.test(content);

    // フォーム言及パターン
    const formMentionPatterns = [
      'フォーム', 'form', 'お問い合わせ', 'contact', '送信', 'submit'
    ];
    const hasFormMention = formMentionPatterns.some(pattern =>
      lowerContent.includes(pattern.toLowerCase())
    );

    // スコア計算
    let score = 0;
    if (hasPhone) score += 3;
    if (hasEmail) score += 2;
    if (hasFormMention) score += 1;

    return {
      hasPhone,
      hasEmail,
      hasFormMention,
      score
    };
  }

  /**
   * 動的サイト用厳格キーワード検証
   * @param html HTML文字列
   * @returns キーワードスコア
   */
  static calculateDynamicSiteKeywordScore(html: string): number {
    const lowerHtml = html.toLowerCase();
    let score = 0;

    // 高優先度キーワード（問い合わせ関連）
    const contactKeywords = [
      'お問い合わせ', '問い合わせ', 'contact', 'inquiry',
      'お問い合わせフォーム', 'contact form'
    ];

    for (const keyword of contactKeywords) {
      const matches = (lowerHtml.match(new RegExp(keyword.toLowerCase(), 'g')) || []).length;
      score += matches * 3; // 各マッチ3点
      if (matches > 0) {
        console.log(`Found ${matches} occurrences of "${keyword}"`);
      }
    }

    // 誘導文言
    const inductionPhrases = [
      'お気軽にご相談', 'お問い合わせはこちら',
      'get in touch', 'contact us', 'reach out'
    ];

    for (const phrase of inductionPhrases) {
      if (lowerHtml.includes(phrase.toLowerCase())) {
        score += 5; // 誘導文言は5点
        console.log(`Found induction phrase: "${phrase}"`);
      }
    }

    // フォーム関連ヒント
    const formHints = [
      'フォーム読み込み中', 'loading contact form',
      'form-container', 'contact-form-placeholder'
    ];

    for (const hint of formHints) {
      if (lowerHtml.includes(hint.toLowerCase())) {
        score += 4; // フォームヒントは4点
        console.log(`Found form hint: "${hint}"`);
      }
    }

    console.log(`Dynamic site keyword score calculated: ${score}`);
    return score;
  }

  /**
   * 標準キーワード配列を取得
   * @returns 高優先度キーワード配列
   */
  static getHighPriorityKeywords(): string[] {
    return [...this.HIGH_PRIORITY_CONTACT_KEYWORDS];
  }

  /**
   * 全キーワード配列を取得
   * @returns 全キーワード配列
   */
  static getAllKeywords(): string[] {
    return [...this.CONTACT_KEYWORDS];
  }
}
