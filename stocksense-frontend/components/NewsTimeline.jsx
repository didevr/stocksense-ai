"use client";

import React from "react";

function timeAgo(iso) {
  if (!iso) return "just now";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.max(1, Math.floor(diff / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NewsTimeline({ items = [] }) {
  return (
    <div className="timeline">
      {items.map((item) => (
        <div className="timeline-row" key={`${item.symbol}-${item.order}`}>
          <span className="time">{timeAgo(item.time)}</span>
          <span className={`pulse ${item.score >= 0 ? "up" : "down"}`} />
          <div>
            <p>{item.headline}</p>
            <small>{item.symbol}</small>
          </div>
        </div>
      ))}
    </div>
  );
}
