// 問い合わせURLパターン
export const CONTACT_URL_PATTERNS = [
  '/contact/', '/inquiry/', '/sales-contact/', '/business-contact/',
  '/contact-us/', '/get-in-touch/', '/reach-out/', '/問い合わせ/', '/お問い合わせ/'
];

// ナビゲーションセレクタパターン
export const NAVIGATION_SELECTORS = [
  /<nav[\s\S]*?<\/nav>/gi,
  /<[^>]*id=["']menu["'][^>]*>[\s\S]*?<\/[^>]+>/gi,
  /<footer[\s\S]*?<\/footer>/gi,
  /<ul[^>]*id=["']naviArea["'][^>]*>[\s\S]*<\/ul>/gi,
  /<[^>]*id=["']navigation["'][^>]*>[\s\S]*?<\/[^>]+>/gi,
  /<[^>]*id=["']nav["'][^>]*>[\s\S]*?<\/[^>]+>/gi,
  /<div[^>]*class=["'][^'"\\]*\bnav\b[^"]*["'][^>]*>[\s\S]*<\/div>/gi,
  /<nav[^>]*class=["'][^'"\\]*\bnavigation\b[^"]*["'][^>]*>[\s\S]*<\/nav>/gi,
  /<ul[^>]*class=["'][^'"\\]*\bmenu\b[^"]*["'][^>]*>[\s\S]*<\/ul>/gi
];

// 無効なページコンテンツパターン
export const INVALID_PAGE_PATTERNS = [
  'page not found', 'ページが見つかりません', '404 not found',
  'under construction', '工事中', 'site under construction',
  'coming soon'
];

// アンカーセクション分析用パターン
export const ANCHOR_SECTION_PATTERNS = [
  (anchorId: string) => new RegExp(`<[^>]+id=["']${anchorId}["'][^>]*>[\s\S]*?(?=<[^>]+id=["']|$)`, 'i'),
  (anchorId: string) => new RegExp(`<[^>]+name=["']${anchorId}["'][^>]*>[\s\S]*?(?=<[^>]+name=["']|$)`, 'i'),
  (anchorId: string) => new RegExp(`<section[^>]*>[\s\S]*?${anchorId}[\s\S]*?<\/section>`, 'i'),
  (anchorId: string) => new RegExp(`<div[^>]*contact[^>]*>[\s\S]*?<\/div>`, 'i')
];

// フォームリンクパターン
export const FORM_LINK_PATTERNS = ['form', 'フォーム', 'submit', '送信', 'formzu', 'fc2', 'google.com/forms', 'forms.gle'];

// フォームテキストパターン
export const FORM_TEXT_PATTERNS = ['フォームはこちら', 'フォームへ', '問い合わせフォーム', '入力フォーム', '送信フォーム', 'form here', 'click here', 'go to form'];
