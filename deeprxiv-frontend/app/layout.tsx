'use client';

import './globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <title>DeepRxiv - AI-Powered Research Explorer</title>
        <meta name="description" content="AI-powered tool for exploring and understanding arXiv research papers" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="min-h-screen bg-white">
        {children}
      </body>
    </html>
  );
}
