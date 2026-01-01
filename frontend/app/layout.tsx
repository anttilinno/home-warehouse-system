import { Inter as FontSans, VT323, Space_Mono, Press_Start_2P } from "next/font/google"

import "@/styles/globals.css"
import { siteConfig } from "@/config/site"
import { absoluteUrl, cn } from "@/lib/utils"
import { Toaster } from "@/components/ui/toaster"
import { TailwindIndicator } from "@/components/tailwind-indicator"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/lib/auth"
import { ErrorProvider } from "@/components/ui/error-modal"
import { ThemeSync } from "@/components/theme-sync"

const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
})

const fontPixel = VT323({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-pixel",
})

const fontMono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-mono-retro",
})

const fontNes = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-nes",
})

interface RootLayoutProps {
  children: React.ReactNode
}

export const metadata = {
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords: [
    "Next.js",
    "React",
    "Tailwind CSS",
    "Server Components",
    "Radix UI",
    "Warehouse",
    "Inventory",
    "Management",
  ],
  authors: [
    {
      name: "HMS Team",
      url: siteConfig.url,
    },
  ],
  creator: "HMS Team",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteConfig.url,
    title: siteConfig.name,
    description: siteConfig.description,
    siteName: siteConfig.name,
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.description,
    images: [`${siteConfig.url}/og.jpg`],
    creator: "@example",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/icons/icon-192x192.svg",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: siteConfig.name,
  },
  formatDetection: {
    telephone: false,
  },
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#0f172a" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
        <style dangerouslySetInnerHTML={{
          __html: `
            /* Hide Next.js dev portal elements that interfere with UI */
            nextjs-portal,
            [data-nextjs-portal],
            nextjs-portal *,
            [data-nextjs-portal] * {
              display: none !important;
              visibility: hidden !important;
              position: fixed !important;
              top: -9999px !important;
              left: -9999px !important;
              width: 0 !important;
              height: 0 !important;
              z-index: -9999 !important;
              pointer-events: none !important;
              opacity: 0 !important;
              overflow: hidden !important;
            }

            /* Additional specific targeting */
            script + nextjs-portal,
            script ~ nextjs-portal {
              display: none !important;
            }
          `
        }} />
      </head>
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased",
          fontSans.variable,
          fontPixel.variable,
          fontMono.variable,
          fontNes.variable
        )}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          themes={["light", "dark", "retro-light", "retro-dark"]}
        >
          <AuthProvider>
            <ThemeSync />
            <ErrorProvider>
              {children}
              <Toaster />
              <TailwindIndicator />
            </ErrorProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}