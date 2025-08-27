// 高優先度問い合わせキーワード
export const HIGH_PRIORITY_CONTACT_KEYWORDS = [
  'お問い合わせ', '問い合わせ', 'お問合せ', '問合せ', 'contact', 'inquiry', 'Contact', 'Inquiry',
  'お問い合わせフォーム', '問い合わせフォーム', 'contact form', 'inquiry form',
  'お問い合わせはこちら', '問い合わせはこちら', 'contact us', 'Contact Us',
  'ご質問', '質問', 'question', 'FAQ', 'よくある質問',
  'ご相談', '相談', 'consultation', 'お気軽にご相談',
  '資料請求', 'request', '見積もり', '見積り', 'estimate', 'quote',
  'サポート', 'support', 'help', 'ヘルプ', 'お困りごと'
];

// 基本問い合わせキーワード（より広範囲）
// HIGH_PRIORITY_CONTACT_KEYWORDSを含む
export const ALL_CONTACT_KEYWORDS = [
  ...HIGH_PRIORITY_CONTACT_KEYWORDS,
  'フォーム', 'form', 'Form', 'mail', 'メール', 'email',
  '送信', 'submit', 'send', '投稿', 'post',
  '入力', 'input', '記入', 'fill', 'フィルイン',
  '申し込み', '申込み', 'application', 'apply',
  '登録', 'registration', 'register', 'signup', 'sign up'
];

// 動的サイト用厳格キーワード検証 - 問い合わせ関連キーワード
export const DYNAMIC_CONTACT_KEYWORDS = [
  'お問い合わせ', '問い合わせ', 'contact', 'inquiry',
  'お問い合わせフォーム', 'contact form'
];

// 動的サイト用厳格キーワード検証 - 誘導文言
export const DYNAMIC_INDUCTION_PHRASES = [
  'お気軽にご相談', 'お問い合わせはこちら',
  'get in touch', 'contact us', 'reach out'
];

// 動的サイト用厳格キーワード検証 - フォーム関連ヒント
export const DYNAMIC_FORM_HINTS = [
  'フォーム読み込み中', 'loading contact form',
  'form-container', 'contact-form-placeholder'
];