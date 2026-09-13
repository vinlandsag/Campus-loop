import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import { Toaster } from 'sonner'
import { APP_DESCRIPTION, APP_NAME, APP_URL } from '@/lib/constants'
import './globals.css'
import { cn } from "@/lib/utils";

const geist = localFont({
  src: './fonts/geist.woff2',
  variable: '--font-sans',
  display: 'swap',
  fallback: ['ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
})

const inter = localFont({
  src: './fonts/inter.woff2',
  variable: '--font-inter',
  display: 'swap',
  fallback: ['ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
})

const plusJakartaSans = localFont({
  src: './fonts/plus-jakarta-sans.woff2',
  variable: '--font-plus-jakarta',
  display: 'swap',
  weight: '600 800',
  fallback: ['ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
})

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: APP_NAME,
    template: `%s — ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  keywords: ['campus events', 'college events', 'student events', 'event registration'],
  authors: [{ name: APP_NAME }],
  openGraph: {
    type: 'website',
    siteName: APP_NAME,
    title: APP_NAME,
    description: APP_DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: APP_NAME,
    description: APP_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#faf9f7',
}

interface RootLayoutProps {
  children: React.ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html
      lang="en"
      className={cn("h-full", inter.variable, plusJakartaSans.variable, "font-sans", geist.variable)}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col antialiased">
        {/* Skip to content link for keyboard users */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-md focus:outline-none"
        >
          Skip to main content
        </a>

        {children}

        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              fontFamily: 'var(--font-inter)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--bg-surface)',
              color: 'var(--text-primary)',
            },
          }}
        />
      </body>
    </html>
  )
}
