# URLFinder - 問い合わせページ検出システム

このシステムは、企業ウェブサイトから問い合わせページやフォームを自動検出するツールです。

## 基本的な動作フロー

### 1. 入力
- **対象URL**: 検索対象の企業ウェブサイトURL
- **例**: `https://example.com/` または `https://example.com/company/about/`

### 2. ドメイン抽出
サブディレクトリURLの場合、ドメイン部分を抽出します。
```
入力: https://example.com/company/about/
↓
ドメイン: https://example.com/
```

### 3. ページ取得・解析
指定されたURLのHTMLコンテンツを取得し、以下の順序で検索します。

## 検索フロー詳細

### ステップ1: トップページ内フォーム検索
**目的**: ページ内に直接埋め込まれた問い合わせフォームを探す

#### A. Google Forms検索
```
検索対象: HTMLコンテンツ全体
検索パターン: 
- https://docs.google.com/forms/...
- https://forms.gle/...
- https://goo.gl/forms/...
```

#### B. 埋め込みHTMLフォーム検索
```
検索対象: <form>タグとその内容
判定条件: 以下のキーワードが2つ以上含まれる
- 日本語: お名前、メールアドレス、電話番号、ご質問 等
- 英語: name, email, phone, message 等
```

**結果例**:
- Google Forms URL → そのURLを返す
- 埋め込みフォーム検出 → `embedded_contact_form_on_page`（識別子）

### ステップ2: HTML解析による問い合わせリンク検索

#### A. ナビゲーションメニュー検索
```html
<nav>
  <a href="/contact/">お問い合わせ</a>  ← 検出対象
</nav>
```

#### B. フッター検索
```html
<footer>
  <a href="/inquiry/">Contact Us</a>  ← 検出対象
</footer>
```

#### C. 全体リンク検索
ページ全体の`<a>`タグを検索

### ステップ3: キーワードマッチング

現在のキーワード設定：

#### CONTACT_KEYWORDS（リンクテキスト用）
```typescript
[
  'contact', 'お問い合わせ', '問い合わせ', 'お問合せ',
  'contact us', 'support', 'inquiry', 'ご相談',
  'about', 'company', '会社概要', 'help' // ← 優先度が低いべき
]
```

#### CONTACT_URL_PATTERNS（URL用）
```typescript
[
  'contact', 'inquiry', 'support', 
  'about', 'company', 'info', 'help' // ← 優先度が低いべき
]
```

### ステップ4: サブディレクトリ対応
元URLで見つからない場合、ドメインベースで再検索

### ステップ5: URL推測検索
一般的なパターンをテスト:
```
/contact/, /contact, /inquiry/, /お問い合わせ/ 等
```

## 現在の問題点

### 1. キーワード優先度の欠如
```
現状: 「company」と「contact」が同じ優先度
問題: 会社概要ページが問い合わせページより優先される
```

### 2. 先着順処理
```
現状: 最初に見つかったリンクを採用
問題: より適切な「contact」より「about」が選ばれる
```

### 3. ページ内容の検証不足
```
現状: URLの存在確認のみ
問題: 404ページや無効なページも「見つかった」と判定
```

## 改善予定

### 1. キーワード優先度システム
```typescript
// 高優先度
['contact', 'お問い合わせ', '問い合わせ', 'inquiry']

// 中優先度  
['support', 'help', 'ご相談']

// 低優先度
['about', 'company', '会社概要', 'info']
```

### 2. ページ内容検証
- 実際にフォーム要素が存在するか確認
- 404エラーページの判定
- 有効なコンテンツの存在確認

### 3. スコアリングシステム
複数候補から最適なページを選択する仕組み

## 出力パターン

| 検出ケース | contactUrl | actualFormUrl | 最終出力 |
|------------|------------|---------------|----------|
| Google Form直接 | `baseUrl` | `https://forms.gle/...` | **Google FormのURL** |
| 埋め込みフォーム | `baseUrl` | `embedded_contact_form_on_page` | **元のページURL** |
| 問い合わせページ | `/contact/` | `null` | **問い合わせページURL** |
| 検出失敗 | `null` | `null` | **エラーメッセージ** |

## 使用方法

### スプレッドシート連携
```javascript
// GAS関数
processContactPageFinder()
```

### 単体テスト
```javascript  
// 単一URL検証
const result = findContactPage('https://example.com/');
console.log(result);
```