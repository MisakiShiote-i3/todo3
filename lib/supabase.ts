// ============================================================
// Supabase クライアントの作成にゃ
//
// なぜ別ファイルに切り出すか：
//   createClient() をコンポーネントのたびに呼ぶと
//   不要な接続が増えてしまうにゃ。
//   1か所で作ってエクスポートすることで使い回せるにゃ。
//
// なぜ NEXT_PUBLIC_ プレフィックスが必要か：
//   Next.js では NEXT_PUBLIC_ をつけた環境変数だけが
//   ブラウザ（クライアントサイド）に公開されるにゃ。
//   つけていない変数はサーバー側でしか読めないにゃ。
// ============================================================
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
