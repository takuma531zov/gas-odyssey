/**
 * HTML解析専用ユーティリティ
 * 元のContactPageFinderクラスから分離（ロジック変更なし）
 */

import { HIGH_PRIORITY_CONTACT_KEYWORDS, MEDIUM_PRIORITY_CONTACT_KEYWORDS, EXCLUDED_KEYWORDS } from '../constants/ContactConstants';
import { UrlUtils } from '../utils/UrlUtils';

/**
 * 連絡先情報抽出結果
 */
export interface ContactInfo {
  phone: boolean;
  email: boolean;
  contactForm: boolean;
}

/**
 * 連絡先リンク候補
 */
export interface ContactLinkCandidate {
  url: string;
  keywords: string[];
  score: number;
  reasons: string[];
}

export class HtmlAnalyzer {
  
  /**
   * HTMLから連絡先情報を抽出
   * @param html 解析対象のHTML
   * @returns 連絡先情報の検出結果
   */
  static extractContactInfo(html: string): ContactInfo {
    const phonePatterns = [
      /\d{2,4}[-\s]?\d{2,4}[-\s]?\d{3,4}/,
      /\(?\d{3}\)?[-\s]?\d{3,4}[-\s]?\d{3,4}/,
      /TEL[\s:：]*\d/i,
      /電話[\s:：]*\d/
    ];

    const emailPatterns = [
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
      /mail[\s:：]*@/i,
      /メール[\s:：]*@/
    ];

    const contactFormPatterns = [
      /お問い合わせフォーム/i,
      /問い合わせフォーム/i,
      /contact\s+form/i,
      /フォーム.*承/i,
      /form.*contact/i
    ];

    const phone = phonePatterns.some(pattern => pattern.test(html));
    const email = emailPatterns.some(pattern => pattern.test(html));
    const contactForm = contactFormPatterns.some(pattern => pattern.test(html));

    console.log(`Contact info extraction: phone=${phone}, email=${email}, contactForm=${contactForm}`);
    return { phone, email, contactForm };
  }

  /**
   * 複数エンコーディングを試行してコンテンツを取得
   * @param response HTTPレスポンス
   * @returns デコードされたコンテンツ
   */
  static getContentWithEncoding(response: any): string {
    const encodings = ['utf-8', 'shift_jis', 'euc-jp'];

    console.log(`Trying multiple encodings for content decoding...`);

    for (const encoding of encodings) {
      try {
        const content = response.getContentText(encoding);
        // 簡易文字化け検証
        if (this.isValidEncoding(content)) {
          console.log(`✅ Successfully decoded with ${encoding}`);
          return content;
        } else {
          console.log(`❌ ${encoding} produced garbled text`);
        }
      } catch (e) {
        console.log(`❌ ${encoding} decoding failed: ${e}`);
        continue;
      }
    }

    console.log(`⚠ All encodings failed, using default UTF-8`);
    return response.getContentText(); // 最終フォールバック
  }

  /**
   * エンコーディングの有効性を検証
   * @param content 検証対象のコンテンツ
   * @returns 有効な場合true
   */
  static isValidEncoding(content: string): boolean {
    // 置換文字の割合が5%未満なら有効
    const replacementChars = (content.match(/�/g) || []).length;
    const isValid = (replacementChars / content.length) < 0.05;
    console.log(`Encoding validation: ${replacementChars} replacement chars out of ${content.length} (${(replacementChars/content.length*100).toFixed(2)}%) - ${isValid ? 'VALID' : 'INVALID'}`);
    return isValid;
  }

  /**
   * 問い合わせページの純度スコア計算
   * @param url 対象URL
   * @param linkText リンクテキスト
   * @param context 文脈（省略可）
   * @returns スコアと理由の配列
   */
  static calculateContactPurity(url: string, linkText: string, context: string = ''): { score: number, reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];
    const foundKeywords = new Set<string>(); // 重複防止用

    const lowerUrl = url.toLowerCase();
    const lowerLinkText = linkText.toLowerCase();

    // 除外キーワードチェック（即座に低スコア）
    for (const excludedKeyword of EXCLUDED_KEYWORDS) {
      if (lowerUrl.includes(excludedKeyword.toLowerCase()) ||
          lowerLinkText.includes(excludedKeyword.toLowerCase())) {
        score -= 15;
        reasons.push(`excluded:${excludedKeyword}`);
        break; // 1つでも除外キーワードがあれば大幅減点
      }
    }

    // 高優先度キーワード（「含む」判定で柔軟マッチング・重複防止）
    for (const keyword of HIGH_PRIORITY_CONTACT_KEYWORDS) {
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
    for (const keyword of MEDIUM_PRIORITY_CONTACT_KEYWORDS) {
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

  /**
   * HTMLコンテンツから連絡先関連のリンクを全て抽出
   * @param content HTML内容
   * @param baseUrl ベースURL
   * @returns 連絡先リンク候補の配列
   */
  static extractAllContactLinks(content: string, baseUrl: string): ContactLinkCandidate[] {
    const candidates: ContactLinkCandidate[] = [];
    const linkRegex = /<a[^>]*href=['"]([^'"]*?)['"][^>]*>([\s\S]*?)<\/a>/gi;
    let match;

    let totalLinksFound = 0;

    console.log(`=== EXTRACTING ALL LINKS DEBUG ===`);
    console.log(`Input content length: ${content.length}`);
    console.log(`Input content preview: ${content.substring(0, 200)}...`);

    // HIGH_PRIORITY_CONTACT_KEYWORDS の初期化確認
    console.log('HIGH_PRIORITY_CONTACT_KEYWORDS loaded for link extraction');

    while ((match = linkRegex.exec(content)) !== null) {
      totalLinksFound++;
      const url = match[1];
      const linkText = match[2];

      // 🔥 デバッグ: 全リンクの詳細出力
      console.log(`--- Link ${totalLinksFound} RAW DATA ---`);
      console.log(`Raw URL: "${url}"`);
      console.log(`Raw linkText: "${linkText}"`);
      console.log(`Raw linkText hex: ${linkText ? UrlUtils.toHexString(linkText) : 'undefined'}`);

      if (!url || !linkText) {
        console.log(`Skipped: empty url or linkText`);
        continue;
      }

      const cleanLinkText = linkText.replace(/<[^>]*>/g, '').trim();
      console.log(`Clean linkText: "${cleanLinkText}"`);
      console.log(`Clean linkText hex: ${UrlUtils.toHexString(cleanLinkText)}`);

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
      for (const keyword of HIGH_PRIORITY_CONTACT_KEYWORDS) {
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
      const hasExcludedKeywords = EXCLUDED_KEYWORDS.some(keyword =>
        url.toLowerCase().includes(keyword.toLowerCase()) ||
        cleanLinkText.toLowerCase().includes(keyword.toLowerCase())
      );

      if (hasExcludedKeywords) {
        console.log(`❌ Excluded: has excluded keywords`);
        continue;
      }

      // スコア計算
      const purityResult = this.calculateContactPurity(url, cleanLinkText);
      const totalScore = purityResult.score + 5; // navigation context bonus

      if (totalScore > 0) {
        const fullUrl = UrlUtils.resolveUrl(url, baseUrl);
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
}