/**
 * 問い合わせページ純度計算（完全移植版）
 * 最適版からの1バイトも変更しない完全移植
 */

export class ContactPurityCalculator {
  // BtoB問い合わせ特化：純粋な問い合わせキーワードのみ
  private static readonly HIGH_PRIORITY_CONTACT_KEYWORDS = [
    // 直接的問い合わせ（最高優先度）
    'contact', 'contact us', 'contact form', 'inquiry', 'enquiry',
    'get in touch', 'reach out', 'send message', 'message us',
    'お問い合わせ', '問い合わせ', 'お問合せ', '問合せ',
    'ご相談', '相談', 'お客様窓口', 'お問い合わせフォーム',
    'お問い合わせはこちら', '問い合わせフォーム',
    // フォーム関連を追加
    'form', 'フォーム',
    // URL内検索用（日本語エンコード版）
    '%E3%81%8A%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B', // お問い合わせ
    '%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B', // 問い合わせ
    '%E3%81%8A%E5%95%8F%E5%90%88%E3%81%9B', // お問合せ
    '%E5%95%8F%E5%90%88%E3%81%9B' // 問合せ
  ];

  private static readonly MEDIUM_PRIORITY_CONTACT_KEYWORDS = [
    // 間接的問い合わせ（中優先度） - 営業系削除済み
    'form', 'フォーム', 'submit', 'send', 'mail form',
    'feedback'
  ];

  private static readonly EXCLUDED_KEYWORDS = [
    // 精度の妨げになる明確な除外キーワードのみ（最小限）
    'download', 'recruit', 'career'
  ];

  /**
   * 問い合わせページ純度計算（最適版完全移植）
   */
  static calculateContactPurity(url: string, linkText: string, context: string = ''): { score: number, reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];
    const foundKeywords = new Set<string>(); // 重複防止用

    const lowerUrl = url.toLowerCase();
    const lowerLinkText = linkText.toLowerCase();

    // 除外キーワードチェック（即座に低スコア）
    for (const excludedKeyword of this.EXCLUDED_KEYWORDS) {
      if (lowerUrl.includes(excludedKeyword.toLowerCase()) ||
          lowerLinkText.includes(excludedKeyword.toLowerCase())) {
        score -= 15;
        reasons.push(`excluded:${excludedKeyword}`);
        break; // 1つでも除外キーワードがあれば大幅減点
      }
    }

    // 高優先度キーワード（「含む」判定で柔軟マッチング・重複防止）
    for (const keyword of this.HIGH_PRIORITY_CONTACT_KEYWORDS) {
      const normalizedKeyword = keyword.toLowerCase();

      // リンクテキストに含まれる場合（例: "お問い合わせフォーム" に "お問い合わせ" が含まれる）
      if (lowerLinkText.includes(normalizedKeyword) && !foundKeywords.has(normalizedKeyword)) {
        score += 10;
        reasons.push(`high_priority_text:${keyword}`);
        foundKeywords.add(normalizedKeyword);
        console.log(`✓ Text match found: "${keyword}" in "${linkText}"`);
      }
      // URLに含まれる場合（例: "/contact-form" に "contact" が含まれる）
      else if (lowerUrl.includes(normalizedKeyword) && !foundKeywords.has(normalizedKeyword)) {
        score += 8;
        reasons.push(`high_priority_url:${keyword}`);
        foundKeywords.add(normalizedKeyword);
        console.log(`✓ URL match found: "${keyword}" in "${url}"`);
      }

      // テキストとURLの両方にある場合の重複防止ログ
      if (lowerLinkText.includes(normalizedKeyword) && lowerUrl.includes(normalizedKeyword) && foundKeywords.has(normalizedKeyword)) {
        console.log(`Prevented duplicate counting for keyword: ${keyword}`);
      }
    }

    // 中優先度キーワード（中純度・重複防止）
    for (const keyword of this.MEDIUM_PRIORITY_CONTACT_KEYWORDS) {
      const normalizedKeyword = keyword.toLowerCase();

      if (lowerLinkText.includes(normalizedKeyword) && !foundKeywords.has(normalizedKeyword)) {
        score += 3;
        reasons.push(`medium_priority_text:${keyword}`);
        foundKeywords.add(normalizedKeyword);
      } else if (lowerUrl.includes(normalizedKeyword) && !foundKeywords.has(normalizedKeyword)) {
        score += 2;
        reasons.push(`medium_priority_url:${keyword}`);
        foundKeywords.add(normalizedKeyword);
      }
    }

    // URL構造による純度ボーナス（強化版）
    const contactUrlPatterns = [
      '/contact/', '/inquiry/', '/sales-contact/', '/business-contact/',
      '/contact-us/', '/get-in-touch/', '/reach-out/', '/問い合わせ/', '/お問い合わせ/'
    ];

    for (const pattern of contactUrlPatterns) {
      if (lowerUrl.includes(pattern)) {
        score += 15; // 5点から15点に強化
        reasons.push(`strong_contact_url_structure:${pattern}`);
        break; // 1つでもマッチすれば十分
      }
    }

    // 不純物による減点（サービス系URL・強化版）
    if (lowerUrl.includes('/service/')) {
      score -= 10; // 5点から10点に強化
      reasons.push('service_url_penalty');
    } else if (lowerUrl.includes('/about/') || lowerUrl.includes('/company/') || lowerUrl.includes('/info/')) {
      score -= 5;
      reasons.push('impure_url_structure');
    }

    return { score, reasons };
  }
}