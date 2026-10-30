import type { HackDefinition } from './definitions';
export interface HackSnapshot { id: string; sequence: readonly number[]; entered: readonly number[]; result: 'input' | 'success' | 'failure'; reason: string; attempt: number }
/** Input matching is real gameplay; presentation and world authorization are separate. */
export class HackPuzzle {
  private entered: number[] = []; private result: HackSnapshot['result'] = 'input'; private started: number; private reason = ''; private attempt = 1;
  constructor(readonly definition: HackDefinition, now = 0) { this.started = now; }
  submit(pad: number, now = 0): boolean {
    if (this.result !== 'input') return false;
    if (this.definition.timeLimit > 0 && now - this.started > this.definition.timeLimit) { this.result = 'failure'; this.reason = 'Connection expired. Retry the sequence.'; return false; }
    if (!Number.isInteger(pad) || pad < 1 || pad > 4) return false;
    if (pad !== this.definition.sequence[this.entered.length]) { this.result = 'failure'; this.reason = 'Signal mismatch. The security network was alerted.'; return false; }
    this.entered.push(pad);
    if (this.entered.length === this.definition.sequence.length) { this.result = 'success'; return true; }
    return false;
  }
  retry(now = 0) { if (this.result !== 'failure') return; this.entered = []; this.result = 'input'; this.reason = ''; this.started = now; this.attempt++; }
  fail(reason: string) { this.result = 'failure'; this.reason = reason; }
  getSnapshot(): HackSnapshot { return { id: this.definition.id, sequence: this.definition.sequence, entered: [...this.entered], result: this.result, reason: this.reason, attempt: this.attempt }; }
}
