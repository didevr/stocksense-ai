"use client";

import React from "react";

export default function BullBearGauge({ insights }) {
  const bull = Number(insights?.bullScore || 50);
  const bear = Number(insights?.bearScore || 50);
  const value = (bull - bear) / 100;
  const deg = 90 + Math.max(-1, Math.min(1, value)) * 90;

  return (
    <div className="gauge-wrap">
      <div className="gauge">
        <div className="needle" style={{ transform: `rotate(${deg}deg)` }} />
      </div>
      <div className="gauge-stats">
        <p>
          Bullish <strong>{bull.toFixed(0)}</strong>
        </p>
        <p>
          Bearish <strong>{bear.toFixed(0)}</strong>
        </p>
        <p>
          Confidence <strong>{insights?.confidence || "Low"}</strong>
        </p>
      </div>
      <ul className="driver-list">
        {(insights?.drivers || []).slice(0, 3).map((driver) => (
          <li key={driver}>{driver}</li>
        ))}
      </ul>
    </div>
  );
}
