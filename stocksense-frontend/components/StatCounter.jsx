"use client";

import React, { useEffect, useState } from "react";

export default function StatCounter({ label, value, suffix = "" }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let frame;
    let start;
    function tick(ts) {
      if (!start) start = ts;
      const progress = Math.min(1, (ts - start) / 900);
      setDisplay(Math.round(value * progress));
      if (progress < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return (
    <div className="counter-card">
      <strong>
        {display}
        {suffix}
      </strong>
      <span>{label}</span>
    </div>
  );
}
