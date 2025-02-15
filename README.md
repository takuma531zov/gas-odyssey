## プロジェクト名

- GAS を管理するためのモノレポ

## ディレクトリ構成

- packages/ 各プロジェクトごとのコードを管理（hoge, fuga, piyo はサンプル）
- packages/common 共通化したコードを格納
- scripts/ ビルドやクローン、デプロイ用のスクリプトを格納
- template クローン時にプロジェクトフォルダ内に追加したいテンプレートファイルを格納

## 環境構築

1. `clasp`をグローバルインストール（未インストールの場合）

```
npm install -g @google/clasp
```

2. pnpm のインストール（未インストールの場合）

```
brew install pnpm
```

3. pdg-media-gas ディレクトリ内で各パッケージをインストールするコマンドを実行

```
pnpm install
```

4. clasp で Google アカウントにログインする（異なる Google アカウントで行う場合は、一度 clasp logout してから行う）

```
clasp login
```

5. https://script.google.com/home/usersettings にアクセスして API を有効にする

### 既存の GAS のプロジェクトを clone する場合

1. `clasp clone` を行う
   GAS エディタの「プロジェクトの設定」からスクリプト ID をコピーして clone する

```
pnpm clone <projectName> <scriptId>
```

- gs ファイルが js として src ディレクトリ内にコピーされる
- `.clasp.dev.json`ファイルと`.clasp.prod.json`ファイルが生成される
- `appsscript.json`ファイルがコピー or 新規作成される
- `pacakges/common/config`にある`esbuild.config.js`がプロジェクトフォルダ内に複製される（エントリーポイントや出力先を決めるのに必要）

例)`pnpm clone piyo <scriptId>`

```
piyo % tree -a .
.
├── .clasp.dev.json
├── .clasp.prod.json
├── appsscript.json
├── esbuild.config.js
└── src
  └── main.js
2 directories, 4 files
```

2. 生成された`esbuild.config.js`内の`entryPoints`と`outfile`を適切に修正
   ※エントリーファイルは`src`フォルダ内、出力先のフォルダは`dist`内であり、これらは変更不可

例）エントリーポイントが「コード.ts」の場合

```
entryPoints: [path.join(__dirname, "src/コード.ts")],
```

例）出力ファイルを「index.js」にしたい場合

```
outfile: path.join(__dirname, "dist/index.js"),
```

3. ルートディレクトリの`package.json`にビルドとデプロイのコマンドを追加（デプロイ用のコマンドは`dev`用と`prod`用の２つ用意）

   ```
   ...
   "scripts": {
    ...
    "build:<projectName>": "node ./scripts/build.js <projectName>",
    "deploy:dev:<projectName>": "node ./scripts/deploy.js dev <projectName>",
    "deploy:prod:<projectName>": "node ./scripts/deploy.js prod <projectName>"
    },
    ...
   ```

4. 作成したプロジェクトのディレクトリに移動

```
cd packages/<projectName>
```

5. package.json を作成

```
pnpm init
```

## ビルド

ルートディレクトリで、ビルドしたいプロジェクトを指定して以下のコマンドを実行

```
pnpm build:<projectName>
```

## デプロイ（必ずビルド後に行う）

既存のデプロイされているコードを上書きしてしまうので、実行時は注意

1. `.clasp.json`ファイルの準備

   - 開発環境用の GAS にデプロイしたい場合は、`.clasp.dev.json`が必要
   - 本番環境用の GAS にデプロイしたい場合は、`.clasp.prod.json`が必要

   `.clasp.*json`の`scriptId`フィールドに、紐づく GAS のスクリプト ID を記載しておく必要がある
   `scriptId` は、GAS の【プロジェクトの設定】から確認可能

   ```
   {
     "scriptId": "ここにスクリプトIDを記載",
     "rootDir": "./dist"
   }
   ```

2. ルートディレクトリで、デプロイしたいプロジェクトを指定して以下のコマンドを実行

   - 開発環境用の GAS にデプロイしたい場合：`pnpm deploy:dev:<projectName>`
   - 本番環境用の GAS にデプロイしたい場合：`pnpm deploy:prod:<projectName>`

     既存のデプロイされているコードを上書きしてしまうので、実行時は注意

### トラブルシューティング

デプロイ時に以下のようなエラーが出る場合

```
Pushing piyo to Google Apps Script...
⠸ Pushing files…Push failed. Errors:
GaxiosError: User has not enabled the Apps Script API. Enable it by visiting https://script.google.com/home/usersettings then retry. If you enabled this API recently, wait a few minutes for the action to propagate to our systems and retry.
```

https://script.google.com/home/usersettings にアクセスして、Google Apps Script API を【オン】にして再度デプロイする

## 技術スタック

| 技術/ツール        | 説明                                                                          |
| ------------------ | ----------------------------------------------------------------------------- |
| Google Apps Script | Google のサービスと連携してスクリプトを実行するプラットフォーム               |
| clasp              | GAS（Google Apps Script）をローカル環境で開発するためのツール                 |
| TypeScript         | JavaScript に型を追加した言語。より安全で保守性の高いコードを書くことができる |
| Biome              | コード解析とフォーマットを行うツール（Prettier, ESLint の代替）               |
| esbuild            | 高速な JavaScript/TypeScript バンドラー                                       |
| lefthook           | Git フックを管理するためのツール（Husky, lint-staged の代替）                 |

## ブランチ運用

- master
- feature/
  - 修正単位で feature を作成
  - PR 作成 → Approve されたら main にマージ
- hotfix/
  - ビルド不能やユーザー影響等致命的な不具合の際、修正ブランチとして切る

## Dofy の起動方法
1. ディレクトリ移動
   ```
   cd dify/docker
   ```
2. 初回のみ以下を実行
   ```
   cp .env.example .env
   ```
3. Dockerアプリを起動
4. コンテナ起動
```
docker compose up -d
```
5. http://localhost/apps にアクセス
5. dsl/[パッケージ名]に一致するフォルダ内にあるDSL形式のYMLファイルと資料をGUI上からインポート&アップロード
6. コンテナ停止
```
docker compose down
```
