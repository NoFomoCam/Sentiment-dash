'use client';

import { useEffect, useRef, useState } from 'react';

// Defers mounting heavy sections (and their data fetches) until they're near the
// viewport, so the dashboard's first paint isn't blocked by every chart at once.
export default function LazySection({ children, minHeight = 320 }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (shown) return;
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: '500px 0px' }, // mount a little before it scrolls into view
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown]);

  return (
    <div ref={ref}>
      {shown ? (
        <div className="animate-fade-up">{children}</div>
      ) : (
        <div
          style={{ minHeight }}
          className="animate-pulse rounded-2xl border border-dashboard-border bg-dashboard-card/40"
          aria-hidden="true"
        />
      )}
    </div>
  );
}
