"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MiniBars from "@/components/MiniBars";
import BullBearGauge from "@/components/BullBearGauge";
import NewsTimeline from "@/components/NewsTimeline";
import StatCounter from "@/components/StatCounter";
import ChatBubble from "@/components/ChatBubble";
import SentimentTrend from "@/components/SentimentTrend";
import CandlestickChart from "@/components/CandlestickChart";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function pctClass(change) {
  if (change > 0) return "up";
  if (change < 0) return "down";
  return "flat";
}

function prettyPct(change = 0) {
  return `${change > 0 ? "+" : ""}${change.toFixed(2)}%`;
}

function timeAgo(iso) {
  if (!iso) return "just now";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.max(1, Math.floor(diff / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const SYMBOL_ALIASES = [
  { pattern: /\breliance(?: industries)?\b/i, symbol: "RELIANCE" },
  { pattern: /\bhdfc(?: bank)?\b/i, symbol: "HDFCBANK" },
  { pattern: /\bicici(?: bank)?\b/i, symbol: "ICICIBANK" },
  { pattern: /\btata consultancy services\b/i, symbol: "TCS" },
  { pattern: /\binfosys\b/i, symbol: "INFY" },
  { pattern: /\bzomato\b/i, symbol: "ETERNAL" },
  { pattern: /\bbajaj finance\b/i, symbol: "BAJFINANCE" },
  { pattern: /\b(state bank of india|sbi)\b/i, symbol: "SBIN" },
  { pattern: /\baxis bank\b/i, symbol: "AXISBANK" },
  { pattern: /\bkotak mahindra(?: bank)?\b/i, symbol: "KOTAKBANK" },
  { pattern: /\bbharti airtel\b/i, symbol: "BHARTIARTL" },
  { pattern: /\blarsen (?:and|&) toubro\b/i, symbol: "LT" },
  { pattern: /\bmaruti suzuki\b/i, symbol: "MARUTI" },
  { pattern: /\bapple\b/i, symbol: "AAPL" },
  { pattern: /\bmicrosoft\b/i, symbol: "MSFT" },
  { pattern: /\b(?:google|alphabet)\b/i, symbol: "GOOGL" },
  { pattern: /\bamazon\b/i, symbol: "AMZN" },
  { pattern: /\btesla\b/i, symbol: "TSLA" },
  { pattern: /\b(?:meta|facebook)\b/i, symbol: "META" },
  { pattern: /\bnetflix\b/i, symbol: "NFLX" },
  { pattern: /\bnvidia\b/i, symbol: "NVDA" },
  { pattern: /\b(?:berkshire hathaway|brk[- ]?b)\b/i, symbol: "BRK-B" },
  { pattern: /\bjpmorgan(?: chase)?\b/i, symbol: "JPM" },
  { pattern: /\bwalmart\b/i, symbol: "WMT" },
  { pattern: /\bdisney\b/i, symbol: "DIS" },
  { pattern: /\bcoca[- ]cola\b/i, symbol: "KO" },
];

const SYMBOL_SKIP = new Set([
  "AI",
  "NSE",
  "BSE",
  "IPO",
  "PE",
  "ROE",
  "EPS",
  "TTM",
  "YOY",
  "QOQ",
  "THE",
  "AND",
  "FOR",
  "ARE",
  "DID",
  "WHY",
  "HOW",
  "WHAT",
  "WHEN",
  "WHO",
  "IS",
  "IN",
  "OF",
  "TO",
  "A",
  "AN",
  "IT",
  "ITS",
  "VS",
  "OR",
  "US",
  "UK",
]);

function resolveSymbolFromMessage(message) {
  const text = message || "";
  for (const alias of SYMBOL_ALIASES) {
    if (alias.pattern.test(text)) {
      return alias.symbol;
    }
  }

  const direct = text.match(/\b([A-Z]{2,5})\b/);
  if (direct) {
    const symbol = direct[1].toUpperCase();
    if (!SYMBOL_SKIP.has(symbol)) {
      return symbol;
    }
  }

  return null;
}

const PERIODS = [
  { id: "1d", label: "1D" },
  { id: "5d", label: "1W" },
  { id: "1mo", label: "1M" },
  { id: "3mo", label: "3M" },
  { id: "6mo", label: "6M" },
  { id: "1y", label: "1Y" },
  { id: "5y", label: "5Y" },
];

export default function Home() {
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return "dark";
    return window.localStorage.getItem("stocksense_theme") || "dark";
  });
  const [profile, setProfile] = useState({ name: "Trader", email: "", plan: "Free" });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [authMode, setAuthMode] = useState("login");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [showPricing, setShowPricing] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [chatCount, setChatCount] = useState(0);

  const [briefing, setBriefing] = useState(null);
  const [newsDash, setNewsDash] = useState(null);
  const [questionPack, setQuestionPack] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [stockData, setStockData] = useState(null);
  const [history, setHistory] = useState([]);
  const [indicators, setIndicators] = useState({});
  const [insights, setInsights] = useState(null);
  const [activeSymbol, setActiveSymbol] = useState("RELIANCE");
  const [symbolInput, setSymbolInput] = useState("RELIANCE");
  const [followUps, setFollowUps] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState("6mo");
  const [leftWidth, setLeftWidth] = useState(27);
  const [rightWidth, setRightWidth] = useState(28);
  const [dragging, setDragging] = useState(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [earningsStatus, setEarningsStatus] = useState({ loaded: false, quarters: [] });
  const [uploading, setUploading] = useState(false);
  const [uploadQuarter, setUploadQuarter] = useState("Q4FY25");

  const chatBottomRef = useRef(null);
  const symbolInputRef = useRef(null);
  const chatInputRef = useRef(null);
  const idCounterRef = useRef(0);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("stocksense_theme", theme);
  }, [theme]);

  useEffect(() => {
    fetch("/api/user/profile")
      .then((res) => {
        if (!res.ok) throw new Error("Unauthenticated");
        return res.json();
      })
      .then((data) => {
        if (data?.ok && data?.user) {
          setProfile(data.user);
          setIsAuthenticated(true);
          if (!data.user.plan) {
            setShowPricing(true);
          }
        } else {
          setIsAuthenticated(false);
        }
      })
      .catch(() => {
        setIsAuthenticated(false);
      })
      .finally(() => {
        setAuthChecking(false);
      });
  }, []);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    try {
      const res = await fetch(`/api/auth?mode=${authMode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: authMode === "signup" ? authName : undefined,
          email: authEmail,
          password: authPassword,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        if (authMode === "signup" && data.sessionCreated === false) {
          setAuthError(data.message || "Registration successful! Please verify your email before logging in.");
          setAuthPassword("");
          setAuthName("");
          setAuthMode("login");
          return;
        }
        const profileRes = await fetch("/api/user/profile");
        const profileData = await profileRes.json();
        if (profileRes.ok && profileData?.ok && profileData?.user) {
          setProfile(profileData.user);
          setAuthEmail("");
          setAuthPassword("");
          setAuthName("");
          setChatCount(0); // reset count on new login
          
          if (authMode === "signup") {
            setShowPricing(true);
            setIsAuthenticated(true);
          } else {
            setIsAuthenticated(true);
            if (!profileData.user.plan) {
              setShowPricing(true);
            }
          }
        } else {
          setAuthError("Failed to load user profile after login.");
        }
      } else {
        setAuthError(data.detail || `${authMode === "signup" ? "Signup" : "Login"} failed.`);
      }
    } catch (err) {
      setAuthError("Network connection error. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSelectPlan = async (selectedPlan) => {
    try {
      const res = await fetch("/api/user/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: selectedPlan }),
      });
      const data = await res.json();
      if (res.ok && data?.ok) {
        setProfile((prev) => ({ ...prev, plan: data.plan }));
        setShowPricing(false);
        setIsAuthenticated(true);
      } else {
        alert(data.detail || "Failed to assign plan.");
      }
    } catch (err) {
      alert("Network error assigning plan.");
    }
  };

  const handleLogout = async () => {
    try {
      const res = await fetch("/api/auth?mode=logout", { method: "POST" });
      if (res.ok) {
        setIsAuthenticated(false);
        setShowPricing(false);
        setProfile({ name: "Trader", email: "", plan: "Free" });
      }
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const loadDashboard = useCallback(async () => {
    if (!isAuthenticated) return;
    const encoded = encodeURIComponent(profile.name);

    const [briefingRes, newsRes, questionsRes] = await Promise.all([
      fetch(`/api/market/briefing?user=${encoded}`),
      fetch(`/api/market/news?symbols=RELIANCE,TCS,INFY,HDFCBANK,ICICIBANK,SBIN`),
      fetch(`/api/market/questions?user=${encoded}`),
    ]);

    const [briefingJson, newsJson, questionsJson] = await Promise.all([
      briefingRes.json(),
      newsRes.json(),
      questionsRes.json(),
    ]);

    if (briefingJson?.ok) setBriefing(briefingJson.data);
    if (newsJson?.ok) setNewsDash(newsJson.data);
    if (questionsJson?.ok) setQuestionPack(questionsJson.data);
  }, [profile.name, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const timer = setTimeout(() => {
      loadDashboard().catch(() => {});
    }, 0);
    return () => clearTimeout(timer);
  }, [loadDashboard, isAuthenticated]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const timer = setInterval(() => {
      loadDashboard().catch(() => {});
    }, 300000);
    return () => clearInterval(timer);
  }, [loadDashboard, isAuthenticated]);

  const loadStock = useCallback(async (symbol, period = selectedPeriod) => {
    if (!isAuthenticated) return;
    const clean = (symbol || "").trim().toUpperCase();
    if (!clean) return;

    setActiveSymbol(clean);
    setSymbolInput(clean);

    try {
      const [quoteRes, histRes, insightRes, statusRes] = await Promise.all([
        fetch(`${API}/stocks/${clean}`),
        fetch(`${API}/stocks/${clean}/history?period=${period}`),
        fetch(`${API}/stocks/${clean}/insights`),
        fetch(`${API}/stocks/${clean}/earnings/status`),
      ]);

      if (quoteRes.ok) {
        const quote = await quoteRes.json();
        setStockData(quote.data);
      }

      if (histRes.ok) {
        const hist = await histRes.json();
        setHistory(Array.isArray(hist.candles) ? hist.candles : []);
        setIndicators(hist.indicators || {});
      }

      if (insightRes.ok) {
        const insight = await insightRes.json();
        setInsights(insight);
      }

      if (statusRes.ok) {
        const statusJson = await statusRes.json();
        setEarningsStatus(statusJson);
      } else {
        setEarningsStatus({ loaded: false, quarters: [] });
      }
    } catch {
      setStockData(null);
      setHistory([]);
      setIndicators({});
      setInsights(null);
      setEarningsStatus({ loaded: false, quarters: [] });
    }
  }, [selectedPeriod, isAuthenticated]);

  async function uploadTranscript(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("quarter", uploadQuarter);
    formData.append("file", file);

    try {
      const res = await fetch(`${API}/stocks/${activeSymbol}/earnings`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || "Transcript uploaded successfully!");
        const statusRes = await fetch(`${API}/stocks/${activeSymbol}/earnings/status`);
        if (statusRes.ok) {
          const statusJson = await statusRes.json();
          setEarningsStatus(statusJson);
        }
      } else {
        alert(`Error: ${data.detail || "Failed to upload transcript"}`);
      }
    } catch (e) {
      alert(`Error: ${e.message || "Network error"}`);
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  useEffect(() => {
    if (!isAuthenticated) return;
    const timer = setTimeout(() => {
      loadStock(activeSymbol, selectedPeriod);
    }, 0);
    return () => clearTimeout(timer);
  }, [activeSymbol, selectedPeriod, loadStock, isAuthenticated]);

  useEffect(() => {
    function onKeydown(event) {
      if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey) {
        const isTyping = ["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName);
        if (!isTyping) {
          event.preventDefault();
          symbolInputRef.current?.focus();
        }
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((prev) => !prev);
        symbolInputRef.current?.focus();
      }

      if (event.ctrlKey && event.key === "Enter") {
        event.preventDefault();
        if (document.activeElement === chatInputRef.current) {
          sendMessage();
        }
      }

      if (event.altKey && event.key === "1") window.location.hash = "#dashboard";
      if (event.altKey && event.key === "2") window.location.hash = "#news";
      if (event.altKey && event.key === "3") window.location.hash = "#workspace";
      if (event.altKey && event.key === "4") window.location.hash = "#social";

      if (event.key === "Escape") {
        setPaletteOpen(false);
      }
    }

    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  });

  useEffect(() => {
    function onMove(event) {
      if (!dragging) return;
      const vw = window.innerWidth;
      if (dragging === "left") {
        const next = Math.min(42, Math.max(18, (event.clientX / vw) * 100));
        setLeftWidth(next);
      } else if (dragging === "right") {
        const fromRight = ((vw - event.clientX) / vw) * 100;
        const next = Math.min(42, Math.max(18, fromRight));
        setRightWidth(next);
      }
    }

    function onUp() {
      setDragging(null);
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging]);

  async function sendMessage(prefill) {
    const question = (prefill || input).trim();
    if (!question || loading) return;

    const activePlan = profile.plan || "Free";
    if (activePlan === "Free" && chatCount >= 10) {
      alert("🔒 Free Plan Limit Reached: You have reached the limit of 10 queries per day. Upgrade to Pro or Analyst for more workspace capacity.");
      setShowPricing(true);
      return;
    }
    if (activePlan === "Pro" && chatCount >= 100) {
      alert("🔒 Pro Plan Limit Reached: You have reached the limit of 100 queries per day. Upgrade to Analyst for unlimited capacity.");
      setShowPricing(true);
      return;
    }

    const resolvedSymbol = resolveSymbolFromMessage(question);
    if (resolvedSymbol && resolvedSymbol !== activeSymbol) {
      setSymbolInput(resolvedSymbol);
      setActiveSymbol(resolvedSymbol);
    }

    idCounterRef.current += 1;
    const aiId = `ai-${idCounterRef.current}`;
    const userId = `u-${idCounterRef.current + 1}`;
    setLoading(true);
    setMessages((prev) => [...prev, { id: userId, role: "user", content: question }, { id: aiId, role: "ai", content: "" }]);
    setInput("");

    try {
      const res = await fetch(`${API}/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: question,
          symbol: resolvedSymbol || activeSymbol,
          user_id: profile.name,
          plan: profile.plan.toLowerCase(),
        }),
      });

      if (!res.body) throw new Error("missing-stream");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((prev) => prev.map((message) => (message.id === aiId ? { ...message, content: message.content + chunk } : message)));
      }

      setFollowUps((questionPack?.questions || []).slice(0, 4));
      setChatCount((prev) => prev + 1);
    } catch {
      setMessages((prev) =>
        prev.map((message) =>
          message.id === aiId
            ? {
                ...message,
                content:
                  "Unable to connect to the market AI service right now. Please make sure backend service is running and try again.",
              }
            : message
        )
      );
    }

    setLoading(false);
  }

  const sortedQuestions = useMemo(() => (questionPack?.questions || []).slice(0, 56), [questionPack]);
  const topBarValues = briefing?.indices?.map((index) => index.change) || [0.4, -0.3, 0.6, 0.2, -0.2, 0.1];

  const workspaceCols = `${leftWidth}fr 10px ${Math.max(30, 100 - leftWidth - rightWidth)}fr 10px ${rightWidth}fr`;

  if (authChecking) {
    return (
      <div className="auth-loading-screen">
        <div className="spinner-glow"></div>
        <div className="loading-logo">
          <span className="dot" />
          <span className="brand-main">StockSense</span>
          <span className="brand-ai">AI</span>
        </div>
        <p className="loading-text">Securing connection...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="auth-overlay" role="dialog" aria-modal="true">
        <div className="auth-card">
          <div className="auth-card-glow"></div>
          <div className="auth-logo">
            <span className="dot" />
            <span className="brand-main">StockSense</span>
            <span className="brand-ai">AI</span>
          </div>
          
          <h2>{authMode === "login" ? "Sign In to Workspace" : "Create Professional Account"}</h2>
          <p className="auth-subtitle">
            {authMode === "login" 
              ? "Enter your credentials to access live market intelligence" 
              : "Get institution-grade context, reasoning, and idea generation"}
          </p>

          {authError && (
            <div className="auth-error-box" role="alert">
              <span className="error-icon">⚠️</span>
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="auth-form">
            {authMode === "signup" && (
              <div className="form-group">
                <label htmlFor="auth-name">Full Name</label>
                <input
                  id="auth-name"
                  type="text"
                  required
                  placeholder="Jane Doe"
                  value={authName}
                  onChange={(e) => setAuthName(e.target.value)}
                />
              </div>
            )}

            <div className="form-group">
              <label htmlFor="auth-email">Email Address</label>
              <input
                id="auth-email"
                type="email"
                required
                placeholder="name@company.com"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="auth-password">Password</label>
              <input
                id="auth-password"
                type="password"
                required
                placeholder="••••••••"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
              />
            </div>

            <button type="submit" className="auth-btn" disabled={authLoading}>
              {authLoading ? (
                <span className="btn-spinner">Processing...</span>
              ) : (
                <span>{authMode === "login" ? "Sign In" : "Create Account"}</span>
              )}
            </button>
          </form>

          <div className="auth-switch">
            {authMode === "login" ? (
              <p>
                New to StockSense AI?{" "}
                <button onClick={() => { setAuthMode("signup"); setAuthError(""); }}>
                  Create an account
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{" "}
                <button onClick={() => { setAuthMode("login"); setAuthError(""); }}>
                  Sign in
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (showPricing && !profile.plan) {
    return (
      <div className="pricing-overlay" role="dialog" aria-modal="true">
        <div className="pricing-container">
          <header className="pricing-header">
            <h2>Select Workspace Plan</h2>
            <p>Choose the level of market intelligence that matches your workflow</p>
          </header>

          <div className="pricing-cards-grid">
            {/* FREE CARD */}
            <div className="pricing-card free-card">
              <div className="plan-header">
                <span className="plan-name">FREE</span>
                <div className="plan-price">
                  <span className="currency">₹</span>
                  <span className="amount">0</span>
                </div>
                <span className="plan-duration">forever</span>
              </div>
              <p className="plan-summary">For investors just getting started with AI research.</p>
              
              <ul className="plan-features">
                <li><span>10 queries per day</span></li>
                <li><span>Live price + basic fundamentals</span></li>
                <li><span>Latest 5 news headlines</span></li>
                <li><span>NSE + BSE coverage</span></li>
              </ul>

              <button onClick={() => handleSelectPlan("Free")} className="plan-btn free-btn">
                Get started →
              </button>
            </div>

            {/* PRO CARD */}
            <div className="pricing-card pro-card">
              <div className="popular-badge">Most popular</div>
              <div className="plan-header">
                <span className="plan-name text-gold">PRO</span>
                <div className="plan-price text-white">
                  <span className="currency">₹</span>
                  <span className="amount">499</span>
                </div>
                <span className="plan-duration">per month</span>
              </div>
              <p className="plan-summary">For active investors who research seriously.</p>

              <ul className="plan-features">
                <li><span>100 queries per day</span></li>
                <li><span>Full fundamentals + ratios</span></li>
                <li><span>Earnings call search (4 quarters)</span></li>
                <li><span>Stock comparison tool</span></li>
                <li><span>News sentiment analysis</span></li>
                <li><span>Chat history saved</span></li>
              </ul>

              <button onClick={() => handleSelectPlan("Pro")} className="plan-btn pro-btn">
                Start Pro →
              </button>
            </div>

            {/* ANALYST CARD */}
            <div className="pricing-card analyst-card">
              <div className="plan-header">
                <span className="plan-name">ANALYST</span>
                <div className="plan-price">
                  <span className="currency">₹</span>
                  <span className="amount">1,999</span>
                </div>
                <span className="plan-duration">per month</span>
              </div>
              <p className="plan-summary">For portfolio managers and professional traders.</p>

              <ul className="plan-features">
                <li><span>Unlimited queries</span></li>
                <li><span>Full earnings call archive</span></li>
                <li><span>Annual report search</span></li>
                <li><span>Bulk stock screening</span></li>
                <li><span>API access</span></li>
                <li><span>Priority support</span></li>
              </ul>

              <button onClick={() => handleSelectPlan("Analyst")} className="plan-btn analyst-btn">
                Start Analyst →
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrap">
      <header className="site-nav">
        <a href="#top" className="brand">
          <span className="dot" />
          <span className="brand-main">StockSense</span>
          <span className="brand-ai">AI</span>
        </a>

        <nav>
          <a href="#dashboard">Dashboard</a>
          <a href="#news">News Intel</a>
          <a href="#workspace">Workspace</a>
          <a href="#social">Social Proof</a>
        </nav>

        <div className="nav-actions">
          <span className="user-profile-badge">
            {profile.name}
            <span className={`plan-badge ${(profile.plan || "Free").toLowerCase()}`}>
              {profile.plan}
            </span>
          </span>
          {isAuthenticated && (
            <button onClick={handleLogout} className="logout-btn">
              Logout
            </button>
          )}
          <button onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}>
            {theme === "dark" ? "Light" : "Dark"}
          </button>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div>
            <p className="eyebrow">Live market intelligence powered by adaptive AI</p>
            <h1>
              Trade faster with <span>institution-grade</span> context and execution-ready insights.
            </h1>
            <p>
              StockSense combines market breadth, visual news intelligence, AI reasoning, and personalized idea generation so you can move from signal to decision in seconds.
            </p>
            <div className="hero-cta">
              <a href="#workspace" className="cta-primary">
                Open AI Workspace
              </a>
              <a href="#dashboard" className="cta-secondary">
                View Market Dashboard
              </a>
            </div>
          </div>

          <div className="hero-panel">
            <h3>Today&apos;s command center</h3>
            <MiniBars values={topBarValues} />
            <div className="hero-grid">
              <StatCounter label="Questions Generated" value={56} suffix="+" />
              <StatCounter label="Tracked News Signals" value={16} suffix="+" />
              <StatCounter label="Auto Refresh (sec)" value={300} />
              <StatCounter label="Markets Covered" value={6} suffix="+" />
            </div>
          </div>
        </section>

        <section className="ticker-strip">
          <div>
            {(briefing?.indices || []).map((index) => (
              <span key={index.name} className={pctClass(index.change)}>
                {index.name} {index.value.toLocaleString("en-IN")} ({prettyPct(index.change)})
              </span>
            ))}
          </div>
        </section>

        <section id="dashboard" className="dashboard">
          <div className="section-head">
            <p>Market Overview</p>
            <h2>World-class trading dashboard with breadth, momentum, and leadership signals.</h2>
          </div>

          <div className="cards six">
            {(briefing?.indices || []).map((index) => (
              <article key={index.name} className="index-card">
                <h3>{index.name}</h3>
                <strong>{index.value.toLocaleString("en-IN")}</strong>
                <small className={pctClass(index.change)}>{prettyPct(index.change)}</small>
              </article>
            ))}
          </div>
        </section>

        <section id="news" className="news-intel">
          <div className="section-head">
            <p>News Intelligence</p>
            <h2>Graphical news dashboard with sentiment, impact, and timeline signals.</h2>
          </div>

          <div className="cards news-grid">
            <article className="panel">
              <h3>Live Bull/Bear Engine ({activeSymbol})</h3>
              <BullBearGauge insights={insights} />
              <SentimentTrend values={insights?.sentimentTrend || []} />
            </article>

            <article className="panel">
              <h3>News Timeline</h3>
              <NewsTimeline items={newsDash?.timeline || []} />
            </article>
          </div>

          <div className="cards news-cards">
            {(newsDash?.cards || []).map((item) => (
              <article key={item.id} className="news-card">
                <Image src={item.logo} alt={`${item.symbol} logo`} width={48} height={48} unoptimized />
                <div>
                  <p className="tagline">
                    {item.symbol} · {item.source}
                  </p>
                  <h4>{item.headline}</h4>
                  <p>{item.summary}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="workspace" className="workspace workspace-terminal">
          <div className="section-head terminal-head">
            <div>
              <p>AI Workspace</p>
              <h2>Institutional research terminal with full-width layout, resizable columns, and live charting.</h2>
            </div>
            <div className="terminal-search">
              <input
                ref={symbolInputRef}
                value={symbolInput}
                onChange={(event) => setSymbolInput(event.target.value.toUpperCase())}
                onKeyDown={(event) => {
                  if (event.key === "Enter") loadStock(symbolInput, selectedPeriod);
                }}
                placeholder="Search any symbol (AAPL, TSLA, RELIANCE, TCS)"
                aria-label="Search symbol"
              />
              <button onClick={() => loadStock(symbolInput, selectedPeriod)}>Load</button>
            </div>
          </div>

          <div className="workspace-grid terminal-grid" style={{ gridTemplateColumns: workspaceCols }}>
            <aside className="panel suggestions sticky-research">
              {profile.plan === "Analyst" ? (
                <div className="analyst-welcome-banner">
                  <h3>
                    Welcome back, {profile.name} <span className="analyst-welcome-badge">ANALYST</span>
                  </h3>
                  <p className="welcome-subtitle">Institutional terminal active · Full RAG Archive & Unlimited queries</p>
                </div>
              ) : profile.plan === "Pro" ? (
                <div className="pro-welcome-banner">
                  <h3>
                    Welcome back, {profile.name} <span className="pro-welcome-badge">PRO</span>
                  </h3>
                  <p className="welcome-subtitle">Professional terminal active · 100 daily queries & 4-quarter RAG search</p>
                </div>
              ) : (
                <div className="free-welcome-banner">
                  <h3>
                    Welcome back, {profile.name} <span className="free-welcome-badge">FREE</span>
                  </h3>
                  <p className="welcome-subtitle">Basic terminal active · Upgrade to select a professional plan</p>
                </div>
              )}
              <p className="status">{briefing?.status || "Loading market status..."}</p>

              <div className="chips">
                {(briefing?.trendingSectors || []).map((sector) => (
                  <span key={sector.name} className={pctClass(sector.change)}>
                    {sector.name} {prettyPct(sector.change)}
                  </span>
                ))}
              </div>

              {profile.plan !== "Analyst" && (
                <div className="upgrade-callout-card">
                  <h4>Manage Subscription</h4>
                  <p>
                    {profile.plan === "Free" 
                      ? "Upgrade to unlock 100+ daily queries, earnings transcripts RAG, comparison tools, and professional signal archives." 
                      : "Upgrade to Analyst to unlock unlimited queries, full historical earnings transcript archives, and priority terminal access."}
                  </p>
                  <button onClick={() => setShowPricing(true)} className="sidebar-upgrade-btn">
                    {profile.plan === "Free" ? "View Premium Plans" : "Upgrade to Analyst Tier"}
                  </button>
                </div>
              )}

              <div className="alerts">
                <h4>Personalized Alerts</h4>
                <ul>
                  {(briefing?.portfolioAlerts || []).map((alert, idx) => (
                    <li key={`${alert}-${idx}`}>{alert}</li>
                  ))}
                </ul>
              </div>

              <div className="alerts earnings-rag-card">
                <h4>Earnings Call Transcripts (RAG)</h4>
                {profile.plan === "Free" ? (
                  <div className="rag-status locked">
                    <span className="dot inactive" />
                    <span>🔒 PRO / Analyst Feature</span>
                  </div>
                ) : profile.plan === "Pro" ? (
                  <div className="rag-status success">
                    <span className="dot active" />
                    <span>Pro: 4 Quarters Active</span>
                  </div>
                ) : (
                  <div className="rag-status success analyst-glow">
                    <span className="dot active" />
                    <span>Analyst: Full Archive Active</span>
                  </div>
                )}
                
                <div className="rag-upload-control" style={{ opacity: profile.plan === "Free" ? 0.5 : 1, pointerEvents: profile.plan === "Free" ? "none" : "auto" }}>
                  <div className="quarter-select-row">
                    <label htmlFor="quarter-select">Quarter:</label>
                    <select
                      id="quarter-select"
                      value={uploadQuarter}
                      onChange={(e) => setUploadQuarter(e.target.value)}
                      disabled={uploading || profile.plan === "Free"}
                    >
                      <option value="Q1FY26">Q1FY26</option>
                      <option value="Q4FY25">Q4FY25</option>
                      <option value="Q3FY25">Q3FY25</option>
                      <option value="Q2FY25">Q2FY25</option>
                    </select>
                  </div>
                  <label className="upload-btn" style={{ pointerEvents: uploading || profile.plan === "Free" ? "none" : "auto" }}>
                    {uploading ? "Ingesting..." : profile.plan === "Free" ? "Pro Upload Locked" : "Upload PDF Transcript"}
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={uploadTranscript}
                      disabled={uploading || profile.plan === "Free"}
                      style={{ display: "none" }}
                    />
                  </label>
                </div>
              </div>
            </aside>

            <div className="resize-handle" onMouseDown={() => setDragging("left")} aria-hidden />

            <div className="panel chat-panel terminal-center">
              <div className="stock-summary">
                <h3>
                  {stockData?.name || activeSymbol} ({stockData?.symbol || activeSymbol})
                </h3>
                <p>
                  {stockData?.price?.toLocaleString("en-IN")} · <span className={pctClass(stockData?.change_pct || 0)}>{prettyPct(stockData?.change_pct || 0)}</span>
                </p>
              </div>

              <div className="period-tabs" role="tablist" aria-label="Chart timeframe">
                {PERIODS.map((period) => (
                  <button
                    key={period.id}
                    className={selectedPeriod === period.id ? "active" : ""}
                    onClick={() => setSelectedPeriod(period.id)}
                  >
                    {period.label}
                  </button>
                ))}
              </div>

              <CandlestickChart candles={history} indicators={indicators} />

              <div className="chat-area">
                {messages.length === 0 && (
                  <div className="empty">
                    <h4>AI Suggestions</h4>
                    <p>Ask anything from valuation to momentum to sector rotation. Responses stream in real time.</p>
                  </div>
                )}
                {messages.map((message) => (
                  <ChatBubble key={message.id} role={message.role} content={message.content} />
                ))}
                <div ref={chatBottomRef} />
              </div>

              <div className="chat-input-wrap">
                <textarea
                  ref={chatInputRef}
                  rows={2}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Ask: Which stocks have unusual volume and positive sentiment today?"
                />
                <button onClick={() => sendMessage()} disabled={loading || !input.trim()}>
                  {loading ? "Thinking..." : "Send"}
                </button>
              </div>
            </div>

            <div className="resize-handle" onMouseDown={() => setDragging("right")} aria-hidden />

            <aside className="panel terminal-right sticky-research">
              <h4>Dynamic Question Bank (50+)</h4>
              <div className="questions">
                <div>
                  {sortedQuestions.map((question, index) => {
                    const isLocked = profile.plan === "Free" && index >= 5;
                    return (
                      <button
                        key={`${question}-${index}`}
                        onClick={() => {
                          if (isLocked) {
                            alert("🔒 Premium Feature: Pro tier membership is required to unlock the full 50+ question bank.");
                          } else {
                            sendMessage(question);
                          }
                        }}
                        className={isLocked ? "locked-question" : ""}
                      >
                        {question} {isLocked && "🔒"}
                      </button>
                    );
                  })}
                </div>
              </div>

              {followUps.length > 0 && (
                <div className="followups">
                  {followUps.map((item) => (
                    <button key={item} onClick={() => sendMessage(item)}>
                      {item}
                    </button>
                  ))}
                </div>
              )}
            </aside>
          </div>
        </section>

        <section id="social" className="social-proof">
          <div className="section-head">
            <p>Trust & Adoption</p>
            <h2>Built for serious traders, teams, and wealth desks.</h2>
          </div>
          <div className="cards three">
            <article className="panel testimonial">
              <h3>Testimonial Placeholder</h3>
              <p>&quot;StockSense helps us compress morning research from 45 minutes to under 8 minutes.&quot;</p>
              <small>Head of Trading, Institutional Desk</small>
            </article>
            <article className="panel testimonial">
              <h3>Testimonial Placeholder</h3>
              <p>&quot;The visual news intelligence and dynamic idea bank made our workflow dramatically faster.&quot;</p>
              <small>PM, Growth Equity Team</small>
            </article>
            <article className="panel testimonial">
              <h3>Testimonial Placeholder</h3>
              <p>&quot;We finally got Bloomberg-style context with AI-first actions in one place.&quot;</p>
              <small>Independent Professional Trader</small>
            </article>
          </div>
        </section>
      </main>

      {paletteOpen && (
        <div className="palette" role="dialog" aria-modal="true" aria-label="Command palette">
          <div className="palette-inner">
            <h4>Command Palette</h4>
            <button onClick={() => window.location.assign("#dashboard")}>Go to Dashboard</button>
            <button onClick={() => window.location.assign("#news")}>Go to News</button>
            <button onClick={() => window.location.assign("#workspace")}>Go to Workspace</button>
            <button onClick={() => window.location.assign("#social")}>Go to Social</button>
          </div>
        </div>
      )}

      <footer>
        <p>
          <strong>StockSense AI</strong> · Premium market intelligence workspace · Auto-refreshed every 5 minutes
        </p>
      </footer>

      {showPricing && profile.plan && (
        <div className="pricing-overlay" role="dialog" aria-modal="true">
          <div className="pricing-container">
            <header className="pricing-header">
              <h2>Select Workspace Plan</h2>
              <p>Choose the level of market intelligence that matches your workflow</p>
              {profile.plan && (
                <button className="pricing-close-btn" onClick={() => setShowPricing(false)}>✕ Close</button>
              )}
            </header>

            <div className="pricing-cards-grid">
              {/* FREE CARD */}
              <div className="pricing-card free-card">
                <div className="plan-header">
                  <span className="plan-name">FREE</span>
                  <div className="plan-price">
                    <span className="currency">₹</span>
                    <span className="amount">0</span>
                  </div>
                  <span className="plan-duration">forever</span>
                </div>
                <p className="plan-summary">For investors just getting started with AI research.</p>
                
                <ul className="plan-features">
                  <li><span>10 queries per day</span></li>
                  <li><span>Live price + basic fundamentals</span></li>
                  <li><span>Latest 5 news headlines</span></li>
                  <li><span>NSE + BSE coverage</span></li>
                </ul>

                <button onClick={() => handleSelectPlan("Free")} className="plan-btn free-btn">
                  Get started →
                </button>
              </div>

              {/* PRO CARD */}
              <div className="pricing-card pro-card">
                <div className="popular-badge">Most popular</div>
                <div className="plan-header">
                  <span className="plan-name text-gold">PRO</span>
                  <div className="plan-price text-white">
                    <span className="currency">₹</span>
                    <span className="amount">499</span>
                  </div>
                  <span className="plan-duration">per month</span>
                </div>
                <p className="plan-summary">For active investors who research seriously.</p>

                <ul className="plan-features">
                  <li><span>100 queries per day</span></li>
                  <li><span>Full fundamentals + ratios</span></li>
                  <li><span>Earnings call search (4 quarters)</span></li>
                  <li><span>Stock comparison tool</span></li>
                  <li><span>News sentiment analysis</span></li>
                  <li><span>Chat history saved</span></li>
                </ul>

                <button onClick={() => handleSelectPlan("Pro")} className="plan-btn pro-btn">
                  Start Pro →
                </button>
              </div>

              {/* ANALYST CARD */}
              <div className="pricing-card analyst-card">
                <div className="plan-header">
                  <span className="plan-name">ANALYST</span>
                  <div className="plan-price">
                    <span className="currency">₹</span>
                    <span className="amount">1,999</span>
                  </div>
                  <span className="plan-duration">per month</span>
                </div>
                <p className="plan-summary">For portfolio managers and professional traders.</p>

                <ul className="plan-features">
                  <li><span>Unlimited queries</span></li>
                  <li><span>Full earnings call archive</span></li>
                  <li><span>Annual report search</span></li>
                  <li><span>Bulk stock screening</span></li>
                  <li><span>API access</span></li>
                  <li><span>Priority support</span></li>
                </ul>

                <button onClick={() => handleSelectPlan("Analyst")} className="plan-btn analyst-btn">
                  Start Analyst →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

