"""Resolve common company names (India + major global) and explicit ticker symbols."""

import re


SKIP = {
    "NSE", "BSE", "IPO", "AI", "PE", "ROE", "EPS", "TTM", "YOY", "QOQ",
    "THE", "AND", "FOR", "ARE", "DID", "WHY", "HOW", "WHAT", "WHEN", "WHO",
    "IS", "IN", "OF", "TO", "A", "AN", "IT", "ITS", "VS", "OR", "US", "UK",
}

COMPANY_ALIASES = (
    # India
    (r"\breliance(?: industries)?\b", "RELIANCE"),
    (r"\bhdfc(?: bank)?\b", "HDFCBANK"),
    (r"\bicici(?: bank)?\b", "ICICIBANK"),
    (r"\btata consultancy services\b", "TCS"),
    (r"\binfosys\b", "INFY"),
    (r"\bzomato\b", "ETERNAL"),
    (r"\beternal\b", "ETERNAL"),
    (r"\bbajaj finance\b", "BAJFINANCE"),
    (r"\bstate bank of india\b", "SBIN"),
    (r"\bsbi\b", "SBIN"),
    (r"\baxis bank\b", "AXISBANK"),
    (r"\bkotak mahindra(?: bank)?\b", "KOTAKBANK"),
    (r"\bbharti airtel\b", "BHARTIARTL"),
    (r"\blarsen (?:and|&) toubro\b", "LT"),
    (r"\bmaruti suzuki\b", "MARUTI"),

    # Global — bonus feature, resolved with no exchange suffix
    (r"\bapple\b", "AAPL"),
    (r"\bmicrosoft\b", "MSFT"),
    (r"\b(?:google|alphabet)\b", "GOOGL"),
    (r"\bamazon\b", "AMZN"),
    (r"\btesla\b", "TSLA"),
    (r"\b(?:meta|facebook)\b", "META"),
    (r"\bnetflix\b", "NFLX"),
    (r"\bnvidia\b", "NVDA"),
    (r"\bmicrosoft\b", "MSFT"),
    (r"\bberkshire hathaway\b", "BRK-B"),
    (r"\bjpmorgan(?: chase)?\b", "JPM"),
    (r"\bwalmart\b", "WMT"),
    (r"\bdisney\b", "DIS"),
    (r"\bcoca[- ]cola\b", "KO"),
)


def extract_symbols(message: str) -> list[str]:
    matches: list[tuple[int, str]] = []
    occupied_spans: list[tuple[int, int]] = []

    for pattern, symbol in COMPANY_ALIASES:
        for match in re.finditer(pattern, message, re.IGNORECASE):
            matches.append((match.start(), symbol))
            occupied_spans.append(match.span())

    for match in re.finditer(r"\b[A-Z]{2,10}\b", message):
        if any(start <= match.start() < end for start, end in occupied_spans):
            continue
        symbol = match.group(0)
        if symbol not in SKIP:
            matches.append((match.start(), symbol))

    symbols: list[str] = []
    for _, symbol in sorted(matches):
        if symbol not in symbols:
            symbols.append(symbol)
    return symbols