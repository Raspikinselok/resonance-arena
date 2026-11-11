// Musik-Modus: holt ein Audiosignal in den Browser und zerlegt es in Frequenzbänder.
// Alles bleibt lokal im Browser. Es wird nichts aufgezeichnet oder gesendet.
//
// Quellen:
//   tab   Ton eines Browser-Tabs oder des ganzen Systems (Freigabe-Dialog, "Audio teilen" anhaken)
//   mic   Mikrofon (nimmt auf, was aus den Lautsprechern kommt)
//   demo  künstliches Signal ohne Ton, zum Ausprobieren der Effekte

const BINS = 48;

export function createAudio() {
  const bins = new Float32Array(BINS);
  const out = { bins, bass: 0, mid: 0, treble: 0, level: 0, active: false, source: null };
  let ctx = null, analyser = null, stream = null, data = null, demoT = 0;

  function stop() {
    stream?.getTracks().forEach((t) => t.stop());
    ctx?.close();
    ctx = analyser = stream = data = null;
    out.active = false; out.source = null;
    bins.fill(0);
    out.bass = out.mid = out.treble = out.level = 0;
  }

  async function start(source) {
    stop();
    if (source === 'demo') { out.active = true; out.source = 'demo'; return; }
    if (source === 'tab') {
      // Video muss mit angefragt werden, sonst bietet der Browser keine Audiofreigabe an. Es wird nicht verwendet.
      stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      stream.getVideoTracks().forEach((t) => { t.enabled = false; });
      if (!stream.getAudioTracks().length) {
        stop();
        throw new Error('Die Freigabe enthält keinen Ton. Im Dialog „Tab-Audio teilen“ bzw. „Systemaudio teilen“ anhaken.');
      }
    } else {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    }
    ctx = new AudioContext();
    analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.78;
    ctx.createMediaStreamSource(stream).connect(analyser); // nur analysieren, nicht wiedergeben (kein Echo)
    data = new Uint8Array(analyser.frequencyBinCount);
    stream.getAudioTracks()[0].addEventListener('ended', stop);
    out.active = true; out.source = source;
  }

  // Einmal pro Bild aufrufen. Liefert 48 Bänder (0..1), logarithmisch verteilt, plus Bass/Mitten/Höhen.
  function update(dt) {
    if (!out.active) return out;
    if (out.source === 'demo') {
      demoT += dt;
      const beat = Math.pow(Math.max(0, Math.sin(demoT * Math.PI * 2)), 6); // 120 bpm
      for (let i = 0; i < BINS; i++) {
        const x = i / BINS;
        const target = Math.max(0, (1 - x) * beat * 0.9 + 0.35 * Math.abs(Math.sin(demoT * (1.3 + x * 5) + i)) * (0.4 + 0.6 * Math.sin(demoT * 0.5 + x * 6) ** 2));
        bins[i] += (target - bins[i]) * 0.35;
      }
    } else {
      analyser.getByteFrequencyData(data);
      const top = Math.min(data.length, Math.floor((16000 / (ctx.sampleRate / 2)) * data.length)); // bis 16 kHz
      for (let i = 0; i < BINS; i++) {
        const a = Math.floor(Math.pow(i / BINS, 2) * top), b = Math.max(a + 1, Math.floor(Math.pow((i + 1) / BINS, 2) * top));
        let sum = 0;
        for (let k = a; k < b; k++) sum += data[k];
        bins[i] = sum / (b - a) / 255;
      }
    }
    const mean = (from, to) => { let s = 0; for (let i = from; i < to; i++) s += bins[i]; return s / (to - from); };
    out.bass = mean(0, 8); out.mid = mean(8, 28); out.treble = mean(28, BINS);
    out.level = mean(0, BINS);
    return out;
  }

  return { start, stop, update, state: out, BINS };
}
