import './globals.css';
import React from 'react';

export const metadata = {
  title: 'MSTR Advisor',
  description: 'Daily, free-first advisory for MSTR',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="icon"
          href={`data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' fill='%23111827'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='Arial' font-size='28' fill='%23ffffff'>M</text></svg>`}
        />
      </head>
      <body className="bg-white text-gray-900">
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


