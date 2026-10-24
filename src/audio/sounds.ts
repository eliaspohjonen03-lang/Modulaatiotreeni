/** Lyhyt, pehmeä kaksisävelinen kello onnistumisesta (A5 → E6). */
export function playSuccess(ctx: AudioContext, volume = 0.35): void {
  const t0 = ctx.currentTime + 0.01;
  [
    [880, 0],
    [1318.5, 0.11],
  ].forEach(([freq, delay]) => {
    const t = t0 + delay;
    const gain = new GainNode(ctx, { gain: 0 });
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    gain.connect(ctx.destination);
    for (const [type, mult, level] of [["sine", 1, 1], ["sine", 2, 0.15]] as const) {
      const o = new OscillatorNode(ctx, { type, frequency: freq * mult });
      const g = new GainNode(ctx, { gain: level });
      o.connect(g).connect(gain);
      o.start(t);
      o.stop(t + 0.75);
    }
  });
}
