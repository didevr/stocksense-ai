"use client";

import React from "react";

export default function MiniBars({ values = [] }) {
  if (!values.length) return null;
  const max = Math.max(...values.map((v) => Math.abs(v)), 1);
  return (
    <div className="mini-bars" aria-hidden>
      {values.map((value, idx) => (
        <span
          key={`${value}-${idx}`}
          className={`bar ${value >= 0 ? "up" : "down"}`}
          style={{ height: `${14 + (Math.abs(value) / max) * 36}px` }}
        />
      ))}
    </div>
  );
}
