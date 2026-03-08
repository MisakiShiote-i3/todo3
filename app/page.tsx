// ============================================================
// page.tsx はサーバーコンポーネントにゃ
//
// "use client" を書かないので Next.js はこれをサーバーで実行するにゃ。
// サーバーコンポーネントは HTML を事前生成できるので SEO やパフォーマンスに優れるにゃ。
//
// なぜサーバーコンポーネントが TodoProvider（クライアント）をラップできるか：
//   Next.js App Router では、サーバーコンポーネントは
//   クライアントコンポーネントを children として渡せるにゃ。
//   クライアント境界は TodoProvider から始まり、
//   その配下が全てクライアント側で動くにゃ。
// ============================================================
import { TodoProvider } from "./context/TodoContext";
import TodoApp from "./components/TodoApp";

export default function Home() {
  return (
    <TodoProvider>
      <TodoApp />
    </TodoProvider>
  );
}
