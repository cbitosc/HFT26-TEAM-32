import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PROCTOR-FORGE | Adaptive Coding Assessment Platform',
  description: 'Portfolio-driven adaptive technical evaluation platform with isolated sandboxes, deterministic grading, and guarded AI assistance.'
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-slate-100 min-h-screen antialiased selection:bg-blue-600 selection:text-white">
        {children}
      </body>
    </html>
  );
}

