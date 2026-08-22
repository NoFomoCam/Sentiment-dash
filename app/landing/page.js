import LandingClient from '../../Components/LandingClient';

export const metadata = {
  title: 'Sentiment Reader — Contrarian market sentiment for SPX / NDX',
  description: 'One contrarian 0–100 score for SPX & NDX from eleven fear-and-greed signals, backed by decades of data and updated every close. See when the crowd is too scared to sell and too greedy to buy.',
};

export default function LandingPage() {
  return <LandingClient />;
}
