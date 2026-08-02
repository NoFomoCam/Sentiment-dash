import './globals.css';

export const metadata = {
  metadataBase: new URL('https://sentimentreader.vercel.app'),
  title: {
    default: 'Market Sentiment Console',
    template: '%s · Market Sentiment Console',
  },
  description:
    'A contrarian market-sentiment gauge for SPX/NDX — 11 indicators scored 0–100 (fear → greed), auto-updated each weekday after the U.S. close.',
  applicationName: 'Market Sentiment Console',
  openGraph: {
    title: 'Market Sentiment Console',
    description:
      'Contrarian SPX/NDX sentiment — 11 indicators, one 0–100 score. Low = fear/buy, high = greed/sell.',
    url: '/',
    siteName: 'Market Sentiment Console',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Market Sentiment Console',
    description: 'Contrarian SPX/NDX sentiment — one 0–100 score. Low = fear/buy, high = greed/sell.',
  },
};

export const viewport = {
  themeColor: '#0a0f1a',
  colorScheme: 'dark',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
