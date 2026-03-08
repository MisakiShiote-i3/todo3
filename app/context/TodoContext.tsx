"use client";

// ============================================================
// TodoContext.tsx
//
// なぜ Context を作るか：
//   今は TodoApp 1 コンポーネントだけだが、将来的にヘッダーやサイドバーに
//   未完了数を表示したい場合、props のバケツリレーが大変になるにゃ。
//   Context にまとめると、どこからでも状態と操作にアクセスできるにゃ。
//
// 責任分離の考え方にゃ：
//   TodoContext  → ビジネスロジック（Supabase 呼び出し・状態管理）
//   TodoApp      → UI（表示・ユーザー操作の受け付け）
//   この分離により「UI を変えてもロジックは触らなくていい」状態になるにゃ。
// ============================================================

import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  ReactNode,
} from "react";
import { supabase } from "@/lib/supabase";

// ============================================================
// 型定義にゃ
// ============================================================
export type Todo = {
  id: string;
  title: string;
  completed: boolean;
  created_at: string;
};

export type Filter = "all" | "active" | "completed";

// ============================================================
// State 型にゃ
//
// useState を 5 つ個別に管理する代わりに、
// 1 つのオブジェクトにまとめるにゃ。
// useReducer でこの State を更新するにゃ。
// ============================================================
type State = {
  todos: Todo[];
  filter: Filter;
  inputValue: string;
  isLoading: boolean;
  error: string | null;
};

// ============================================================
// Action 型にゃ
//
// 「何が起きたか」を表すオブジェクトにゃ。
// Reducer はこれを受け取って次の State を決めるにゃ。
//
// 命名規則：
//   FETCH_SUCCESS / FETCH_ERROR → 非同期の結果にゃ
//   SET_xxx → 単純な値の更新にゃ
//   ADD / TOGGLE / DELETE → ドメイン操作にゃ
//   _OPTIMISTIC → 楽観的更新（先に UI を変えるにゃ）
//   _ROLLBACK   → ロールバック（失敗したら元に戻すにゃ）
// ============================================================
type Action =
  | { type: "FETCH_SUCCESS"; payload: Todo[] }
  | { type: "FETCH_ERROR"; payload: string }
  | { type: "SET_FILTER"; payload: Filter }
  | { type: "SET_INPUT_VALUE"; payload: string }
  | { type: "ADD_TODO"; payload: Todo }
  | { type: "TOGGLE_TODO_OPTIMISTIC"; id: string; completed: boolean }
  | { type: "TOGGLE_TODO_ROLLBACK"; id: string; completed: boolean }
  | { type: "DELETE_TODO_OPTIMISTIC"; id: string }
  | { type: "RESTORE_TODOS"; payload: Todo[] }
  | { type: "SET_ERROR"; payload: string | null };

// ============================================================
// Reducer 関数にゃ
//
// なぜ Reducer は純粋関数でなければならないか：
//   純粋関数（引数だけで結果が決まり副作用がない関数）にすることで、
//   「この action が来たらこの state になる」とテストや読解が容易になるにゃ。
//   Supabase 呼び出しなどの副作用は TodoProvider 側に置くにゃ。
// ============================================================
function todoReducer(state: State, action: Action): State {
  switch (action.type) {
    case "FETCH_SUCCESS":
      return { ...state, todos: action.payload, isLoading: false };

    case "FETCH_ERROR":
      return { ...state, error: action.payload, isLoading: false };

    case "SET_FILTER":
      return { ...state, filter: action.payload };

    case "SET_INPUT_VALUE":
      return { ...state, inputValue: action.payload };

    case "ADD_TODO":
      return { ...state, todos: [...state.todos, action.payload] };

    // 楽観的更新・ロールバック：両方とも「id が一致する todo の completed を書き換える」処理にゃ
    case "TOGGLE_TODO_OPTIMISTIC":
    case "TOGGLE_TODO_ROLLBACK":
      return {
        ...state,
        todos: state.todos.map((t) =>
          t.id === action.id ? { ...t, completed: action.completed } : t
        ),
      };

    case "DELETE_TODO_OPTIMISTIC":
      return {
        ...state,
        todos: state.todos.filter((t) => t.id !== action.id),
      };

    case "RESTORE_TODOS":
      return { ...state, todos: action.payload };

    case "SET_ERROR":
      return { ...state, error: action.payload };

    default:
      return state;
  }
}

// ============================================================
// Context の型にゃ
//
// コンポーネントが useTodo() で受け取れる値の一覧にゃ。
// state（読み取り）と操作関数（書き込み）を分けずに
// まとめて渡すシンプルな設計にゃ。
// ============================================================
type TodoContextValue = {
  state: State;
  filteredTodos: Todo[];
  activeCount: number;
  addTodo: (e: { preventDefault(): void }) => Promise<void>;
  toggleTodo: (id: string) => Promise<void>;
  deleteTodo: (id: string) => Promise<void>;
  setFilter: (filter: Filter) => void;
  setInputValue: (value: string) => void;
  clearError: () => void;
};

// ============================================================
// Context 本体にゃ
//
// 初期値を null にして、Provider 外で使われたときに
// useTodo() でエラーを投げられるようにするにゃ。
// ============================================================
const TodoContext = createContext<TodoContextValue | null>(null);

