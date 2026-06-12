import './globals.css';

export const metadata = {
  title: 'Market Sentiment Console',
  description: 'Contrarian market sentiment dashboard for SPX/NDX traders',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
