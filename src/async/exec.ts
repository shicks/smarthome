import * as childProcess from 'child_process';

export function execFile(file: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    childProcess.execFile(
        file, args, (err, out) => err ? reject(err) : resolve(out));
  });
}