// ============================================================
// カスタムフック useTodo()にゃ
//
// なぜ useContext(TodoContext) を直接使わず useTodo() を作るか：
//   1. null チェックを 1 か所に集めて、Provider 外での使用を検知できるにゃ
//   2. コンポーネント側で TodoContext をインポートする必要がなくなるにゃ
//   3. 「todo 用のフック」という意味が名前から伝わるにゃ
// ============================================================
export function useTodo(): TodoContextValue {
  const ctx = useContext(TodoContext);
  if (!ctx) {
    throw new Error(
      "useTodo() は TodoProvider の内側で使うにゃ"
    );
  }
  return ctx;
}

// ============================================================
// 初期 State にゃ
// ============================================================
const initialState: State = {
  todos: [],
  filter: "all",
  inputValue: "",
  isLoading: true,
  error: null,
};

// ============================================================
// TodoProvider にゃ
//
// すべての Supabase 呼び出しとビジネスロジックをここに集約するにゃ。
// UI コンポーネントは「何をするか」だけを知り、
// 「どうやって」は知らなくてよい設計にゃ。
// ============================================================
export function TodoProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(todoReducer, initialState);

  // ============================================================
  // 初期データ取得にゃ
  //
  // useEffect の依存配列が空（[]）の理由：
  //   コンポーネントのマウント時（初回表示時）だけ実行したいにゃ。
  //   毎レンダー後に実行すると無限ループになってしまうにゃ。
  // ============================================================
  useEffect(() => {
    async function fetchTodos() {
      const { data, error } = await supabase
        .from("todos")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) {
        dispatch({
          type: "FETCH_ERROR",
          payload: "データの取得に失敗したにゃ 😿",
        });
      } else {
        dispatch({ type: "FETCH_SUCCESS", payload: data ?? [] });
      }
    }

    fetchTodos();
  }, []);

  // ============================================================
  // 派生状態（計算結果）にゃ
  //
  // filteredTodos と activeCount は todos と filter から計算できるにゃ。
  // State に持たず、レンダー時に都度計算することで
  // 「DB と state の整合性が取れていれば表示も正しい」という
  // シンプルな状態管理を保てるにゃ。
  // ============================================================
  const filteredTodos = state.todos.filter((todo) => {
    if (state.filter === "active") return !todo.completed;
    if (state.filter === "completed") return todo.completed;
    return true;
  });

  const activeCount = state.todos.filter((t) => !t.completed).length;

  // ============================================================
  // [Create] 新しい todo を追加するにゃ
  //
  // なぜ select().single() を付けるか：
  //   INSERT した後に DB が生成した id と created_at を受け取るためにゃ。
  //   これがないと追加した行のデータを再取得する必要が出てくるにゃ。
  // ============================================================
  async function addTodo(e: { preventDefault(): void }) {
    e.preventDefault();
    const title = state.inputValue.trim();
    if (!title) return;

    // 入力欄は送信と同時にクリア（await より前なので同期的に実行されるにゃ）
    dispatch({ type: "SET_INPUT_VALUE", payload: "" });

    const { data, error } = await supabase
      .from("todos")
      .insert({ title, completed: false })
      .select()
      .single();

    if (error) {
      dispatch({ type: "SET_ERROR", payload: "追加に失敗したにゃ 😿" });
      return;
    }

    dispatch({ type: "ADD_TODO", payload: data });
  }

  // ============================================================
  // [Update] 完了状態をトグルするにゃ（楽観的更新にゃ）
  //
  // 楽観的更新（Optimistic Update）とは：
  //   DB のレスポンスを待たずに先に UI を更新するパターンにゃ。
  //   失敗したら元の状態に戻すロールバック処理を用意するにゃ。
  //   ユーザーが遅延を感じないようにする UX 改善手法にゃ。
  // ============================================================
  async function toggleTodo(id: string) {
    const todo = state.todos.find((t) => t.id === id);
    if (!todo) return;

    const newCompleted = !todo.completed;

    // 先に UI を更新（楽観的更新にゃ）
    dispatch({ type: "TOGGLE_TODO_OPTIMISTIC", id, completed: newCompleted });

    const { error } = await supabase
      .from("todos")
      .update({ completed: newCompleted })
      .eq("id", id);

    if (error) {
      // 失敗したら元に戻す（ロールバックにゃ）
      dispatch({
        type: "TOGGLE_TODO_ROLLBACK",
        id,
        completed: !newCompleted,
      });
      dispatch({ type: "SET_ERROR", payload: "更新に失敗したにゃ 😿" });
    }
  }

  // ============================================================
  // [Delete] todo を削除するにゃ（楽観的更新にゃ）
  // ============================================================
  async function deleteTodo(id: string) {
    // 先に UI から削除にゃ
    dispatch({ type: "DELETE_TODO_OPTIMISTIC", id });

    const { error } = await supabase.from("todos").delete().eq("id", id);

    if (error) {
      // 失敗したら再フェッチで復元するにゃ
      const { data } = await supabase
        .from("todos")
        .select("*")
        .order("created_at", { ascending: true });
      dispatch({ type: "RESTORE_TODOS", payload: data ?? [] });
      dispatch({ type: "SET_ERROR", payload: "削除に失敗したにゃ 😿" });
    }
  }

  return (
    <TodoContext.Provider
      value={{
        state,
        filteredTodos,
        activeCount,
        addTodo,
        toggleTodo,
        deleteTodo,
        setFilter: (filter) =>
          dispatch({ type: "SET_FILTER", payload: filter }),
        setInputValue: (value) =>
          dispatch({ type: "SET_INPUT_VALUE", payload: value }),
        clearError: () => dispatch({ type: "SET_ERROR", payload: null }),
      }}
    >
      {children}
    </TodoContext.Provider>
  );
}
