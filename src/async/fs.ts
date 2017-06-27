import * as fs from 'fs';

export type Stats = fs.Stats;

export function access(path: string, mode: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    fs.access(path, mode, (err) => err ? reject(err) : resolve());
  });
}

export function stat(path: string): Promise<Stats> {
  return new Promise((resolve, reject) => {
    fs.stat(path, (err, stats) => err ? reject(err) : resolve(stats));
  });
}
