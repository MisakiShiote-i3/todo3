"use client";

// ============================================================
// TodoApp.tsx（UI 専用コンポーネントにゃ）
//
// リファクタリング前との違いにゃ：
//   Before: useState・useEffect・Supabase 呼び出しが全てここにあったにゃ
//   After : useTodo() を呼ぶだけで、「何を表示するか」と「何をするか」だけを書くにゃ
//
// このコンポーネントは「表示と操作の受け付け」だけに集中できるにゃ。
// ビジネスロジックは TodoContext.tsx に移したにゃ。
// ============================================================

import { useTodo } from "@/app/context/TodoContext";
import type { Filter } from "@/app/context/TodoContext";

// ============================================================
// 日時フォーマット（UI 用のユーティリティにゃ）
//
// 表示専用の関数なので TodoApp.tsx に置くにゃ。
// Context はデータの形式（ISO 文字列）を知らなくていいにゃ。
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

export default function TodoApp() {
  // ============================================================
  // useTodo() でコンテキストから全ての状態と操作を取得するにゃ
  //
  // なぜ 1 行で全部取れるか：
  //   TodoProvider が state・filteredTodos・操作関数をまとめて
  //   Context に渡しているためにゃ。
  //   このコンポーネントは Supabase を知らなくていいにゃ。
  // ============================================================
  const {
    state: { todos, filter, inputValue, isLoading, error },
    filteredTodos,
    activeCount,
    addTodo,
    toggleTodo,
    deleteTodo,
    setFilter,
    setInputValue,
    clearError,
  } = useTodo();

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
          onClick={clearError}
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
