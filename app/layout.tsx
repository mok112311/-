import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "行间｜中文文章预览器",
  description: "粘贴文章，即时检查中文排版、行宽与阅读节奏。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
