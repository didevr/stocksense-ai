import unittest

from app.services.symbol_service import extract_symbols


class SymbolResolutionTests(unittest.TestCase):
    def test_resolves_company_name(self):
        self.assertEqual(
            extract_symbols("What is Reliance Industries PE ratio?"),
            ["RELIANCE"],
        )

    def test_resolves_comparison_in_order(self):
        self.assertEqual(
            extract_symbols("Compare HDFC Bank vs ICICI Bank"),
            ["HDFCBANK", "ICICIBANK"],
        )

    def test_keeps_explicit_tickers(self):
        self.assertEqual(
            extract_symbols("Compare RELIANCE vs TCS"),
            ["RELIANCE", "TCS"],
        )

    def test_uses_current_zomato_ticker(self):
        self.assertEqual(extract_symbols("Why did Zomato fall?"), ["ETERNAL"])


if __name__ == "__main__":
    unittest.main()
