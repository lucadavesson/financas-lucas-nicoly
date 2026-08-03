import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Toaster } from 'sonner'

export const metadata: Metadata = {
  title: 'Finanças L&N',
  description: 'Sistema financeiro — Lucas & Nicoly',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Finanças L&N' },
}

export const viewport: Viewport = {
  width: 'device-width', initialScale: 1, maximumScale: 1,
  userScalable: false, viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#F5F5F7" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body>
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  )
}
