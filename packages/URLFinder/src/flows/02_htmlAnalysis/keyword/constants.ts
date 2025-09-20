/**
 * キーワード定数統合版 - 完全一致データの統合
 * 既存ロジックを完全維持
 */

// 高優先度問い合わせキーワード（keywords.tsから）
export const HIGH_PRIORITY_CONTACT_KEYWORDS = [
  'お問い合わせ', '問い合わせ', 'お問合せ', '問合せ', 'contact', 'inquiry', 'Contact', 'Inquiry',
  'お問い合わせフォーム', '問い合わせフォーム', 'contact form', 'inquiry form',
  'お問い合わせはこちら', '問い合わせはこちら', 'contact us', 'Contact Us',
  'ご質問', '質問', 'question', 'FAQ', 'よくある質問',
  'ご相談', '相談', 'consultation', 'お気軽にご相談',
  '資料請求', 'request', '見積もり', '見積り', 'estimate', 'quote',
  'サポート', 'support', 'help', 'ヘルプ', 'お困りごと'
];

// 基本問い合わせキーワード（より広範囲）（keywords.tsから）
export const CONTACT_KEYWORDS = [
  ...HIGH_PRIORITY_CONTACT_KEYWORDS,
  'フォーム', 'form', 'Form', 'mail', 'メール', 'email',
  '送信', 'submit', 'send', '投稿', 'post',
  '入力', 'input', '記入', 'fill', 'フィルイン',
  '申し込み', '申込み', 'application', 'apply',
  '登録', 'registration', 'register', 'signup', 'sign up'
];

/**
 * パターン定数統合版 - 完全一致データの統合
 * 既存ロジックを完全維持
 */

// 電話番号の正規表現パターン（contact_patterns.tsから）
export const PHONE_PATTERNS = [
  /\d{2,4}[-‐]\d{2,4}[-‐]\d{3,4}/g,      // 03-1234-5678
  /\d{3}\.\d{3}\.\d{4}/g,                 // 123.456.7890
  /\(\d{3}\)\s?\d{3}[-‐]\d{4}/g,         // (123) 456-7890
  /tel[:\s]*[\d\-\(\)\s+]{10,}/gi        // tel: 形式
];

// メールアドレスの正規表現パターン（contact_patterns.tsから）
export const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// ネガティブパターン（除外キーワード）（contact_patterns.tsから）
export const NEGATIVE_PATTERNS = [
  'privacy', 'legal', 'terms', 'policy', 'about', 'news', 'blog'
];

// フォーム言及パターン（contact_patterns.tsから）
export const FORM_MENTION_PATTERNS = [
  'フォーム', 'form', 'お問い合わせ', 'contact', '送信', 'submit'
];

// 動的サイト用問い合わせキーワード（contact_patterns.tsから）
export const DYNAMIC_CONTACT_KEYWORDS = [
  'お問い合わせ', '問い合わせ', 'contact', 'inquiry',
  'お問い合わせフォーム', 'contact form'
];

// 動的サイト用誘導フレーズ（contact_patterns.tsから）
export const DYNAMIC_INDUCTION_PHRASES = [
  'お気軽にご相談', 'お問い合わせはこちら',
  'get in touch', 'contact us', 'reach out'
];

// 動的サイト用フォームヒント（contact_patterns.tsから）
export const DYNAMIC_FORM_HINTS = [
  'フォーム読み込み中', 'loading contact form',
  'form-container', 'contact-form-placeholder'
];
