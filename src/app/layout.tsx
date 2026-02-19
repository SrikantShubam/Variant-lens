import type { Metadata } from 'next'
import { Inter, Space_Grotesk, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { clsx } from 'clsx'

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://variantlens.open'),
  title: {
    default: 'VariantLens-Open',
    template: '%s | VariantLens-Open',
  },
  description: 'Structure-aware evidence briefing for genetic variant research.',
  keywords: [
    'genetic variants',
    'bioinformatics',
    'structural biology',
    'variant evidence',
    'PDB',
    'AlphaFold',
    'UniProt',
    'ClinVar',
  ],
  openGraph: {
    title: 'VariantLens-Open',
    description: 'Structure-aware evidence briefing for genetic variant research.',
    url: 'https://variantlens.open',
    siteName: 'VariantLens-Open',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VariantLens-Open',
    description: 'Structure-aware evidence briefing for genetic variant research.',
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: '/',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={clsx(inter.variable, spaceGrotesk.variable, jetbrainsMono.variable)}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
