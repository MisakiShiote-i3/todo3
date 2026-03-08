"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

// ============================================================
// 型定義
//
// Supabase のテーブル定義と合わせた型にゃ。
// id が string（UUID）で created_at が string（ISO文字列）にゃ。
// ============================================================
type Todo = {
  id: string;
  title: string;
  completed: boolean;
  created_at: string;
};

type Filter = "all" | "active" | "completed";

// ============================================================
// 日時フォーマット
// ============================================================
function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ============================================================
// TodoApp コンポーネント（Supabase版）
//
// localStorage版との主な違いにゃ：
//   1. DB操作が非同期（async/await）になるにゃ
//      → ネットワーク越しにデータをやり取りするので待ち時間が発生するにゃ
//   2. ローディング状態（isLoading）が必要になるにゃ
//      → DBからデータが返ってくるまで空リストを表示しないためにゃ
//   3. エラー状態（error）を扱う必要があるにゃ
//      → ネットワークエラーやDB制約違反などが起きうるにゃ
//   4. データの永続化がサーバー側になるにゃ
//      → どのデバイス・ブラウザからも同じデータが見えるにゃ
// ============================================================
export default function TodoApp() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ============================================================
  // 初期データ取得
  //
  // なぜ useEffect で fetch するか：
  //   コンポーネントがマウントされた後（ブラウザで表示された後）に
  //   Supabase へリクエストを送るにゃ。
  //   サーバーサイドレンダリング時には実行されないにゃ。
  //
  // なぜ created_at で昇順ソートするか：
  //   古いものが上に来る方が自然なTodoリストの順序にゃ。
  // ============================================================
  useEffect(() => {
    async function fetchTodos() {
      const { data, error } = await supabase
        .from("todos")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) {
        setError("データの取得に失敗したにゃ 😿");
      } else {
        setTodos(data ?? []);
      }
      setIsLoading(false);
    }

    fetchTodos();
  }, []);

  // フィルタリング（ローカル計算にゃ）
  const filteredTodos = todos.filter((todo) => {
    if (filter === "active") return !todo.completed;
    if (filter === "completed") return todo.completed;
    return true;
  });

  const activeCount = todos.filter((t) => !t.completed).length;

  // ============================================================
  // [Create] 新しい todo を追加するにゃ
  //
  // なぜ select().single() を付けるか：
  //   INSERT した後に DB が生成した id と created_at を受け取るためにゃ。
  //   これがないと追加した行のデータを再取得する必要が出てくるにゃ。
  // ============================================================
  async function addTodo(e: { preventDefault(): void }) {
    e.preventDefault();
    const title = inputValue.trim();
    if (!title) return;

    setInputValue("");

    const { data, error } = await supabase
      .from("todos")
      .insert({ title, completed: false })
      .select()
      .single();

    if (error) {
      setError("追加に失敗したにゃ 😿");
      return;
    }

    // DB が返した行（id・created_at 付き）を state に追加するにゃ
    setTodos((prev) => [...prev, data]);
  }

  // ============================================================
  // [Update] 完了状態をトグルするにゃ
  //
  // なぜ楽観的更新（Optimistic Update）を使うか：
  //   DB のレスポンスを待ってから UI を更新すると
  //   クリックが反映されるまで遅延を感じるにゃ。
  //   先に UI を更新し、失敗したら元に戻すことで
  //   即座に反応するアプリになるにゃ。
  // ============================================================
  async function toggleTodo(id: string) {
    const todo = todos.find((t) => t.id === id);
    if (!todo) return;

    const newCompleted = !todo.completed;

    // 先に UI を更新（楽観的更新にゃ）
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: newCompleted } : t))
    );

    const { error } = await supabase
      .from("todos")
      .update({ completed: newCompleted })
      .eq("id", id);

    if (error) {
      // 失敗したら元に戻すにゃ
      setTodos((prev) =>
        prev.map((t) => (t.id === id ? { ...t, completed: !newCompleted } : t))
      );
      setError("更新に失敗したにゃ 😿");
    }
  }

  // ============================================================
  // [Delete] todo を削除するにゃ（楽観的更新）
  // ============================================================
  async function deleteTodo(id: string) {
    // 先に UI から削除にゃ
    setTodos((prev) => prev.filter((t) => t.id !== id));

    const { error } = await supabase.from("todos").delete().eq("id", id);

    if (error) {
      // 失敗したら元に戻すにゃ（再取得で復元）
      const { data } = await supabase
        .from("todos")
        .select("*")
        .order("created_at", { ascending: true });
      setTodos(data ?? []);
      setError("削除に失敗したにゃ 😿");
    }
  }

  // ローディング中にゃ
  if (isLoading) {
    return (
      <div className="container">
        <h1>📝 Todo App 3</h1>
        <p className="status-message">読み込み中にゃ…</p>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>📝 Todo App 3</h1>

      {/* エラー表示にゃ */}
      {error && (
        <p
          style={{ color: "#e74c3c", textAlign: "center", marginBottom: 16 }}
          onClick={() => setError(null)}
        >
          {error}（クリックで閉じるにゃ）
        </p>
      )}

      <form id="todo-form" onSubmit={addTodo}>
        <input
          type="text"
          id="todo-input"
          placeholder="新しいタスクを入力してにゃ"
          autoComplete="off"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
        />
        <button type="submit">追加</button>
      </form>

      <div className="filters">
        {(["all", "active", "completed"] as Filter[]).map((f) => (
          <button
            key={f}
            className={`filter-btn ${filter === f ? "active" : ""}`}
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "すべて" : f === "active" ? "未完了" : "完了済み"}
          </button>
        ))}
      </div>

      <ul id="todo-list">
        {filteredTodos.length === 0 ? (
          <li className="status-message">タスクがありませんにゃ 🐱</li>
        ) : (
          filteredTodos.map((todo) => (
            <li
              key={todo.id}
              className={`todo-item ${todo.completed ? "completed" : ""}`}
            >
              <div
                className="todo-checkbox"
                onClick={() => toggleTodo(todo.id)}
              >
                {todo.completed ? "✓" : ""}
              </div>
              <div className="todo-body">
                <span className="todo-title">{todo.title}</span>
                <span className="todo-date">
                  登録: {formatDate(todo.created_at)}
                </span>
              </div>
              <button
                className="delete-btn"
                title="削除"
                onClick={() => deleteTodo(todo.id)}
              >
                ✕
              </button>
            </li>
          ))
        )}
      </ul>

      {todos.length > 0 && (
        <p className="footer-info">
          未完了: {activeCount} / 全体: {todos.length}
        </p>
      )}
    </div>
  );
}
