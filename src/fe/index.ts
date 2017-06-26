require('source-map-support').install();

//////////////////
//
// Idea: need something to make sure various processes are running
// Q: do we actually want separate procs, or should we just integrate
//    everything right here?
// Some domains will point to external procs, like gogs
//  - will want to ensure it keeps running
//  - already need something to ensure whatever main server is running...
// Consideration:
//  - all-in-one process is more likely to crash from uncaught exception
//  - no need to bring everybody down in that case
//  - in event of a crash, best to log STDERR to crash file and then restart.
//  - would be nice to do intermediate logging to an in-memory filesystem,
//    so as not to wear out SSD. i.e. cicular buffer retaining last 20k but
//    dropping everything else
//    - can probably do this with node, child_process.spawn, especially w/
//      guarantees that nothing ever required on stdin
// Conclusion: make a simple node job that will run another task over and
// over again, and will dump failures to disk when necessary; could also
// add a signal handler to dump on-demand.  Also add timestamps?
//  - Given this, we'll want to pick static ports for everything.
//  - We could also use a single job to kick everything off?
//  - Alternatively, write PID and/or port to a /var/run file?
//    - /var/run/port/foo.bar.com
//
//////////////////


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

import * as express from 'express';
import * as request from 'request';
const letsencrypt: any = require('letsencrypt-express');
const redirect: any = require('redirect-https'); /// <reference path="./imports.d.ts" />
import * as http from 'http';
import * as https from 'https';
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
  const config = FrontEnd.fromObject(await readFileJson(process.argv[2]));
  // We've read the config file.
  // TODO(sdh): consider adding launch paths into the config
  //   so that this can run all the necessary subprocesses?
  // If we do that, then we could possibly ask the subprocesses to
  //   communicate back to us the random port they started on
  //   (server.address().port)
  // We could also take a lazy approach, only starting servers
  //   when needed. - may want a sort of /statusz in that case?

  const domains: {[domain: string]: number} = {};
  for (const server of config.servers) {
    console.dir(server);
    for (const domain of server.domains || []) {
      if (server.fixedPort) domains[domain] = server.fixedPort;
    }
  }
  console.dir(domains);


  const app = express();
  //app.listen(config.port);

  function approveDomains(opts: any, certs: any, cb: any) {
    console.error('approveDomains');
    console.dir({opts: opts, certs: certs});
    if (certs) {
      opts.domains = certs.altnames;
    } else {
      opts.email = 'stephenhicks@gmail.com';
      opts.agreeTos = true;
    }
    cb(null, {options: opts, certs: certs});
  }

  const lex = letsencrypt.create({
    approveDomains,
    domains: Object.keys(domains).filter(x => !/localhost/.test(x)),
    // server: 'staging',
    server: 'https://acme-v01.api.letsencrypt.org/directory',
  });

  http.createServer(lex.middleware(redirect())).listen(8080, function(this: any) {
    console.log("Listening for ACME http-01 challenges on", this.address());
  })

  app.all('/*', function(req, res) {
    const url: Url = parseUrl(req.url || '');
    const domain = domains[url.host || req.headers['host'] || ''];
    console.error('HANDLING REQUEST: ' + url);
    if (!domain) {
      res.status(404).send('Not Found: url.host=' + url.host + ', host header=' + req.headers['host']);
      return;
    }
    const opts = {
      url: 'http://localhost:' + domain + req.url,
      qs: req.query,
      method: req.method,
      headers: req.headers,
      //port: domain,
    };
    req.pipe(request(opts, (error, response, body) => {
      if (!error) return;
      if (error.code == 'ECONNREFUSED') console.error('Refused connection');
      else throw error;
    })).pipe(res);
  });

  https.createServer(lex.httpsOptions, lex.middleware(app)).listen(4430, function(this: any) {
    console.log("Listening for ACME tls-sni-01 challenges and serve app on", this.address());
  });
})();
