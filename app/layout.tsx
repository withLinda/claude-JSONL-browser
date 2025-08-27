import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/react'
import './globals.css'

export const metadata: Metadata = {
  title: 'JSONL Browser | Linda\'s Dev Tools',
  description: 'Convert JSONL files to Markdown with multi-file support, search, and Everforest theme',
  keywords: 'JSONL, Markdown, converter, browser, developer tools',
  authors: [{ name: 'Linda' }],
  openGraph: {
    title: 'JSONL Browser',
    description: 'Convert JSONL files to Markdown with ease',
    url: 'https://jsonlbrowser.withlinda.dev',
    siteName: 'JSONL Browser',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-everforest-bg0 text-everforest-fg antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  )
}