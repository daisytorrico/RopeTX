import sys
import os
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
import pytest

# Ensure backend root is in PYTHONPATH
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.gemini_asr import (
    _drain_queue,
    _send_audio_loop,
    _receive_subtitles_loop,
    stream_audio_to_gemini,
)
from app.services.connection_manager import manager


@pytest.mark.asyncio
async def test_drain_queue():
    """Verifica que _drain_queue vacíe la cola de audio correctamente."""
    queue = asyncio.Queue()
    await queue.put(b"chunk1")
    await queue.put(b"chunk2")
    assert queue.qsize() == 2

    drain_task = asyncio.create_task(_drain_queue(queue))
    # Dejar procesar la cola
    await asyncio.sleep(0.01)
    drain_task.cancel()
    try:
        await drain_task
    except asyncio.CancelledError:
        pass

    assert queue.empty()


@pytest.mark.asyncio
async def test_send_audio_loop():
    """Verifica que _send_audio_loop envíe fragmentos de audio a la sesión de Gemini."""
    queue = asyncio.Queue()
    await queue.put(b"pcm_data_16k")

    mock_session = AsyncMock()
    mock_session.send_realtime_input = AsyncMock()

    task = asyncio.create_task(_send_audio_loop(mock_session, queue))
    await asyncio.sleep(0.01)
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass

    assert mock_session.send_realtime_input.called
    assert queue.empty()


@pytest.mark.asyncio
async def test_receive_subtitles_loop_interim_and_final():
    """Verifica el procesamiento de transcripciones parciales (interim) y finales en _receive_subtitles_loop."""
    room_id = "test-stage-1"

    # Crear respuestas simuladas de Gemini Live
    class MockInterim:
        text = "Hola probando"

    class MockFinal:
        text = "Hola probando subtítulos finales."

    class MockServerContent1:
        input_transcription = None
        interim_input_transcription = MockInterim()

    class MockServerContent2:
        input_transcription = MockFinal()
        interim_input_transcription = None

    class MockResponse1:
        server_content = MockServerContent1()

    class MockResponse2:
        server_content = MockServerContent2()

    class MockSession:
        async def receive(self):
            yield MockResponse1()
            yield MockResponse2()

    mock_coordinator = MagicMock()
    mock_coordinator.submit = AsyncMock()

    broadcast_mock = AsyncMock()
    with patch.object(manager, "broadcast_subtitles", broadcast_mock), \
         patch.object(manager, "get_room_language", return_value="es"), \
         patch.object(manager, "_get_history", new_callable=AsyncMock, return_value=[]):

        await _receive_subtitles_loop(
            session=MockSession(),
            room_id=room_id,
            source_lang="es",
            coordinator=mock_coordinator,
        )

        # 1. Interim debió disparar broadcast directo al manager
        assert broadcast_mock.called
        interim_call_args = broadcast_mock.call_args[0]
        assert interim_call_args[0] == room_id
        assert interim_call_args[1]["text"] == "Hola probando"
        assert interim_call_args[1]["is_final"] is False
        assert interim_call_args[1]["speaker_lang"] == "es"

        # 2. Final debió coordinar la traducción simultánea con coordinator.submit()
        assert mock_coordinator.submit.called
        submit_kwargs = mock_coordinator.submit.call_args[1]
        assert submit_kwargs["text"] == "Hola probando subtítulos finales."
        assert submit_kwargs["is_final"] is True
        assert submit_kwargs["source_lang"] == "es"


@pytest.mark.asyncio
async def test_stream_audio_to_gemini_no_client():
    """Verifica que sin API key configurada se envíe 'asr_unavailable' y se vacíe la cola."""
    queue = asyncio.Queue()
    await queue.put(b"audio_bytes")

    broadcast_mock = AsyncMock()
    with patch("app.services.gemini_asr.get_genai_client", return_value=None), \
         patch.object(manager, "broadcast_subtitles", broadcast_mock):

        await stream_audio_to_gemini("room-no-key", queue, source_lang="es")

        assert broadcast_mock.called
        payload = broadcast_mock.call_args[0][1]
        assert payload.get("code") == "asr_unavailable"
        assert queue.empty()
