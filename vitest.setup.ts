// ============================================================
// テストセットアップファイルにゃ
//
// なぜ @testing-library/jest-dom/vitest をインポートするか：
//   このインポートによって以下の2つが行われるにゃ：
//
//   1. toBeInTheDocument(), toHaveClass(), toHaveValue() など
//      DOM に特化したカスタムマッチャーが expect() に追加されるにゃ。
//      （素の Vitest には DOM マッチャーが含まれていないにゃ）
//
//   2. TypeScript の型拡張（expect() の型定義にマッチャーが追加されるにゃ）
//
// なぜ /vitest サフィックスが必要か：
//   @testing-library/jest-dom は元々 Jest 用だったにゃ。
//   /vitest エントリーポイントは Vitest の expect を拡張するための
//   専用バージョンにゃ。これを使わないと型エラーになるにゃ。
// ============================================================
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// ============================================================
// なぜ明示的に cleanup() を呼ぶ必要があるか：
//
//   @testing-library/react は通常、グローバルの afterEach が
//   存在すれば自動的にクリーンアップを登録するにゃ。
//   しかし Vitest はデフォルトで globals: false なので
//   afterEach がグローバルスコープに存在せず、自動登録が行われないにゃ。
//
//   cleanup() を呼ばないと、前のテストで render() した DOM が
//   次のテストにも残ってしまい、「複数の要素が見つかった」
//   というエラーの原因になるにゃ。
// ============================================================
afterEach(() => {
  cleanup();
});
