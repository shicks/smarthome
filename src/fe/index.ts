require('source-map-support').install();

// TODO - provide common libraries for crypto/auth
//   Is it a problem for multiple procs to have write access to sqlite3 at once?
//   - doesn't seem to be - there's transactions if needed, and even just
//     append-only should be fine since order shouldn't matter
//   - design a schema that's order-agnostic
// TABLE: users
//   - id, nickname, public key
// TABLE: accesses
//   - host/path, userid, date
// TABLE: services
//   - userid, serviceid (1:1 map w/ subdomains?? - if not, subservice/role/expiry?)
//   - could have admin web interface for adjusting roles/expirations/schedules?

import * as http from 'http';
import {readFile} from 'fs';
import {parse as parseUrl, Url} from 'url';

import {FrontEnd} from './config.pb';


/** Class that ensures async actions occur in series. */
class Serializer {
  private promise: Promise<any>;
  constructor() {
    this.promise = Promise.resolve();
  }
  /** Runs an action, which must call the given callback when it completes. */
  run(action: (callback: () => void) => void) {
    this.promise =
        this.promise.then(() => new Promise((resolve) => action(resolve)));
  }
  /** Runs a synchronous action after all preceding actions are done. */
  runSync(action: () => void) {
    this.run((cb) => (action(), cb()));
  }
}

function readFileJson(filename: string): Promise<object> {
  return new Promise((resolve, reject) => {
    readFile(filename, (err, data) => err ? reject(err) : resolve(data));
  }).then(JSON.parse);
}


const hello = http.createServer((req, res) => {
  console.error('HELLO!');
  res.writeHead(200, 'OK');
  res.end('Hello, ' + req.url);
});
hello.listen(8000);


(async () => {
  const config = FrontEnd.from(await readFileJson(process.argv[2]));
  // We've read the config file.
  // TODO(sdh): consider adding launch paths into the config
  //   so that this can run all the necessary subprocesses?
  // If we do that, then we could possibly ask the subprocesses to
  //   communicate back to us the random port they started on
  //   (server.address().port)
  // We could also take a lazy approach, only starting servers
  //   when needed. - may want a sort of /statusz in that case?
  const handler = (req: http.IncomingMessage, res: http.ServerResponse) => { 
    const url: Url = parseUrl(req.url || '');
    const domain = config.domains[url.hostname || req.headers['host'] || ''];
    if (!domain) {
      res.writeHead(404, 'Not Found');
      res.end('Not Found: ' + (() => {
        const a = [''];
        for (const k of Object.keys(req)) {
          try {
            a.push('  ' + k + ': ' + (req as any)[k]);
          } catch (e) {
            a.push('  ' + k + ': [???]');
          }
        }
        a.push('\nHeaders:');
        for (const k of Object.keys(req.headers)) {
          a.push('  ' + k + ': ' + req.headers[k]);
        }
        return a.join('\n');
          })());
      return;
    }
    const opts = {
      method: req.method,
      headers: req.headers,
      path: url.path,
      port: domain,
    };

    function once(s: Serializer, f: (cb: () => void) => void): () => void {
      return () => {
        s.run(f);
        f = () => {};
      };
    }
    const outgoing: http.ClientRequest = http.request(opts);
    // TODO(sdh): DefinitelyTyped seems to be missing this method?
    (outgoing as any).flushHeaders();
    const reqSerializer = new Serializer();
    const resSerializer = new Serializer();
    const endOut = once(reqSerializer, (cb) => outgoing.end(cb));
    //if (req.method == 'GET') endOut();
    const abortOut = once(reqSerializer, (cb) => (outgoing.abort(), cb()));
    req.on('data', (data) => {
      reqSerializer.run((cb) => outgoing.write(data.toString(), cb));
    });
    req.on('end', endOut);
    req.on('error', abortOut);
    req.on('close', endOut);
    req.on('aborted', abortOut);
    outgoing.on('error', () => req.destroy());
    outgoing.on('continue',
                () => resSerializer.runSync(() => res.writeContinue()));
    outgoing.on('response', (out: http.IncomingMessage) => {
      //console.dir(out);
      const endRes = once(resSerializer, (cb) => res.end(cb));
      const endOut = once(resSerializer, (cb) => (out.destroy(), cb()));
      res.writeHead(out.statusCode || 200, out.statusMessage, out.headers);
      out.on('end', endRes);
      out.on('error', endRes); // no abort?!?
      out.on('close', endRes);
      out.on('aborted', endRes);
      //out.on('close', logging('out resp close', endRes));
      res.on('close', once(resSerializer, (cb) => (out.destroy(), cb())));
      out.on('data', (data) => {
        resSerializer.run(cb => res.write(data.toString(), cb));
      });
      //if (req.method == 'GET') endRes();
    });
  };
  const server = http.createServer(handler);
  server.on('error', (err) => {
    // TODO - consider something different?
    console.error(err);
  });
  server.listen(config.port || 80);
})();
