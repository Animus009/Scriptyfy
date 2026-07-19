/**
 * Utility to extract, downsample, and encode audio tracks from media files in the browser.
 * This dramatically reduces the payload size (e.g. from a 50MB MP4 video down to a 1.5MB mono WAV),
 * speeding up network uploads and accelerating Gemini's transcription speed.
 */

export async function extractAndDownsampleAudio(
  file: File,
  targetSampleRate = 16000,
  onStepChange?: (step: string) => void
): Promise<{ blob: Blob; mimeType: string }> {
  if (onStepChange) onStepChange("Initializing browser audio extractor...");

  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error("Web Audio API is not supported in this browser.");
  }

  // Create temporary audio context to decode file data
  const audioCtx = new AudioContextClass();

  try {
    if (onStepChange) onStepChange("Reading file binary data...");
    const arrayBuffer = await file.arrayBuffer();

    if (onStepChange) onStepChange("Decoding audio stream from video/audio track...");
    const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    if (onStepChange) onStepChange(`Downsampling to lightweight ${targetSampleRate / 1000}kHz mono...`);
    
    // Set up OfflineAudioContext to render the audio rapidly at target sample rate, mono
    const offlineCtx = new OfflineAudioContext(
      1, // mono
      Math.round(decodedBuffer.duration * targetSampleRate),
      targetSampleRate
    );

    // Create a source buffer node
    const source = offlineCtx.createBufferSource();
    source.buffer = decodedBuffer;
    source.connect(offlineCtx.destination);
    source.start(0);

    // Render/downsample in background thread
    const renderedBuffer = await offlineCtx.startRendering();

    if (onStepChange) onStepChange("Encoding optimized wav payload...");
    const wavBlob = audioBufferToWav(renderedBuffer);

    return {
      blob: wavBlob,
      mimeType: "audio/wav",
    };
  } finally {
    // Close context to free browser system resources
    if (audioCtx.state !== "closed") {
      await audioCtx.close().catch(() => {});
    }
  }
}

/**
 * Encodes an AudioBuffer into a standard 16-bit PCM WAV blob.
 */
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numOfChan = 1; // mono
  const sampleRate = buffer.sampleRate;
  const format = 1; // Raw PCM format
  const bitDepth = 16;

  const samples = buffer.getChannelData(0);
  const bufferLength = samples.length * 2; // 16-bit = 2 bytes per sample
  const arrayBuffer = new ArrayBuffer(44 + bufferLength);
  const view = new DataView(arrayBuffer);

  // Helper to write ASCII strings to DataView
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  /* RIFF identifier */
  writeString(0, "RIFF");
  /* file length */
  view.setUint32(4, 36 + bufferLength, true);
  /* WAVE identifier */
  writeString(8, "WAVE");
  /* format chunk identifier */
  writeString(12, "fmt ");
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw PCM) */
  view.setUint16(20, format, true);
  /* channel count */
  view.setUint16(22, numOfChan, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * 2, true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, 2, true);
  /* bits per sample */
  view.setUint16(34, bitDepth, true);
  /* data chunk identifier */
  writeString(36, "data");
  /* data chunk length */
  view.setUint32(40, bufferLength, true);

  // Write PCM audio samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}
