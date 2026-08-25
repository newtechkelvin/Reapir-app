import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '新力維修管理系統',
  description: 'NEW TECH MOTOR ENGINEERING LIMITED - 車輛維修工單與可用率管理系統',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW">
      <body className="antialiased bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  );
}