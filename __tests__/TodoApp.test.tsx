// ============================================================
// TodoApp コンポーネントのテストにゃ
//
// リファクタリング後の変更点にゃ：
//   Before: <TodoApp /> を直接 render していたにゃ
//   After : <TodoProvider><TodoApp /></TodoProvider> でラップするにゃ
//
//   理由：ビジネスロジック（Supabase 呼び出し）が TodoProvider に移ったにゃ。
//   TodoApp だけ render しても useTodo() が Context を見つけられずエラーになるにゃ。
//   Provider を通すことで、モックされた Supabase を使った統合テストになるにゃ。
//
// テストの構成にゃ：
//   1. ローディング状態のテスト
//   2. Todo一覧表示のテスト
//   3. フィルター機能のテスト
//   4. Todo追加のテスト
//   5. Todo完了切り替えのテスト（楽観的更新）
//   6. Todo削除のテスト（楽観的更新）
//   7. エラー表示のテスト
// ============================================================

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { TodoProvider } from "../app/context/TodoContext";
import TodoApp from "../app/components/TodoApp";

// ============================================================
// Supabase のモック設定にゃ
//
// なぜモックが必要か：
//   実際の Supabase に接続するとテストが不安定になるにゃ。
//   ネットワークが必要・テストごとにデータが変わる・遅い、などの問題があるにゃ。
//   モックを使えばテストデータを完全に制御できるにゃ。
//
// なぜ vi.hoisted() を使うか：
//   vi.mock() の呼び出しは Vitest によってファイルの先頭に「ホイスト（巻き上げ）」されるにゃ。
//   通常の const 宣言はホイストされないので、vi.mock() の中から
//   外部の変数を参照するとエラーになるにゃ。
//   vi.hoisted() を使うと、その変数もホイストされた状態で使えるにゃ。
// ============================================================
const mockFrom = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: mockFrom,
  },
}));

// ============================================================
// テスト用サンプルデータにゃ
// ============================================================
type Todo = {
  id: string;
  title: string;
  completed: boolean;
  created_at: string;
};

const sampleTodos: Todo[] = [
  {
    id: "1",
    title: "テストタスク1",
    completed: false,
    created_at: "2024-01-01T00:00:00.000Z",
  },
  {
    id: "2",
    title: "テストタスク2",
    completed: true,
    created_at: "2024-01-02T00:00:00.000Z",
  },
];

// ============================================================
// テスト用ヘルパーにゃ
//
// なぜ renderWithProvider を作るか：
//   全テストで <TodoProvider><TodoApp /></TodoProvider> を書くのは冗長にゃ。
//   1 か所にまとめると、将来 Provider に props が増えても修正箇所が 1 か所になるにゃ。
// ============================================================
function renderWithProvider() {
  return render(
    <TodoProvider>
      <TodoApp />
    </TodoProvider>
  );
}

// ============================================================
// モック設定ヘルパー関数にゃ
//
// なぜヘルパーを作るか：
//   Supabase のメソッドチェーンは複雑にゃ（from().select().order() など）。
//   毎回手動で書くと冗長でテストが読みにくくなるにゃ。
//   ヘルパーにまとめることで「このテストは何を返すか」が一目でわかるにゃ。
//
// なぜ mockReturnValueOnce を使うか：
//   from() が複数回呼ばれるテストがあるにゃ（例：削除失敗後の再フェッチ）。
//   mockReturnValueOnce は「次の1回だけ」この値を返す設定にゃ。
//   複数回呼ぶと順番に消費されるので、呼び出し順にセットアップできるにゃ。
// ============================================================

/**
 * 初期フェッチのモックをセットアップするにゃ。
 * from("todos").select("*").order(...) のチェーンを模倣するにゃ。
 */
function setupFetchMock(data: Todo[], error: Error | null = null) {
  mockFrom.mockReturnValueOnce({
    select: vi.fn().mockReturnValue({
      order: vi.fn().mockResolvedValue({ data, error }),
    }),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  });
}

/**
 * Todo追加のモックをセットアップするにゃ。
 * from("todos").insert({...}).select().single() のチェーンを模倣するにゃ。
 */
function setupInsertMock(data: Todo | null, error: Error | null = null) {
  mockFrom.mockReturnValueOnce({
    select: vi.fn(),
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data, error }),
      }),
    }),
    update: vi.fn(),
    delete: vi.fn(),
  });
}

/**
 * Todo更新（完了切り替え）のモックをセットアップするにゃ。
 * from("todos").update({...}).eq("id", id) のチェーンを模倣するにゃ。
 */
