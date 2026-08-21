import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Sentiment Reader — Contrarian SPX/NDX market sentiment, one 0–100 score';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

function GaugeMark({ s }) {
  return (
    <svg width={s} height={s} viewBox="0 0 32 32">
      <rect width="32" height="32" rx="8" fill="#0e1626" stroke="#22304a" />
      <path d="M6 21 A10 10 0 0 1 11 12.34" stroke="#26d07c" strokeWidth="3.2" fill="none" strokeLinecap="round" />
      <path d="M11 12.34 A10 10 0 0 1 21 12.34" stroke="#f5b301" strokeWidth="3.2" fill="none" strokeLinecap="round" />
      <path d="M21 12.34 A10 10 0 0 1 26 21" stroke="#f2445c" strokeWidth="3.2" fill="none" strokeLinecap="round" />
      <line x1="16" y1="21" x2="18.2" y2="12.9" stroke="#eaf0f9" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="16" cy="21" r="2.1" fill="#eaf0f9" />
    </svg>
  );
}

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px',
          background: '#070b14',
          backgroundImage:
            'radial-gradient(circle at 50% -10%, rgba(94,155,255,0.22), transparent 60%)',
          color: '#eaf0f9',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <GaugeMark s={68} />
          <div style={{ display: 'flex', flexDirection: 'column', marginLeft: '24px' }}>
            <div style={{ fontSize: '46px', fontWeight: 800, letterSpacing: '-1px' }}>Sentiment Reader</div>
            <div style={{ fontSize: '22px', color: '#8497b3', letterSpacing: '4px', marginTop: '6px' }}>
              CONTRARIAN · SPX / NDX
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: '64px', fontWeight: 800, lineHeight: 1.08, maxWidth: '940px' }}>
            One 0–100 score from 11 contrarian indicators.
          </div>
          <div style={{ fontSize: '30px', color: '#8497b3', marginTop: '20px' }}>
            Low = fear (buy) · High = greed (sell)
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              height: '24px',
              borderRadius: '12px',
              background:
                'linear-gradient(90deg,#26d07c 0%,#8fd14f 27%,#f5b301 50%,#fb7a3c 73%,#f2445c 100%)',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', fontSize: '23px' }}>
            <span style={{ color: '#26d07c' }}>0 · FEAR / BUY</span>
            <span style={{ color: '#f2445c' }}>GREED / SELL · 100</span>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
