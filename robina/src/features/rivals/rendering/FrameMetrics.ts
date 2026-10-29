/** A bounded ring. Sorting happens only when the HUD samples it, never per frame. */
export class FrameMetrics {
  private samples = new Float64Array(240);
  private count = 0;
  private index = 0;
  private previous = 0;
  resetClock() { this.previous = 0; }
  record(now: number) {
    if (this.previous) {
      this.samples[this.index] = now - this.previous;
      this.index = (this.index + 1) % this.samples.length;
      this.count = Math.min(this.count + 1, this.samples.length);
    }
    this.previous = now;
  }
  read() {
    if (!this.count) return { fps: 0, p95FrameMs: 0 };
    const values = Array.from(this.samples.subarray(0, this.count)).sort((a, b) => a - b);
    return { fps: 1000 / (values.reduce((sum, v) => sum + v, 0) / this.count), p95FrameMs: values[Math.min(values.length - 1, Math.floor(values.length * .95))] };
  }
}
