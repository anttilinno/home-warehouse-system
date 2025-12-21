import { Inter as FontSans } from "next/font/google"

import "@/styles/globals.css"
import { siteConfig } from "@/config/site"
import { absoluteUrl, cn } from "@/lib/utils"
import { Toaster } from "@/components/ui/toaster"
import { TailwindIndicator } from "@/components/tailwind-indicator"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/lib/auth"
import { ErrorProvider } from "@/components/ui/error-modal"

const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
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
    apple: "/apple-touch-icon.png",
  },
  manifest: `${siteConfig.url}/site.webmanifest`,
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
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
          fontSans.variable
        )}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AuthProvider>
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