function setupToggleMock(error: Error | null = null) {
  mockFrom.mockReturnValueOnce({
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error }),
    }),
    delete: vi.fn(),
  });
}

/**
 * Todo削除のモックをセットアップするにゃ。
 * from("todos").delete().eq("id", id) のチェーンを模倣するにゃ。
 */
function setupDeleteMock(error: Error | null = null) {
  mockFrom.mockReturnValueOnce({
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error }),
    }),
  });
}

// ============================================================
// テストスイートにゃ
// ============================================================
describe("TodoApp", () => {
  // ============================================================
  // beforeEach: 各テストの前に必ずリセットするにゃ
  //
  // なぜリセットが必要か：
  //   前のテストのモック設定が残っていると、次のテストに影響するにゃ。
  //   例えば「前のテストでエラーを返すように設定したモック」が
  //   次のテストでも使われてしまうにゃ。
  //   vi.clearAllMocks() でモックの呼び出し履歴と設定をリセットするにゃ。
  // ============================================================
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================
  // 1. ローディング状態のテストにゃ
  // ============================================================
  describe("ローディング状態", () => {
    it("初期表示でローディングメッセージが表示される", () => {
      // なぜ永遠に解決しない Promise を使うか：
      //   fetchTodos() が完了しない状態をシミュレートするにゃ。
      //   これにより isLoading が true のままになるにゃ。
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue(new Promise(() => {})), // 永遠に解決しないにゃ
        }),
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      });

      renderWithProvider();

      // render は同期的なので、async の fetch が完了する前の状態を確認できるにゃ
      expect(screen.getByText("読み込み中にゃ…")).toBeInTheDocument();
    });
  });

  // ============================================================
  // 2. Todo一覧表示のテストにゃ
  // ============================================================
  describe("Todo一覧表示", () => {
    it("フェッチ完了後にTodoタイトルが表示される", async () => {
      setupFetchMock(sampleTodos);
      renderWithProvider();

      // なぜ waitFor を使うか：
      //   fetchTodos() は非同期（async/await）で実行されるにゃ。
      //   render 直後はまだ fetch が終わっていないにゃ。
      //   waitFor はその条件が満たされるまで待ってくれるにゃ。
      await waitFor(() => {
        expect(screen.getByText("テストタスク1")).toBeInTheDocument();
        expect(screen.getByText("テストタスク2")).toBeInTheDocument();
      });
    });

    it("Todoが0件のとき空の状態メッセージが表示される", async () => {
      setupFetchMock([]);
      renderWithProvider();

      await waitFor(() => {
        expect(
          screen.getByText(/タスクがありませんにゃ/)
        ).toBeInTheDocument();
      });
    });

    it("フッターに未完了数と合計数が表示される", async () => {
      // sampleTodos は未完了1件・完了1件 → 未完了: 1 / 全体: 2
      setupFetchMock(sampleTodos);
      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByText(/未完了: 1/)).toBeInTheDocument();
        expect(screen.getByText(/全体: 2/)).toBeInTheDocument();
      });
    });

    it("日付が「登録:」というラベル付きで表示される", async () => {
      setupFetchMock([sampleTodos[0]]);
      renderWithProvider();

      await waitFor(() => {
        // formatDate 関数の出力を直接テストするのではなく、
        // 「登録:」ラベルが含まれていることで日付表示を確認するにゃ。
        // 理由：toLocaleString のフォーマットは環境によって異なる場合があるにゃ。
        expect(screen.getByText(/登録:/)).toBeInTheDocument();
      });
    });
  });

  // ============================================================
  // 3. フィルター機能のテストにゃ
  // ============================================================
  describe("フィルター機能", () => {
    it("デフォルトでは「すべて」フィルターが適用されてTodo全件が表示される", async () => {
      setupFetchMock(sampleTodos);
      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByText("テストタスク1")).toBeInTheDocument();
        expect(screen.getByText("テストタスク2")).toBeInTheDocument();
      });
    });

    it("「未完了」フィルターで未完了のTodoのみ表示される", async () => {
      setupFetchMock(sampleTodos);
      renderWithProvider();

      // フェッチ完了を待つにゃ
      await waitFor(() => {
        expect(screen.getByText("テストタスク1")).toBeInTheDocument();
      });

      // なぜ fireEvent.click を使うか：
      //   フィルターボタンのクリックは同期的な状態更新（dispatch）のみにゃ。
      //   ネットワークは使わないので userEvent の async は不要にゃ。
      fireEvent.click(screen.getByText("未完了"));

      // 未完了(completed: false)のテストタスク1のみ表示されるにゃ
      expect(screen.getByText("テストタスク1")).toBeInTheDocument();
      // 完了済み(completed: true)のテストタスク2は消えるにゃ
      expect(screen.queryByText("テストタスク2")).not.toBeInTheDocument();
    });

    it("「完了済み」フィルターで完了済みのTodoのみ表示される", async () => {
      setupFetchMock(sampleTodos);
      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByText("テストタスク2")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("完了済み"));

      // 完了済み(completed: true)のテストタスク2のみ表示されるにゃ
      expect(screen.queryByText("テストタスク1")).not.toBeInTheDocument();
      expect(screen.getByText("テストタスク2")).toBeInTheDocument();
    });

    it("フィルター切り替え後に「すべて」に戻ると全件表示される", async () => {
      setupFetchMock(sampleTodos);
      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByText("テストタスク1")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("未完了"));
      fireEvent.click(screen.getByText("すべて"));

      // 全件に戻るにゃ
      expect(screen.getByText("テストタスク1")).toBeInTheDocument();
      expect(screen.getByText("テストタスク2")).toBeInTheDocument();
    });
  });

  // ============================================================
  // 4. Todo追加のテストにゃ
  // ============================================================
  describe("Todo追加", () => {
    it("フォーム送信で新しいTodoが追加される", async () => {
      // なぜ userEvent.setup() を使うか：
      //   userEvent v14 では setup() を使ってより正確な
      //   ブラウザのイベントシミュレーション（キー入力の間隔など）を行うにゃ。
      const user = userEvent.setup();
      const newTodo: Todo = {
        id: "3",
        title: "新しいタスク",
        completed: false,
        created_at: "2024-01-03T00:00:00.000Z",
      };

      // 1回目の from() 呼び出し：初期フェッチ
      setupFetchMock([]);
      // 2回目の from() 呼び出し：insert
      setupInsertMock(newTodo);

      renderWithProvider();

      // ローディング完了を待つにゃ
      await waitFor(() => {
        expect(screen.queryByText("読み込み中にゃ…")).not.toBeInTheDocument();
      });

      await user.type(
        screen.getByPlaceholderText("新しいタスクを入力してにゃ"),
        "新しいタスク"
      );
      await user.click(screen.getByRole("button", { name: "追加" }));

      await waitFor(() => {
        expect(screen.getByText("新しいタスク")).toBeInTheDocument();
      });
    });

    it("空文字のままフォーム送信してもTodoが追加されない", async () => {
      const user = userEvent.setup();
      setupFetchMock([]);
      renderWithProvider();

      await waitFor(() => {
        expect(screen.queryByText("読み込み中にゃ…")).not.toBeInTheDocument();
      });

      // 何も入力せずに送信するにゃ
      await user.click(screen.getByRole("button", { name: "追加" }));

      // from() は初期フェッチの1回だけ呼ばれているはずにゃ（insert は呼ばれないにゃ）
      expect(mockFrom).toHaveBeenCalledTimes(1);
    });

    it("フォーム送信後にinputがクリアされる", async () => {
      const user = userEvent.setup();
      const newTodo: Todo = {
        id: "3",
        title: "新しいタスク",
        completed: false,
        created_at: "2024-01-03T00:00:00.000Z",
      };

      setupFetchMock([]);
      setupInsertMock(newTodo);
      renderWithProvider();

      await waitFor(() => {
        expect(screen.queryByText("読み込み中にゃ…")).not.toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText("新しいタスクを入力してにゃ");
      await user.type(input, "新しいタスク");
      await user.click(screen.getByRole("button", { name: "追加" }));

      // なぜ submit 後すぐ input が空になるか：
      //   addTodo() の中で dispatch(SET_INPUT_VALUE, "") は await より前（同期部分）にゃ。
      //   そのため、非同期処理の完了を待たずとも空になっているにゃ。
      await waitFor(() => {
        expect(input).toHaveValue("");
      });
    });

    it("追加に失敗するとエラーメッセージが表示される", async () => {
      const user = userEvent.setup();

      setupFetchMock([]);
      setupInsertMock(null, new Error("DB error"));
      renderWithProvider();

      await waitFor(() => {
        expect(screen.queryByText("読み込み中にゃ…")).not.toBeInTheDocument();
      });

      await user.type(
        screen.getByPlaceholderText("新しいタスクを入力してにゃ"),
        "テスト"
      );
      await user.click(screen.getByRole("button", { name: "追加" }));

      await waitFor(() => {
        expect(screen.getByText(/追加に失敗したにゃ/)).toBeInTheDocument();
      });
    });
  });

  // ============================================================
  // 5. Todo完了切り替えのテスト（楽観的更新）にゃ
  //
  // なぜ楽観的更新のテストが重要か：
  //   楽観的更新は「成功を前提に先に UI を更新する」パターンにゃ。
  //   失敗時に元に戻るロールバック処理も確認する必要があるにゃ。
  // ============================================================
  describe("Todo完了切り替え（楽観的更新）", () => {
    it("チェックボックスクリックで completed クラスが即座に付く", async () => {
      // 最初は未完了のタスク1のみにゃ
      setupFetchMock([sampleTodos[0]]);
      // toggleTodo の update 呼び出しにゃ（成功ケース）
      setupToggleMock();

      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByText("テストタスク1")).toBeInTheDocument();
      });

      // todo-checkbox を取得してクリックするにゃ
      const todoItem = screen.getByText("テストタスク1").closest("li")!;
      const checkbox = todoItem.querySelector(".todo-checkbox")!;
      fireEvent.click(checkbox);

      // 楽観的更新により、DBのレスポンスを待たずに completed クラスが付くにゃ
      await waitFor(() => {
        expect(todoItem).toHaveClass("completed");
      });
    });

    it("更新に失敗するとエラーが表示されて元の状態に戻る", async () => {
      setupFetchMock([sampleTodos[0]]);
      setupToggleMock(new Error("Update failed"));

      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByText("テストタスク1")).toBeInTheDocument();
      });

      const todoItem = screen.getByText("テストタスク1").closest("li")!;
      const checkbox = todoItem.querySelector(".todo-checkbox")!;
      fireEvent.click(checkbox);

      // 失敗するので最終的にはエラーメッセージが出て、completedクラスが消えるにゃ
      await waitFor(() => {
        expect(screen.getByText(/更新に失敗したにゃ/)).toBeInTheDocument();
        expect(todoItem).not.toHaveClass("completed");
      });
    });
  });

  // ============================================================
  // 6. Todo削除のテスト（楽観的更新）にゃ
  // ============================================================
  describe("Todo削除（楽観的更新）", () => {
    it("削除ボタンクリックでTodoがリストから即座に消える", async () => {
      setupFetchMock([sampleTodos[0]]);
      setupDeleteMock(); // エラーなし（成功ケース）

      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByText("テストタスク1")).toBeInTheDocument();
      });

      // なぜ title="削除" で取得するか：
      //   削除ボタンのラベルは「✕」（特殊文字）なのでテキストで取得しにくいにゃ。
      //   title 属性を使えば getByTitle で確実に取得できるにゃ。
      fireEvent.click(screen.getByTitle("削除"));

      await waitFor(() => {
        expect(screen.queryByText("テストタスク1")).not.toBeInTheDocument();
      });
    });

    it("削除に失敗するとエラーが表示されてTodoが復元される", async () => {
      // 1回目の from() 呼び出し：初期フェッチ
      setupFetchMock([sampleTodos[0]]);
      // 2回目の from() 呼び出し：delete（失敗にゃ）
      setupDeleteMock(new Error("Delete failed"));
      // 3回目の from() 呼び出し：失敗後の再フェッチ（復元にゃ）
      setupFetchMock([sampleTodos[0]]);

      renderWithProvider();

      await waitFor(() => {
        expect(screen.getByText("テストタスク1")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTitle("削除"));

      // 最終的にはエラーメッセージが出て、削除失敗なので再フェッチで復元されるにゃ
      await waitFor(() => {
        expect(screen.getByText(/削除に失敗したにゃ/)).toBeInTheDocument();
        expect(screen.getByText("テストタスク1")).toBeInTheDocument();
      });
    });
  });

  // ============================================================
  // 7. エラー表示のテストにゃ
  // ============================================================
  describe("エラー表示", () => {
    it("初期フェッチに失敗するとエラーメッセージが表示される", async () => {
      setupFetchMock([], new Error("Network error"));
      renderWithProvider();

      await waitFor(() => {
        expect(
          screen.getByText(/データの取得に失敗したにゃ/)
        ).toBeInTheDocument();
      });
    });

    it("エラーメッセージをクリックすると非表示になる", async () => {
      setupFetchMock([], new Error("Network error"));
      renderWithProvider();

      await waitFor(() => {
        expect(
          screen.getByText(/データの取得に失敗したにゃ/)
        ).toBeInTheDocument();
      });

      // なぜクリックでエラーが消えるか：
      //   コンポーネントの onClick={clearError} により
      //   クリックすると dispatch(SET_ERROR, null) が実行されるにゃ。
      fireEvent.click(screen.getByText(/データの取得に失敗したにゃ/));

      expect(
        screen.queryByText(/データの取得に失敗したにゃ/)
      ).not.toBeInTheDocument();
    });
  });
});
