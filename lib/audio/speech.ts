export class SpeechQueue {
  private queue: string[] = [];
  private speaking = false;
  enabled = true;
  rate = 1.0;
  voiceName: string | null = null;

  speak(text: string) {
    if (!this.enabled) return;
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    if (this.queue.length >= 2) this.queue.shift();
    this.queue.push(text);
    this.pump();
  }

  private pump() {
    if (this.speaking) return;
    const text = this.queue.shift();
    if (!text) return;
    this.speaking = true;
    const u = new SpeechSynthesisUtterance(text);
    u.rate = this.rate;
    if (this.voiceName) {
      const v = window.speechSynthesis.getVoices().find(v => v.name === this.voiceName);
      if (v) u.voice = v;
    }
    u.onend = () => { this.speaking = false; this.pump(); };
    u.onerror = () => { this.speaking = false; this.pump(); };
    window.speechSynthesis.speak(u);
  }

  cancel() {
    this.queue = [];
    this.speaking = false;
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }
}
