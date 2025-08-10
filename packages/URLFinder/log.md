# Step2全体フロー（改修後）

## Step2の目的と位置づけ
- **実行条件**: Step1で構造化フォームが見つからなかった場合のfallback
- **対象**: Navigation/FooterにCONTACTキーワードを含むリンクがあるページ
- **前提**: すでにキーワードマッチングで問い合わせページの可能性が高い

## Step2詳細フロー

### 1. ホームページHTML取得・解析
```
ホームページのHTML取得 
→ 文字エンコーディング検証（utf-8, shift_jis, euc-jp）
→ HTML解析準備完了
```

### 2. Navigation/Footer検索
```
Navigation検索:
- <nav>タグ
- ヘッダー要素
- メインメニュー系クラス/ID
- モバイルメニュー系
- ul/liベースのメニュー

Footer検索:
- <footer>タグ  
- フッター系クラス/ID
- サイト下部コンテンツエリア
- 下部ナビゲーション
```

### 3. CONTACTキーワードマッチング
```
HIGH_PRIORITY_CONTACT_KEYWORDS:
- contact, contact us, contact form
- inquiry, enquiry, get in touch
- reach out, send message, message us  
- お問い合わせ

マッチング対象:
- リンクのURL: /contact.php
- リンクのテキスト: CONTACT
```

### 4. 重複チェック（修正済み）
```
従来: Step1で処理した全URL（失敗含む）をスキップ
↓
改修後: Step1で成功したフォームURLのみスキップ

チェック対象: successfulFormUrls[]
- Step1でフォーム検証成功 → スキップ
- Step1でフォーム検証失敗 → 再検証実行
```

### 5. 再検証処理

#### 5-1. Navigation検出URLの詳細検証
```
Navigation/Footer検索で見つかったURL（例: /contact.php）に対して:

A. 標準フォーム検証:
   1. <form>要素存在確認
   2. 送信要素検出:
      - input[type="submit"]
      - input[type="image"] ← 新規追加
      - button[type="submit"] 
      - button（type指定なし）

B. Google Forms検証:
   - <a>タグ内のGoogle Forms URL
   - <iframe>タグ内のGoogle Forms URL
   - docs.google.com/forms パターン検出
   - forms.gle 短縮URL検出

C. キーワードベース判定（効率化）:
   - 条件: Navigation検出 + contact keyword + score >= 15
   - 理由: Step2到達 = 高信頼度、フォーム検証より効率的
   - 結果: 問い合わせページとして認定
```

#### 5-2. ホームページ全体フォーム解析（fallback）
```
Navigation検索で見つからない場合の包括的解析:

A. ホームページ内の全フォーム検出:
   - ページ全体の<form>要素をスキャン
   - 各フォームの送信要素検証
   - reCAPTCHA検出

B. ホームページ内のGoogle Forms検出:
   - ページ全体のGoogle Forms URL検索
   - 埋め込みGoogle Formsの検出
   - フォーム有効性の確認

C. 構造化フォーム分析:
   - フォーム内フィールド数のカウント
   - 問い合わせ固有フィールドの検出
   - フォームの品質評価
```


## 期待される効果

### casual-dining.jpでの動作例
```
Step1: /contact.php → 各種フォーム検証失敗 → candidateUrls記録

Step2: 
1. ホームページHTML取得・解析 → 成功
2. Navigation検索 → /contact.php 検出（contact キーワードマッチ）
3. 重複チェック: successfulFormUrlsになし → 再検証実行

4. Navigation検出URLの詳細検証: /contact.php
   A. 標準フォーム検証 → 失敗（<form>なし）
   B. Google Forms検証 → 失敗（URLなし）
   C. キーワードベース判定 → 成功 ✅
      - Navigation検出済み + contact keyword + score=15
      - 高信頼度による問い合わせページ認定

（キーワードベース判定で成功のため、以下は実行されない）
5. 他のNavigation候補があれば同様に検証
6. 全候補失敗時のみホームページ全体フォーム解析

結果: casual-dining.jp/contact.php を問い合わせページとして認定
```

### 汎用性
```
適用対象:
- フォーム要素が動的生成されるサイト
- 外部フォームサービス（iframe）使用サイト
- JavaScript制御のフォーム
- シンプルな問い合わせページ（電話番号のみ等）

効果:
- Step1失敗ケースの大幅救済
- GAS制約に最適化されたアプローチ
- 高精度・高速な判定
```

## 技術的改修ポイント

### 1. iframe検出削除
```
削除理由:
- GAS: 静的HTML取得のみ
- iframe: JavaScript動的生成が主流
- 外部ドメイン: 取得不可能

削除内容:
- hasScriptAndIframeForm() 関数
- 外部フォームサービスリスト  
- iframe検出デバッグロジック
```

### 2. 重複スキップ修正
```
問題:
- validUrls: 200 OKの全URL（成功・失敗問わず）
- Step2で失敗したURLもスキップされる

修正:
- successfulFormUrls: 成功したフォームURLのみ
- Step1フォーム成功時のみ記録
- Step2で真の重複のみスキップ
```

### 3. キーワードベース判定追加（提案）
```
実装箇所: Step2のフォーム検証失敗後
条件: Navigation検出 + keyword検出 + form検証失敗
結果: キーワードベースで成功判定
```

## 結論

**Step2は「Navigation/Footer解析による高信頼度ページの救済機能」**として位置づけ、GASの制約を考慮したキーワードベース判定により実用性を大幅向上。