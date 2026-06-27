"use client";

import React from "react";

export default function ChatBubble({ role, content }) {
  return (
    <div className={`bubble-row ${role}`}>
      <div className="avatar">{role === "user" ? "U" : "AI"}</div>
      <div className="bubble">{content}</div>
    </div>
  );
}
