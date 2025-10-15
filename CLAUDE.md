# gas-odyssey-master

このリポジトリはGoogle Apps Script（GAS）開発のためのモノレポです。
claspを用いてtypeScriptでローカル開発して、GASにbuild&deployします。


## 構成

- `packages/` - 各GASアプリケーションの開発ディレクトリ

## 開発

packagesディレクトリ内でアプリケーションを開発します。

## 開発ルール
- biomeエラーに注意
- 極力モダンな記法を採用
- 関数型プログラミング
- 深いネストは避ける
- データと関数は分離させる
- 単一責任の原則に従い、機能ごとにファイルを分ける
- 設定ファイルはユーザーの許可なしに変更しないこと
- ファイルはユーザーの許可なしに削除しないこと
- 機能ごとに日本語コメントをつける（ただしメタ的なコメントはしないこと）
- スプレッドシート操作に関する関数は積極的にpackages/common/src/spreadsheet.tsをimport利用すること（spreadsheet.tsの編集はしないこと）

## 現行プロジェクト
packages/autoAgencyReport
参照
packages/autoAgencyReport/代理店進捗報告自動化.md

**不明点があれば解消するまでwriteせずユーザーに質問すること**
