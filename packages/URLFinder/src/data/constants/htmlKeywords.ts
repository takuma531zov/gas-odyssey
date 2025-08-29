// HTML解析用高優先度問い合わせキーワード
export const HTML_HIGH_PRIORITY_CONTACT_KEYWORDS = [
  'contact', 'contact us', 'contact form', 'inquiry', 'enquiry',
  'get in touch', 'reach out', 'send message', 'message us',
  'お問い合わせ', '問い合わせ', 'お問合せ', '問合せ',
  'ご相談', '相談', 'お客様窓口', 'お問い合わせフォーム',
  'お問い合わせはこちら', '問い合わせフォーム',
  'form', 'フォーム',
  '%E3%81%8A%E5%95%8F%E5%90%88%E3%82%8F%E3%81%9B', 
  '%E5%95%8F%E5%90%88%E3%81%9B', 
  '%E3%81%8A%E5%95%8F%E5%90%88%E3%81%9B', 
  '%E5%95%8F%E5%90%88%E3%81%9B'
];

// HTML解析用中優先度問い合わせキーワード
export const HTML_MEDIUM_PRIORITY_CONTACT_KEYWORDS = [
  'form', 'フォーム', 'submit', 'send', 'mail form',
  'feedback'
];

// HTML解析用除外キーワード
export const HTML_EXCLUDED_KEYWORDS = [
  'download', 'recruit', 'career'
];

// アンカーセクション分析用問い合わせキーワード
export const ANCHOR_SECTION_CONTACT_KEYWORDS = ['contact', 'お問い合わせ', '問い合わせ'];

// フォームリンクのネガティブキーワード
export const FORM_LINK_NEGATIVE_KEYWORDS = ['recruit', 'career', 'job', 'hire', 'employment', '採用', '求人', 'request', 'download', 'material', '資料', '資料請求', 'brochure'];