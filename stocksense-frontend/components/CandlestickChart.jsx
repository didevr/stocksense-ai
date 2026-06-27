"use client";

import React from "react";

export default function CandlestickChart({ candles = [], indicators = {} }) {
  if (!candles.length) return <div className="chart-empty">No chart data available.</div>;

  const height = 340;
  const volumeHeight = 90;
  const width = 880;
  const allPrices = candles.flatMap((c) => [c.low, c.high]);
  const min = Math.min(...allPrices);
  const max = Math.max(...allPrices);
  const range = Math.max(1, max - min);
  const bodyW = Math.max(2, Math.floor(width / candles.length) - 2);

  const y = (price) => ((max - price) / range) * height;
  const x = (idx) => (idx + 0.5) * (width / candles.length);

  const maxVol = Math.max(...candles.map((c) => c.volume || 0), 1);

  return (
    <div className="chart-wrap">
      <svg className="price-chart" viewBox={`0 0 ${width} ${height + volumeHeight + 20}`} preserveAspectRatio="none">
        <g>
          {candles.map((candle, idx) => {
            const rising = candle.close >= candle.open;
            const cx = x(idx);
            const openY = y(candle.open);
            const closeY = y(candle.close);
            const highY = y(candle.high);
            const lowY = y(candle.low);
            const top = Math.min(openY, closeY);
            const bodyH = Math.max(1.2, Math.abs(closeY - openY));

            return (
              <g key={`${candle.date}-${idx}`}>
                <line x1={cx} x2={cx} y1={highY} y2={lowY} className={rising ? "wick-up" : "wick-down"} />
                <rect
                  x={cx - bodyW / 2}
                  y={top}
                  width={bodyW}
                  height={bodyH}
                  className={rising ? "candle-up" : "candle-down"}
                />
              </g>
            );
          })}
        </g>

        {Array.isArray(indicators?.sma20) && (
          <polyline
            className="line-sma"
            fill="none"
            points={indicators.sma20
              .map((value, idx) => (value == null ? null : `${x(idx)},${y(value)}`))
              .filter(Boolean)
              .join(" ")}
          />
        )}

        {Array.isArray(indicators?.ema20) && (
          <polyline
            className="line-ema"
            fill="none"
            points={indicators.ema20
              .map((value, idx) => (value == null ? null : `${x(idx)},${y(value)}`))
              .filter(Boolean)
              .join(" ")}
          />
        )}

        <g transform={`translate(0, ${height + 10})`}>
          {candles.map((candle, idx) => {
            const w = Math.max(1.5, width / candles.length - 1.5);
            const h = ((candle.volume || 0) / maxVol) * (volumeHeight - 4);
            return (
              <rect
                key={`vol-${candle.date}-${idx}`}
                x={idx * (width / candles.length)}
                y={volumeHeight - h}
                width={w}
                height={h}
                className={candle.close >= candle.open ? "vol-up" : "vol-down"}
              />
            );
          })}
        </g>
      </svg>
      <div className="chart-meta">
        <span>SMA 20</span>
        <span>EMA 20</span>
        <span>Volume</span>
      </div>
    </div>
  );
}
