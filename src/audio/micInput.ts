/** Mikrofonin analyysiketju: ylipäästö → jyrkkä alipäästö (metronomiklikki pois) → FFT. */
export const ANALYSIS_LOWPASS_HZ = 2200;

export class MicInput {
  readonly analyser: AnalyserNode;
  /** Viimeisin dB-spektri (päivittyy read()-kutsussa), näytteiden tallennusta varten */
  readonly freqDb: Float32Array<ArrayBuffer>;
  private timeData: Float32Array<ArrayBuffer>;
  readonly mags: Float32Array<ArrayBuffer>;

  private constructor(
    readonly ctx: AudioContext,
    private stream: MediaStream,
    private source: MediaStreamAudioSourceNode,
  ) {
    const hp = new BiquadFilterNode(ctx, { type: "highpass", frequency: 45, Q: 0.7 });
    // Neljä peräkkäistä alipäästöä ≈ 48 dB/oktaavi: 6–7 kHz klikki vaimenee ~70 dB.
    const lps = Array.from({ length: 4 }, () => new BiquadFilterNode(ctx, { type: "lowpass", frequency: ANALYSIS_LOWPASS_HZ, Q: 0.7 }));
    this.analyser = new AnalyserNode(ctx, { fftSize: 16384, smoothingTimeConstant: 0, minDecibels: -120, maxDecibels: 0 });
    source.connect(hp);
    let node: AudioNode = hp;
    for (const lp of lps) {
      node.connect(lp);
      node = lp;
    }
    node.connect(this.analyser);
    this.freqDb = new Float32Array(this.analyser.frequencyBinCount);
    this.mags = new Float32Array(this.analyser.frequencyBinCount);
    this.timeData = new Float32Array(this.analyser.fftSize);
  }

  static async open(ctx: AudioContext): Promise<MicInput> {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Selain ei tue mikrofonia (tarvitaan https tai localhost).");
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
    });
    return new MicInput(ctx, stream, ctx.createMediaStreamSource(stream));
  }

  get sampleRate(): number {
    return this.ctx.sampleRate;
  }
  get fftSize(): number {
    return this.analyser.fftSize;
  }

  /** Päivittää lineaarisen magnitudispektrin ja palauttaa viimeisen ~50 ms RMS-tason (dBFS). */
  read(): number {
    this.analyser.getFloatFrequencyData(this.freqDb);
    for (let i = 0; i < this.freqDb.length; i++) {
      const db = this.freqDb[i];
      this.mags[i] = Number.isFinite(db) ? Math.pow(10, db / 20) : 0;
    }
    this.analyser.getFloatTimeDomainData(this.timeData);
    const n = Math.min(this.timeData.length, Math.round(this.ctx.sampleRate * 0.05));
    let sum = 0;
    for (let i = this.timeData.length - n; i < this.timeData.length; i++) sum += this.timeData[i] ** 2;
    const rms = Math.sqrt(sum / n);
    return rms > 0 ? 20 * Math.log10(rms) : -120;
  }

  close(): void {
    this.source.disconnect();
    for (const t of this.stream.getTracks()) t.stop();
  }
}
