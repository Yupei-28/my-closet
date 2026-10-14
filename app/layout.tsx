import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "我的衣橱",
  description: "手机优先的个人数字衣橱与穿搭灵感库。",
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
      <body className="antialiased">{children}</body>
    </html>
  );
}
