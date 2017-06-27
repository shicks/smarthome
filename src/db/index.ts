import * as fs from 'fs';
import * as sqlite3 from 'sqlite3';
import {Clock, SECONDS, access, execFile, stat, wrapError} from '../async';
import {Lock} from '../lock';
import {VError} from 'verror';

// DB must extend Closeable
// interface Closeable {
//   close(cb: (err?: Error) => void): void;
// }

const LOCK_OPTS = {
  wait: SECONDS.toMillis(30),
  stale: SECONDS.toMillis(60),
};

async function copy(src: string, dst: string): Promise<void> {
  const mode = fs.constants.W_OK | fs.constants.R_OK;
  try {
    await access(dst, mode);
    // file exists and is writable, so nothing else to do
  } catch (err) {
    if (err.code != 'ENOENT') {
      // file exists but is not accessible: throw
      throw new VError(err, 'temporary database not accessible');
    }
    // file doesn't exist: copy
    await wrapError(
        execFile('/bin/cp', [src, dst]),
        'initial database copy failed');
  }
}

async function md5(path: string): Promise<string> {
  const out = await execFile('/usr/bin/md5sum', [path]);
  return out.substring(0, 32);
}

type DatabaseOptions = {
  // Clock: setTimeout() and now()
  clock?: Clock,
  tmpdir?: string,
};


export class Database {
  private clock: Clock;
  private db: sqlite3.Database;
  private realPath: string;
  private tmpPath: string;
  private delayMs: number;
  private lock: Lock;
  private busy: Promise<any>;
  private backupQueued: boolean;

  // consider making the whole thing lazy, i.e.
  //   - wait until first run() to compute tmpPath and md5bin
  //     (or at least initialize busy with this result)
  //     -- may not need the parameter... just dep directly on sqlite3?
  //   - test will need to specify, anticipate, and/or query the tempPath

  // TODO - inject cp and md5 functions?
  //   -- in particular, mac will need a different binary (md5 -q)
  //   -- how to detect this? which md5sum???  Promise.race?
  //   -- don't want to get too clever w/ mocking/injection
  //      but want to cover important cases...
  // mac also doesn't have /dev/shm - will need a different pattern
  //   (but okay to touch disk) - i.e. use /dev/shm only if it exists
  // shared db config protobuffer???

  constructor(path: string, delayMs: number, opts: DatabaseOptions = {}) {
    const tmpDir = opts.tmpdir || '/dev/shm';
    this.clock = opts.clock || new Clock();
    this.realPath = path;
    this.tmpPath = `${tmpDir}/db.${path.replace(/\//g, '_')}`,
    this.delayMs = delayMs;
    this.db = new sqlite3.Database(this.tmpPath);
    this.lock = new Lock(this.tmpPath + '.lock', LOCK_OPTS);
    this.busy = Promise.resolve();
    this.backupQueued = false;

    this.withLock(() => copy(this.realPath, this.tmpPath));
  }

  /**
   * Runs the callback with the given database.  The callback must
   * resolve the returned promise when the database is no longer
   * needed.  Once the promise resolves, the database object is
   * invalid for access.
   */
  run<T>(callback: (db: sqlite3.Database) => Promise<T>): Promise<T> {
    return this.withLock(async () => {
      const result = await callback(this.db);
      if (!this.backupQueued) {
        this.clock.wait(this.delayMs).then(() => {
          this.backupQueued = false;
          this.backup();
        });
        this.backupQueued = true;
      }
      return result;
    });
  }

  /** Backs up the database to its real path. */
  private backup() {
    this.withLock(async () => {
      await wrapError(this.close(), 'could not close database');
      await this.updateDisk();
      this.db = new sqlite3.Database(this.tmpPath);
    });
  }

  // NOTE: Does not acquire any locks; must be locked externally.
  private close(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.db.close((err) => err ? reject(err) : resolve());
    });
  }

  private withLock<T>(callback: () => Promise<T>): Promise<T> {
    return this.busy = this.busy.then(() => this.lock.withLock(callback));
  }

  /** Updates the file stored to disk, if necessary. */
  // move out to module-local (pass in now()-delayMs instead?)
  private async updateDisk(): Promise<void> {
    const [src, dst, delayMs] = [this.tmpPath, this.realPath, this.delayMs];
    const [srcMd5, dstMd5, dstStat] =
        await Promise.all([md5(src), md5(dst), stat(dst)]);
    if (srcMd5 == dstMd5) return;
    if (this.clock.now() - delayMs > dstStat.mtime.getTime()) {
      await wrapError(
          execFile('/bin/cp', [src, dst]),
          'could not backup database');
    }
  }

  //   });
  //   this.busy = this.busy.then(() => {
  //     return this.lock.withLock(() => {
  //       // TODO(sdh): Promise.race() for a timeout? Would be nice if there
  //       // were a way to throw an InterruptedException in the coroutine.
  //       return callback(this.db);
  //     });
  //   });
  // }
}


// const db = new Database('foo.db', 7200000);
// db.run(db => {
//   return new Promise((resolve) => {
//     db.serialize(() => {
//       db.run('PRAGMA journal_mode=WAL');
//       db.run('CREATE TABLE IF NOT EXISTS foo (id TEXT, count INTEGER);')
//       db.run('INSERT INTO foo VALUES ($id, $count);', 'foo', 2, () => resolve());
//       console.log('created db');
//     }
//   });
// });

