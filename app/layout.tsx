import type { Metadata } from "next";
import "./globals.css";

// metadata はサーバーコンポーネントの特権にゃ。
// <title> タグや <meta> タグを型安全に設定できるにゃ。
export const metadata: Metadata = {
  title: "Todo App 3",
  description: "Next.js で作った Todo アプリにゃ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
