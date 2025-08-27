// src/app/layout.tsx
import './globals.css'
import type { ReactNode } from 'react'

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
  <link
    rel="preconnect"
    href={new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin}
    crossOrigin=""
  />
</head>

      <body className="min-h-dvh bg-zinc-50 text-zinc-900">
        {children}
      </body>
    </html>
  )
}