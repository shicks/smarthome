export class Clock {
  public now(): number {
    return Date.now();
  }
  public wait(millis: number): Promise<void> {
    return new Promise<void>((resolve) => setTimeout(resolve, millis));
  }
}

export class FakeClock extends Clock {
  private time: number;
  private delays: [number, () => void][];
  constructor() {
    super();
    this.time = Date.now();
    this.delays = [];
  }
  public now(): number {
    return this.time;
  }
  public wait(millis: number): Promise<void> {
    return new Promise<void>((resolve) => {
      this.delays.push([this.time + millis, resolve]);
      this.delays.sort(([a], [b]) => a - b);
    });
  }
  public tick(millis: number): Promise<void> {
    // TODO - how to return a promise that completes after callbacks done???
    //   - seems hard - even proving that a callback never happened is hard.
    //   - maybe use a real timeout for that?
    //   - need to resolve everything in turn...
    const target = this.time + millis;
    return new Promise<void>((resolve) => {
      if (!this.delays.length || this.delays[0][0] > target) {
        this.time += millis;
        resolve();
        return;
      }
      const [next, cb] = this.delays.shift()!;
      this.time = next;
      cb();
      Promise.resolve().then(() => this.tick(target - next));
    });
  }
}
