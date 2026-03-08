// ============================================================
// Vitest 設定ファイルにゃ
//
// なぜ vite の defineConfig ではなく vitest/config の defineConfig を使うか：
//   vitest/config 版は test プロパティの型定義を含んでいるにゃ。
//   vite の defineConfig では test の型が認識されないにゃ。
// ============================================================
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  // ============================================================
  // plugins: JSX/TSX の変換に React プラグインが必要にゃ
  //
  // なぜ @vitejs/plugin-react か：
  //   Vitest は Vite ベースなので Vite のプラグインが使えるにゃ。
  //   このプラグインが JSX を React.createElement に変換してくれるにゃ。
  // ============================================================
  plugins: [react()],

  test: {
    // ============================================================
    // environment: テスト実行環境にゃ
    //
    // なぜ jsdom か：
    //   React コンポーネントは DOM が必要にゃ。
    //   Node.js にはデフォルトで DOM がないので
    //   jsdom で仮想的なブラウザ環境を作るにゃ。
    //   他の選択肢は 'happy-dom'（軽量だが jsdom より互換性が低い）にゃ。
    // ============================================================
    environment: "jsdom",

    // ============================================================
    // setupFiles: 各テストファイルの実行前に読み込むファイルにゃ
    //
    // なぜ setupFiles が必要か：
    //   @testing-library/jest-dom のカスタムマッチャーを
    //   全テストで使えるようにグローバル登録するためにゃ。
    // ============================================================
    setupFiles: ["./vitest.setup.ts"],
  },

  resolve: {
    // ============================================================
    // alias: パスエイリアスの設定にゃ
    //
    // なぜ必要か：
    //   TodoApp.tsx は `import { supabase } from "@/lib/supabase"` のように
    //   @/ エイリアスを使っているにゃ。
    //   Next.js はこれを自動解決してくれるが、Vitest は別なので
    //   ここで同じルールを教えてあげる必要があるにゃ。
    //
    //   tsconfig.json の "paths": { "@/*": ["./*"] } と同じ意味にゃ。
    // ============================================================
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
