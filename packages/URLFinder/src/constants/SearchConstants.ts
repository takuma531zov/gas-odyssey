/**
 * URLFinder検索関連定数
 * 分散していた設定値を統一管理
 */

/**
 * URL検索関連パターン
 */
export const SEARCH_PATTERNS = {
  // 問い合わせページ優先パターン
  CONTACT_PRIORITY: [
    '/contact/',
    '/contact', 
    '/inquiry/',
    '/inquiry',
    '/form/',
    '/form'
  ],

  // 高信頼度URLパターン
  HIGH_CONFIDENCE: ['/contact/', '/contact', '/inquiry/', '/inquiry'],

  // 中信頼度URLパターン
  MEDIUM_CONFIDENCE: ['/form/', '/form'],

  // 問い合わせ関連キーワード
  CONTACT_KEYWORDS: ['contact', 'inquiry', 'form', 'お問い合わせ', '問い合わせ']
};

/**
 * 信頼度設定
 */
export const CONFIDENCE_LEVELS = {
  BASE: 0.5,           // ベーススコア
  HIGH_BONUS: 0.3,     // 高信頼度パターンボーナス
  MEDIUM_BONUS: 0.1,   // 中信頼度パターンボーナス
  KEYWORD_BONUS: 0.1   // キーワードボーナス
};

/**
 * ナビゲーション要素セレクター
 */
export const NAVIGATION_SELECTORS = [
  // 主要ナビゲーション要素
  /<nav[\s\S]*?<\/nav>/gi,                    // <nav>タグ
  /<[^>]*id=['"]menu['"][^>]*>[\s\S]*?<\/[^>]+>/gi,  // #menu ID
  /<footer[\s\S]*?<\/footer>/gi,              // <footer>タグ
  
  // 追加セレクター（既存サイト対応）
  /<ul[^>]*id=['"]naviArea['"][^>]*>[\s\S]*<\/ul>/gi, // #naviArea - 貪欲マッチでネスト対応
  /<[^>]*id=['"]navigation['"][^>]*>[\s\S]*?<\/[^>]+>/gi, // #navigation
  /<[^>]*id=['"]nav['"][^>]*>[\s\S]*?<\/[^>]+>/gi, // #nav
  /<div[^>]*class=['"][^'"]*\bnav\b[^'"]*['"][^>]*>[\s\S]*<\/div>/gi, // .navクラス
  /<nav[^>]*class=['"][^'"]*\bnavigation\b[^'"]*['"][^>]*>[\s\S]*<\/nav>/gi, // .navigationクラス
  /<ul[^>]*class=['"][^'"]*\bmenu\b[^'"]*['"][^>]*>[\s\S]*<\/ul>/gi // .menuクラス
];

/**
 * ページ検証パターン
 */
export const VALIDATION_PATTERNS = {
  // 無効ページ判定パターン
  INVALID_PAGE: [
    'page not found', 'ページが見つかりません', '404 not found',
    'under construction', '工事中', 'site under construction',
    'coming soon'
  ],

  // 最低コンテンツ長
  MINIMUM_CONTENT_LENGTH: 500
};

/**
 * フォームリンク検索パターン
 */
export const FORM_LINK_PATTERNS = [
  'contact', 'inquiry', 'お問い合わせ', '問い合わせ', 'ご相談',
  'form', 'フォーム', 'contact-form', 'inquiry-form'
];

/**
 * フォームテキストパターン
 */
export const FORM_TEXT_PATTERNS = [
  'お問い合わせフォーム', '問い合わせフォーム', 'お問合せフォーム',
  'ご相談フォーム', 'contact form', 'inquiry form'
];

/**
 * 除外キーワード（ネガティブ判定用）
 */
export const NEGATIVE_KEYWORDS = [
  'recruit', 'career', 'job', 'hire', 'employment', '採用', '求人',
  'download', 'newsletter', 'subscribe', 'login', 'logout'
];

/**
 * ホームページ判定パターン
 */
export const HOMEPAGE_PATTERNS = [
  '/', '/index.html', '/index.php', '/home', '/top',
  '/index.htm', '/default.html', '/main.html'
];

/**
 * 問い合わせリンクキーワード
 */
export const CONTACT_LINK_KEYWORDS = [
  // 日本語
  'お問い合わせ', '問い合わせ', 'お問合せ', '問合せ', 'ご相談', '相談',
  
  // 英語
  'contact', 'contact us', 'inquiry', 'enquiry', 'get in touch'
];

/**
 * Google Form除外キーワード
 */
export const GOOGLE_FORM_EXCLUDE_KEYWORDS = [
  'ライター', 'writer', '募集', 'recruit', 'recruitment', 'career', 'job', 'hire', 'employment',
  '採用', '求人', '応募', 'apply', 'application',
  '資料請求', 'download', 'material', 'brochure', 'request',
  'アンケート', 'survey', 'questionnaire', 'feedback',
  'セミナー', 'seminar', 'webinar', 'event', 'workshop',
  'メルマガ', 'newsletter', 'subscription', 'subscribe'
];

/**
 * Google Form問い合わせキーワード
 */
export const GOOGLE_FORM_CONTACT_KEYWORDS = [
  'お問い合わせ', '問い合わせ', 'お問合せ', '問合せ',
  'contact', 'inquiry', 'ご相談', '相談', 'support',
  'business inquiry', 'general inquiry'
];