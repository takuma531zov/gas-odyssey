# Pull Request

## 変更の概要

URLFinderパッケージの抜本的なリファクタリングを実施し、コードベースの可読性、保守性、拡張性を大幅に向上させました。主要な変更点として、ディレクトリ構造の再編成、関数型プログラミングに基づく状態管理への移行、および関連ドキュメントの更新が含まれます。

## 変更点

*   **ディレクトリ構造の再編成**:
    *   `functions`, `data`, `pipelines`ディレクトリを廃止し、共通機能は`common/`ディレクトリに集約。
    *   検索フローは`flows/`ディレクトリ以下に処理順を示すナンバリング付きで再配置 (`00_preprocessing`, `01_urlPattern`, `02_htmlAnalysis`, `03_fallback`)。
    *   各フロー内で使用される定数や型定義も、関連するフローのサブディレクトリ内に配置し、関心事を分離。
    *   `htmlAnalysis`フロー内は`parser`, `extractor`, `keyword`に細分化。
*   **関数型プログラミングへの移行**:
    *   クラスベースの状態管理 (`SearchState`) を廃止し、関数型 (`SearchStateData`) に基づく状態管理を導入。これにより、各戦略関数は状態を引数として受け取り、新しい状態を返す純粋関数として動作。
*   **不要ファイルの削除**:
    *   重複していた`pipelines/state.ts`, `pipelines/search.ts`, `pipelines/SearchStrategy.ts`を削除。
    *   `functions/domain/form.ts`のロジックを`flows/02_htmlAnalysis/extractor/index.ts`に統合し、`form.ts`を削除。
*   **`import`パスの全面更新**: 新しいディレクトリ構造に合わせて、パッケージ全体の`import`パスを修正。
*   **型定義の集約**: 各ファイルに散在していた型定義を`common/types/index.ts`に集約し、一元管理。
*   **`README.md`の更新**:
    *   新しいアーキテクチャ図、処理フロー図を反映。
    *   スクリプトプロパティ設定の最新情報（デフォルト値、必須/任意など）を反映。
    *   GASエディタでの直接実行方法を明確化。
*   **その他**: `any`型の排除、`env.ts`の改善、`tsconfig.json`および`package.json`のクリーンアップなど、コード品質の向上。

## 影響範囲

URLFinderパッケージ全体。外部からの呼び出しインターフェース (`findContactPage`, `processContactPageFinder`, `executeUrlFinderWithUI`, `findContactPageWithVisibility`) は維持されており、既存の利用方法に影響はありません。内部実装が大幅に変更されています。

## テスト

既存のロジックは完全に維持されており、検出結果に影響がないことを確認済みです。手動での動作確認（GASエディタでの実行）を実施しました。

## 備考

特になし。