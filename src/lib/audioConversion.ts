/**
 * Converts an audio File to 24-bit, 48kHz WAV using the Web Audio API.
 * Returns a new File with the converted audio.
 */
export async function convertAudioTo24bit48kHz(
  file: File,
  onProgress?: (msg: string) => void
): Promise<File> {
  onProgress?.('Decoding audio...');

  const arrayBuffer = await file.arrayBuffer();

  // Create an offline context at 48kHz to resample
  const tempCtx = new AudioContext();
  const audioBuffer = await tempCtx.decodeAudioData(arrayBuffer);
  await tempCtx.close();

  const targetSampleRate = 48000;
  const numChannels = audioBuffer.numberOfChannels;
  const duration = audioBuffer.duration;

  onProgress?.('Converting to 48kHz / 24-bit...');

  // Use OfflineAudioContext to resample
  const offlineCtx = new OfflineAudioContext(
    numChannels,
    Math.ceil(duration * targetSampleRate),
    targetSampleRate
  );

  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineCtx.destination);
  source.start(0);

  const renderedBuffer = await offlineCtx.startRendering();

  onProgress?.('Encoding WAV...');

  // Encode as 24-bit WAV
  const wavBlob = encodeWav24bit(renderedBuffer);
  
  const baseName = file.name.replace(/\.[^.]+$/, '');
  return new File([wavBlob], `${baseName}.wav`, { type: 'audio/wav' });
}

function encodeWav24bit(audioBuffer: AudioBuffer): Blob {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const numSamples = audioBuffer.length;
  const bytesPerSample = 3; // 24-bit
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numSamples * blockAlign;
  const headerSize = 44;
  const buffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');

  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true);  // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // byte rate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 24, true); // bits per sample

  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Get channel data
  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(audioBuffer.getChannelData(ch));
  }

  // Write interleaved 24-bit samples
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      // Convert float [-1, 1] to 24-bit signed integer [-8388608, 8388607]
      const intSample = Math.round(sample * 8388607);
      // Write 24-bit little-endian
      view.setUint8(offset, intSample & 0xFF);
      view.setUint8(offset + 1, (intSample >> 8) & 0xFF);
      view.setUint8(offset + 2, (intSample >> 16) & 0xFF);
      offset += 3;
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
