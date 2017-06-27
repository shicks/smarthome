export class TimeUnit {
  private millis: number;
  constructor(millis: number) {
    this.millis = millis;
  }

  toMillis(count: number) {
    return count * this.millis;
  }
}

export const SECONDS = new TimeUnit(1000);
export const MINUTES = new TimeUnit(60000);
export const HOURS = new TimeUnit(3600000);
export const DAYS = new TimeUnit(86400000);
