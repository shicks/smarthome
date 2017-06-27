import * as lockFile from 'lockfile';
import {VError, MultiError} from 'verror';

/**
 * Simple OO/async file lock interface.
 */
export class Lock {
  private file: string;
  private opts: lockFile.Options;
  private err?: Error;

  constructor(file: string, opts: lockFile.Options) {
    this.file = file;
    this.opts = opts;
  }

  withLock<T>(callback: () => Promise<T>): Promise<T> {
    if (this.err) {
      // TODO(sdh): just system.exit or halt somehow?
      return Promise.reject(
          new VError(this.err, 'lock "%s" is broken', this.path));
    }
    return new Promise((resolve, reject) => {
      lockFile.lock(this.path, this.opts, (err) => {
        if (err) {
          reject(new VError(err, 'could not acquire lock "%s"', this.path));
        } else {
          const finish = (err?: Error, result?: T) => {
            lockFile.unlock(this.path, (lockErr) => {
              this.err = lockErr || this.err;
              lockErr = lockErr &&
                  new VError(lockErr, 'failed to release lock "%s"', this.path);
              if (err && lockErr) {
                reject(new MultiError([err, lockErr]));
              } else if (err || lockErr) {
                reject(err || lockErr);
              } else {
                resolve(result as T);
              }
            });
          };
          try {
            callback().then(
                (result) => finish(null, result),
                (err) => finish(err));
          } catch (err) {
            finish(err);
          }
        }
      });
    });
  }
}
