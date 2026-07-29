import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from '@/components/ui/toast'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'zaTTo — Suporte & Inventário',
  description: 'Plataforma enxuta de ITSM com tickets e inventário de ativos.',
}

// Runs before paint so a stored light theme never flashes the dark palette.
const themeScript = `try{if(localStorage.getItem('zatto:theme')==='light')document.documentElement.classList.add('light')}catch(e){}`

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={inter.className}>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
