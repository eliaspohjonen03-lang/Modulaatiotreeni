/** Screen Wake Lock: pitää näytön päällä harjoittelun ajan. Pyytää lukon uudelleen, kun välilehti palaa näkyviin. */
export class ScreenWakeLock {
  private sentinel: WakeLockSentinel | null = null;
  private wanted = false;

  constructor() {
    document.addEventListener("visibilitychange", () => {
      if (this.wanted && document.visibilityState === "visible") void this.acquire();
    });
  }

  get supported(): boolean {
    return "wakeLock" in navigator;
  }

  get active(): boolean {
    return !!this.sentinel && !this.sentinel.released;
  }

  async enable(): Promise<boolean> {
    this.wanted = true;
    return this.acquire();
  }

  async disable(): Promise<void> {
    this.wanted = false;
    await this.sentinel?.release().catch(() => undefined);
    this.sentinel = null;
  }

  private async acquire(): Promise<boolean> {
    if (!this.supported || this.active) return this.active;
    try {
      this.sentinel = await navigator.wakeLock.request("screen");
      return true;
    } catch {
      return false;
    }
  }
}
