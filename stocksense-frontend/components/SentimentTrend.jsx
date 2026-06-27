"use client";

import React from "react";

export default function SentimentTrend({ values = [] }) {
  if (!values.length) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const points = values
    .map((v, idx) => `${(idx / (values.length - 1)) * 100},${100 - ((v - min) / span) * 100}`)
    .join(" ");

  return (
    <div className="trend-wrap">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Sentiment trend">
        <polyline points={points} fill="none" stroke="var(--brand-2)" strokeWidth="2.5" />
      </svg>
    </div>
  );
}
