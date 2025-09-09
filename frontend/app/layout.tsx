import './globals.css';
import React from 'react';

export const metadata = {
  title: 'MSTR Advisor',
  description: 'Daily, free-first advisory for MSTR',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100">
        <div className="mx-auto max-w-5xl p-4 md:p-6">
          <header className="mb-6">
            <h1 className="text-2xl font-semibold">MSTR Advisor</h1>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}


