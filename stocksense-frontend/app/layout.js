import "./globals.css";

export const metadata = {
  title: "StockSense AI - Institutional Market Intelligence",
  description:
    "Premium AI-powered stock research, market dashboard, visual news intelligence, and personalized market briefing.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

