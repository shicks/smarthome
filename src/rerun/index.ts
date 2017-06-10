require('source-map-support').install();

import {spawn} from 'child_process';

const command = process.argv[2];
const args = process.argv.slice(3);

class CircularBuffer {
  buf: Buffer;
  pos: number;

  constructor(size: number) {
    this.buf = new Buffer(size);
    this.pos = 0;
    for (let i = 0; i < this.buf.length; i++) {
      this.buf.writeInt8(32, i);
    }
  }

  write(chunk: string) {
    // TODO(sdh): add a timestamp?
    const end = this.buf.length;
    if (chunk.length > end) {
      chunk = chunk.substring(chunk.length - end);
    }
    this.buf.write(chunk.substring(0, end - this.pos), this.pos);
    if (chunk.length > end - this.pos) {
      this.buf.write(chunk.substring(end - this.pos), 0)
    }
    this.pos = (this.pos + chunk.length) % end;
  }

  dump(): string {
    return this.buf.toString('utf8', this.pos, this.buf.length - this.pos)
        + this.buf.toString('utf8', 0, this.pos);
  }
}

function launch() {
  new Promise((resolve) => {
    const out = new CircularBuffer(20000);
    const err = new CircularBuffer(20000);
    const job = spawn(command, args);
    job.stdin.end();  // close stdin immediately (or just pipe stdin to it?)
    job.stdout.on('data', (chunk) => {
      out.write(chunk.toString());
    });
    job.stderr.on('data', (chunk) => {
      err.write(chunk.toString());
    });
    job.on('exit', (code, signal) => {
      console.error('Process exited: code=' + code + ', sig=' + signal
                    + '\nSTDOUT:\n' + out.dump() + '\nSTDERR:\n' + err.dump());
      // TODO(sdh): dump the log buffers
      resolve();
    });
  }).then(launch);
}
