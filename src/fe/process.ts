// A server process managed by the front-end.
//  - lazily spawns child processes as necessary.

import {ChildProcess, spawn} from 'child_process';
import {Server} from './config.pb';

export class ServerProcess {
  private config: Server;
  private child: ?ChildProcess;

  constructor(config: Server) {
    this.config = config;
    this.child = null;
  }

  domains(): Array<string> {
    return this.config.domains;
  }

  // TODO - could return a promise of the port...?
  connect(): Promise<number> {
    if (child) return Promise.resolve(); // TODO - how to get port? store?
    const child = this.child = spawn(this.config.command, this.config.args);
    let destroy = () => {
      this.child = null;
      destroy = () => {};
    };
    child.on('error', (err) => {
      console.error(err);
      destroy();
    });
    child.on('exit', (code, sig) => {
      destroy();
    });
    const listening = this.config.listeningRegex ? new RegExp(this.config.listeningRegex) : null;
    if (listening) {
      // TODO(sdh): consider racing this against a timeout? If the timeout
      // wins, then shut down the server as unhealthy?
      return new Promise((resolve, reject) => {
        child.stdout.on('data', (chunk) => {
          const match = listening.exec(chunk);
          if (match) {
            resolve(this.config.fixedPort || match.group(1));
          }
        });
      });
    }
    return Promise.resolve(this.config.fixedPort);
  }
}
