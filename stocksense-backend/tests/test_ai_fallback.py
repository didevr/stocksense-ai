import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

from app.services import ai_service


class AIFallbackTests(unittest.IsolatedAsyncioTestCase):
    async def test_chat_falls_back_to_gemini_when_openai_fails(self):
        openai = Mock()
        openai.chat.completions.create.side_effect = RuntimeError("OpenAI unavailable")
        gemini = Mock()
        gemini.generate_content.return_value = SimpleNamespace(text="Gemini answer")

        with (
            patch.object(ai_service, "openai_client", openai),
            patch.object(ai_service, "gemini_model", gemini),
            patch.object(ai_service, "_build_context", AsyncMock(return_value=("", []))),
        ):
            response = await ai_service.chat("Hello")

        self.assertEqual(response.answer, "Gemini answer")
        self.assertEqual(response.tokens_used, 0)
        gemini.generate_content.assert_called_once()

    async def test_stream_falls_back_before_openai_emits_text(self):
        openai = Mock()
        openai.chat.completions.create.side_effect = RuntimeError("OpenAI unavailable")
        gemini = Mock()
        gemini.generate_content.return_value = [
            SimpleNamespace(text="Gemini "),
            SimpleNamespace(text="stream"),
        ]

        with (
            patch.object(ai_service, "openai_client", openai),
            patch.object(ai_service, "gemini_model", gemini),
            patch.object(ai_service, "_build_context", AsyncMock(return_value=("", []))),
        ):
            chunks = [chunk async for chunk in ai_service.chat_stream("Hello")]

        self.assertEqual(chunks, ["Gemini ", "stream"])
        gemini.generate_content.assert_called_once_with(unittest.mock.ANY, stream=True)

    async def test_openai_error_is_preserved_without_gemini(self):
        openai = Mock()
        failure = RuntimeError("OpenAI unavailable")
        openai.chat.completions.create.side_effect = failure

        with (
            patch.object(ai_service, "openai_client", openai),
            patch.object(ai_service, "gemini_model", None),
            patch.object(ai_service, "_build_context", AsyncMock(return_value=("", []))),
        ):
            with self.assertRaisesRegex(RuntimeError, "OpenAI unavailable"):
                await ai_service.chat("Hello")


if __name__ == "__main__":
    unittest.main()
