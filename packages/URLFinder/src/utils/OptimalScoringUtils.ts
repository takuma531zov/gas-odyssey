/**
 * 最適版スコアリングユーティリティ（統一版）
 * 最適版（44ac0de）の高精度ロジックを現在アーキテクチャに移植
 * 
 * 【目的】
 * - 分散実装されたcalculateContactPurity関数の統一
 * - 最適版の精度を現在のモジュール構造で実現
 * - Step2 HTML解析ロジックの精度向上
 */

/**
 * 最適版準拠のキーワード定義
 * 最適版（44ac0de）の53-78行目から抽出
 */
export const OPTIMAL_HIGH_PRIORITY_CONTACT_KEYWORDS = [
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

export const OPTIMAL_MEDIUM_PRIORITY_CONTACT_KEYWORDS = [
  // 間接的問い合わせ（中優先度） - 営業系削除済み
  'form', 'フォーム', 'submit', 'send', 'mail form',
  'feedback'
];

export const OPTIMAL_EXCLUDED_KEYWORDS = [
  // 精度の妨げになる明確な除外キーワードのみ（最小限）
  'download', 'recruit', 'career'
];

/**
 * 最適版準拠のURL構造パターン
 * /sales-contact/ を含む営業特化パターン
 */
export const OPTIMAL_CONTACT_URL_PATTERNS = [
  '/contact/', '/inquiry/', '/sales-contact/', '/business-contact/',
  '/contact-us/', '/get-in-touch/', '/reach-out/', '/問い合わせ/', '/お問い合わせ/'
];

/**
 * 最適版スコアリング結果
 */
export interface OptimalScoringResult {
  score: number;
  reasons: string[];
}

/**
 * ナビゲーションセレクター（最適版準拠）
 * 最適版809-821行目から抽出
 */
export const OPTIMAL_NAVIGATION_SELECTORS = [
  // 主要ナビゲーション要素
  /<nav[\s\S]*?<\/nav>/gi,                    // <nav>タグ
  /<[^>]*id=['"]menu['"][^>]*>[\s\S]*?<\/[^>]+>/gi,  // #menu ID
  /<footer[\s\S]*?<\/footer>/gi,              // <footer>タグ
  // 追加セレクター（既存サイト対応）
  /<ul[^>]*id=['"]naviArea['"][^>]*>[\s\S]*<\/ul>/gi, // #naviArea - 貪欲マッチでネスト対応
  /<[^>]*id=['"]navigation['"][^>]*>[\s\S]*?<\/[^>]+>/gi, // #navigation
  /<[^>]*id=['"]nav['"][^>]*>[\s\S]*?<\/[^>]+>/gi, // #nav
  /<div[^>]*class=['"][^'"]*\bnav\b[^'"]*['"][^>]*>[\s\S]*<\/div>/gi, // .navクラス - 貪欲マッチ
  /<nav[^>]*class=['"][^'"]*\bnavigation\b[^'"]*['"][^>]*>[\s\S]*<\/nav>/gi, // .navigationクラス - 貪欲マッチ
  /<ul[^>]*class=['"][^'"]*\bmenu\b[^'"]*['"][^>]*>[\s\S]*<\/ul>/gi // .menuクラス - 貪欲マッチ
];

/**
 * リンク候補結果
 */
export interface LinkCandidate {
  url: string;
  keywords: string[];
  score: number;
  reasons: string[];
}

/**
 * ナビゲーション検索結果
 */
export interface NavigationSearchResult {
  url: string | null;
  keywords: string[];
  score: number;
  reasons: string[];
}

/**
 * 最適版Contact純度スコア計算（統一版）
 * 最適版227-310行目の完全移植
 * 
 * @param url リンクURL
 * @param linkText リンクテキスト
 * @param context コンテキスト情報（オプション）
 * @returns 最適版準拠のスコアリング結果
 */
export function calculateOptimalContactPurity(url: string, linkText: string, context: string = ''): OptimalScoringResult {
  let score = 0;
  const reasons: string[] = [];
  const foundKeywords = new Set<string>(); // 重複防止用

  const lowerUrl = url.toLowerCase();
  const lowerLinkText = linkText.toLowerCase();

  // 除外キーワードチェック（即座に低スコア）
  for (const excludedKeyword of OPTIMAL_EXCLUDED_KEYWORDS) {
    if (lowerUrl.includes(excludedKeyword.toLowerCase()) ||
        lowerLinkText.includes(excludedKeyword.toLowerCase())) {
      score -= 15;
      reasons.push(`excluded:${excludedKeyword}`);
      break; // 1つでも除外キーワードがあれば大幅減点
    }
  }

  // 高優先度キーワード（「含む」判定で柔軟マッチング・重複防止）
  for (const keyword of OPTIMAL_HIGH_PRIORITY_CONTACT_KEYWORDS) {
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
  for (const keyword of OPTIMAL_MEDIUM_PRIORITY_CONTACT_KEYWORDS) {
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
  // 最重要: /sales-contact/ パターンを含む
  for (const pattern of OPTIMAL_CONTACT_URL_PATTERNS) {
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
 * 最適版ナビゲーション検索（統一版）
 * 最適版808-868行目の移植
 * 
 * @param html 解析対象HTML
 * @param baseUrl ベースURL
 * @returns ナビゲーション検索結果
 */
export function searchOptimalNavigation(html: string, baseUrl: string): NavigationSearchResult {
  console.log('Searching in navigation with 9 selectors (including #naviArea, .nav, .navigation, .menu)...');

  let totalMatches = 0;
  let allCandidates: LinkCandidate[] = [];

  for (let i = 0; i < OPTIMAL_NAVIGATION_SELECTORS.length; i++) {
    const regex = OPTIMAL_NAVIGATION_SELECTORS[i];
    if (!regex) continue;

    const matches = html.match(regex) || [];
    console.log(`Navigation selector ${i+1}: Found ${matches.length} matches`);
    totalMatches += matches.length;

    for (let j = 0; j < matches.length; j++) {
      const match = matches[j];
      if (!match) continue;

      console.log(`Analyzing navigation match ${j+1} (${match.length} chars): ${match.substring(0, 100)}...`);

      // 全リンクを抽出してキーワードフィルタリング
      const candidates = extractOptimalContactLinks(match, baseUrl);
      allCandidates.push(...candidates);
      console.log(`Navigation match ${j+1} added ${candidates.length} candidates`);
    }
  }

  // 全リンクからキーワード含有リンクのみを選別
  const contactLinks = allCandidates.filter(candidate =>
    OPTIMAL_HIGH_PRIORITY_CONTACT_KEYWORDS.some(keyword =>
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
 * 最適版リンク抽出（統一版）
 * 最適版925-1026行目の移植
 * 
 * @param content HTML内容
 * @param baseUrl ベースURL
 * @returns リンク候補配列
 */
export function extractOptimalContactLinks(content: string, baseUrl: string): LinkCandidate[] {
  const candidates: LinkCandidate[] = [];
  const linkRegex = /<a[^>]*href=['"]([^'"]*?)['"][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  let totalLinksFound = 0;

  console.log(`=== EXTRACTING ALL LINKS DEBUG ===`);
  console.log(`Input content length: ${content.length}`);
  console.log(`Input content preview: ${content.substring(0, 200)}...`);

  // デバッグ: HIGH_PRIORITY_CONTACT_KEYWORDS の内容確認
  console.log(`HIGH_PRIORITY_CONTACT_KEYWORDS: ${JSON.stringify(OPTIMAL_HIGH_PRIORITY_CONTACT_KEYWORDS.slice(0, 10))}`);

  while ((match = linkRegex.exec(content)) !== null) {
    totalLinksFound++;
    const url = match[1];
    const linkText = match[2];

    // デバッグ: 全リンクの詳細出力
    console.log(`--- Link ${totalLinksFound} RAW DATA ---`);
    console.log(`Raw URL: "${url}"`);
    console.log(`Raw linkText: "${linkText}"`);

    if (!url || !linkText) {
      console.log(`Skipped: empty url or linkText`);
      continue;
    }

    const cleanLinkText = linkText.replace(/<[^>]*>/g, '').trim();
    console.log(`Clean linkText: "${cleanLinkText}"`);

    // 非ウェブURLをスキップ
    if (url.startsWith('mailto:') || url.startsWith('javascript:') || url.startsWith('tel:')) {
      continue;
    }

    // デバッグ: キーワードマッチング詳細
    console.log(`--- Keyword Matching Debug ---`);
    const urlLower = url.toLowerCase();
    const textLower = cleanLinkText.toLowerCase();
    console.log(`URL lower: "${urlLower}"`);
    console.log(`Text lower: "${textLower}"`);

    let matchedKeywords = [];
    for (const keyword of OPTIMAL_HIGH_PRIORITY_CONTACT_KEYWORDS) {
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
    const hasExcludedKeywords = OPTIMAL_EXCLUDED_KEYWORDS.some(keyword =>
      url.toLowerCase().includes(keyword.toLowerCase()) ||
      cleanLinkText.toLowerCase().includes(keyword.toLowerCase())
    );

    if (hasExcludedKeywords) {
      console.log(`❌ Excluded: has excluded keywords`);
      continue;
    }

    // スコア計算
    const purityResult = calculateOptimalContactPurity(url, cleanLinkText);
    const totalScore = purityResult.score + 5; // navigation context bonus

    if (totalScore > 0) {
      const fullUrl = resolveUrl(url, baseUrl);
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
 * URL解決処理（最適版準拠）
 * @param url 相対または絶対URL
 * @param baseUrl ベースURL
 * @returns 絶対URL
 */
function resolveUrl(url: string, baseUrl: string): string {
  if (url.startsWith('http')) return url;
  if (url.startsWith('/')) {
    // Extract origin from baseUrl
    const protocolMatch = baseUrl.match(/^https?:\/\/[^\/]+/);
    return protocolMatch ? protocolMatch[0] + url : baseUrl + url;
  }
  // Simple relative path resolution
  const baseWithoutTrailingSlash = baseUrl.replace(/\/$/, '');
  return baseWithoutTrailingSlash + '/' + url;
}