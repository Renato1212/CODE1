export interface Voice {
  id: number;
  startedAt: number;
  endsAt: number;
  cleanup: () => void;
}

export class VoicePool {
  private voices: Voice[] = [];
  private nextId = 1;
  constructor(private max = 32) {}

  acquire(now: number, durationMs: number, cleanup: () => void): Voice {
    if (this.voices.length >= this.max) {
      this.voices.sort((a, b) => a.startedAt - b.startedAt);
      const oldest = this.voices.shift();
      if (oldest) { try { oldest.cleanup(); } catch {} }
    }
    const v: Voice = { id: this.nextId++, startedAt: now, endsAt: now + durationMs, cleanup };
    this.voices.push(v);
    return v;
  }

  release(id: number) {
    this.voices = this.voices.filter(v => v.id !== id);
  }

  gc(now: number) {
    this.voices = this.voices.filter(v => {
      if (v.endsAt < now) { try { v.cleanup(); } catch {} return false; }
      return true;
    });
  }
}
