// public/audio-processor.js
class AudioProcessor extends AudioWorkletProcessor {
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input && input.length > 0) {
      const channelData = input[0];
      // Convertir Float32 a Int16 PCM (Little Endian)
      const pcmBuffer = new Int16Array(channelData.length);
      for (let i = 0; i < channelData.length; i++) {
        const s = Math.max(-1, Math.min(1, channelData[i]));
        pcmBuffer[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      // Enviar el buffer binario al hilo principal
      this.port.postMessage(pcmBuffer.buffer, [pcmBuffer.buffer]);
    }
    return true;
  }
}
registerProcessor('audio-processor', AudioProcessor);