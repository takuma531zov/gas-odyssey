/**
 * ナビゲーション検索（完全移植版）
 * 最適版からの1バイトも変更しない完全移植
 */

import { ContactPurityCalculator } from '../purity/ContactPurityCalculator';

export class NavigationSearcher {
  // BtoB問い合わせ特化：純粋な問い合わせキーワードのみ（移植用）
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

  private static readonly EXCLUDED_KEYWORDS = [
    // 精度の妨げになる明確な除外キーワードのみ（最小限）
    'download', 'recruit', 'career'
  ];

  /**
   * ナビゲーション検索（最適版完全移植）
   */
  static searchInNavigation(html: string, baseUrl: string): { url: string | null, keywords: string[], score: number, reasons: string[] } {
    const navigationSelectors = [
      // 主要ナビゲーション要素（icube-inc.co.jp等に対応）
      /<nav[\s\S]*?<\/nav>/gi,                    // <nav>タグ
      /<[^>]*id=['"]menu['"][^>]*>[\s\S]*?<\/[^>]+>/gi,  // #menu ID
      /<footer[\s\S]*?<\/footer>/gi,              // <footer>タグ
      // 追加セレクター（既存サイト対応）
      /<ul[^>]*id=['"]naviArea['"][^>]*>[\s\S]*<\/ul>/gi, // #naviArea (icube-inc.co.jp) - 貪欲マッチでネスト対応
      /<[^>]*id=['"]navigation['"][^>]*>[\s\S]*?<\/[^>]+>/gi, // #navigation
      /<[^>]*id=['"]nav['"][^>]*>[\s\S]*?<\/[^>]+>/gi, // #nav
      /<div[^>]*class=['"][^'"]*\bnav\b[^'"]*['"][^>]*>[\s\S]*<\/div>/gi, // .navクラス - 貪欲マッチ
      /<nav[^>]*class=['"][^'"]*\bnavigation\b[^'"]*['"][^>]*>[\s\S]*<\/nav>/gi, // .navigationクラス - 貪欲マッチ
      /<ul[^>]*class=['"][^'"]*\bmenu\b[^'"]*['"][^>]*>[\s\S]*<\/ul>/gi // .menuクラス - 貪欲マッチ
    ];

    console.log('Searching in navigation with 9 selectors (including #naviArea, .nav, .navigation, .menu)...');

    let totalMatches = 0;
    let allCandidates: Array<{ url: string, keywords: string[], score: number, reasons: string[] }> = [];

    for (let i = 0; i < navigationSelectors.length; i++) {
      const regex = navigationSelectors[i];
      if (!regex) continue;

      const matches = html.match(regex) || [];
      console.log(`Navigation selector ${i+1}: Found ${matches.length} matches`);
      totalMatches += matches.length;

      for (let j = 0; j < matches.length; j++) {
        const match = matches[j];
        if (!match) continue;

        console.log(`Analyzing navigation match ${j+1} (${match.length} chars): ${match.substring(0, 100)}...`);

        // 新フロー: 全リンクを抽出してキーワードフィルタリング
        const candidates = this.extractAllContactLinks(match, baseUrl);
        allCandidates.push(...candidates);
        console.log(`Navigation match ${j+1} added ${candidates.length} candidates`);
      }
    }

    // 全リンクからキーワード含有リンクのみを選別
    const contactLinks = allCandidates.filter(candidate =>
      this.HIGH_PRIORITY_CONTACT_KEYWORDS.some(keyword =>
        candidate.url.toLowerCase().includes(keyword.toLowerCase()) ||
        candidate.keywords.some(k => k.toLowerCase().includes(keyword.toLowerCase()))
      )
    );

    console.log(`Found ${allCandidates.length} total candidates, ${contactLinks.length} with contact keywords`);

    // キーワード含有リンクがあれば最高スコアを選択
    if (contactLinks.length > 0) {
      const best = contactLinks.reduce((max, current) => current.score > max.score ? current : max);
      console.log(`Navigation search best result: ${best.url} (score: ${best.score})`);
      return best;
    }

    console.log(`Navigation search complete: processed ${totalMatches} matches, no contact-related candidates found`);
    return { url: null, keywords: [], score: 0, reasons: [] };
  }

  /**
   * 全コンタクトリンク抽出（最適版完全移植）
   */
  private static extractAllContactLinks(content: string, baseUrl: string): Array<{ url: string, keywords: string[], score: number, reasons: string[] }> {
    const candidates: Array<{ url: string, keywords: string[], score: number, reasons: string[] }> = [];
    const linkRegex = /<a[^>]*href=['"]([^'"]*?)['"][^>]*>([\s\S]*?)<\/a>/gi;
    let match;

    let totalLinksFound = 0;

    console.log(`=== EXTRACTING ALL LINKS DEBUG ===`);
    console.log(`Input content length: ${content.length}`);
    console.log(`Input content preview: ${content.substring(0, 200)}...`);

    // 🔥 デバッグ: HIGH_PRIORITY_CONTACT_KEYWORDS の内容確認
    console.log(`HIGH_PRIORITY_CONTACT_KEYWORDS: ${JSON.stringify(this.HIGH_PRIORITY_CONTACT_KEYWORDS.slice(0, 10))}`);

    while ((match = linkRegex.exec(content)) !== null) {
      totalLinksFound++;
      const url = match[1];
      const linkText = match[2];

      // 🔥 デバッグ: 全リンクの詳細出力
      console.log(`--- Link ${totalLinksFound} RAW DATA ---`);
      console.log(`Raw URL: "${url}"`);
      console.log(`Raw linkText: "${linkText}"`);
      console.log(`Raw linkText hex: ${linkText ? this.toHexString(linkText) : 'undefined'}`);

      if (!url || !linkText) {
        console.log(`Skipped: empty url or linkText`);
        continue;
      }

      const cleanLinkText = linkText.replace(/<[^>]*>/g, '').trim();
      console.log(`Clean linkText: "${cleanLinkText}"`);
      console.log(`Clean linkText hex: ${this.toHexString(cleanLinkText)}`);

      // 非ウェブURLをスキップ
      if (url.startsWith('mailto:') || url.startsWith('javascript:') || url.startsWith('tel:')) {
        continue;
      }

      // 🔥 デバッグ: キーワードマッチング詳細
      console.log(`--- Keyword Matching Debug ---`);
      const urlLower = url.toLowerCase();
      const textLower = cleanLinkText.toLowerCase();
      console.log(`URL lower: "${urlLower}"`);
      console.log(`Text lower: "${textLower}"`);

      let matchedKeywords = [];
      for (const keyword of this.HIGH_PRIORITY_CONTACT_KEYWORDS) {
        const keywordLower = keyword.toLowerCase();
        const urlMatch = urlLower.includes(keywordLower);
        const textMatch = textLower.includes(keywordLower);
        if (urlMatch || textMatch) {
          matchedKeywords.push(`${keyword}(${urlMatch ? 'URL' : ''}${textMatch ? 'TEXT' : ''})`);
        }
      }

      console.log(`Matched keywords: ${matchedKeywords.join(', ')}`);

      const hasContactKeywords = matchedKeywords.length > 0;

      if (!hasContactKeywords) {
        console.log(`❌ Excluded: no contact keywords`);
        continue;
      }

      // 除外キーワードチェック
      const hasExcludedKeywords = this.EXCLUDED_KEYWORDS.some(keyword =>
        url.toLowerCase().includes(keyword.toLowerCase()) ||
        cleanLinkText.toLowerCase().includes(keyword.toLowerCase())
      );

      if (hasExcludedKeywords) {
        console.log(`❌ Excluded: has excluded keywords`);
        continue;
      }

      // スコア計算
      const purityResult = ContactPurityCalculator.calculateContactPurity(url, cleanLinkText);
      const totalScore = purityResult.score + 5; // navigation context bonus

      if (totalScore > 0) {
        const fullUrl = this.resolveUrl(url, baseUrl);
        candidates.push({
          url: fullUrl,
          keywords: purityResult.reasons.map(r => r.split(':')[1] || r),
          score: totalScore,
          reasons: [...purityResult.reasons, 'navigation_context_bonus']
        });

        console.log(`✅ CONTACT LINK FOUND: "${cleanLinkText}" -> ${url} (score: ${totalScore})`);
      }
    }

    // スコア順でソート
    candidates.sort((a, b) => b.score - a.score);
    console.log(`=== EXTRACT SUMMARY ===`);
    console.log(`Total links found: ${totalLinksFound}`);
    console.log(`Keyword-containing links: ${candidates.length}`);
    console.log(`=== END EXTRACT DEBUG ===`);

    return candidates;
  }

  /**
   * HEX文字列変換（デバッグ用）完全移植
   */
  private static toHexString(str: string): string {
    try {
      return Array.from(str).map(char =>
        char.charCodeAt(0).toString(16).padStart(2, '0')
      ).join(' ');
    } catch (e) {
      return `[hex conversion error: ${e}]`;
    }
  }

  /**
   * URL解決（相対→絶対変換）完全移植
   */
  static resolveUrl(url: string, baseUrl: string): string {
    // Skip invalid or non-web URLs
    if (url.startsWith('mailto:') || url.startsWith('javascript:') || url.startsWith('tel:')) {
      return url; // Return as-is but these should be filtered out in calling code
    }

    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }

    // Extract protocol and host from baseUrl manually
    const protocolMatch = baseUrl.match(/^https?:/);
    const hostMatch = baseUrl.match(/^https?:\/\/([^\/]+)/);

    if (!protocolMatch || !hostMatch) {
      return url;
    }

    const protocol = protocolMatch[0];
    const host = hostMatch[1];

    if (url.startsWith('/')) {
      return `${protocol}//${host}${url}`;
    }

    return `${protocol}//${host}/${url}`;
  }
}