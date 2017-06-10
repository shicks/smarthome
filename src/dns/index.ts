require('source-map-support').install();

const X2JS = require('x2js');
const https = require('https');
const {readFile} = require('fs');

import {NameSilo} from './dns.pb';

function* objectEntries<T>(obj: {[key: string]: T}): Array<[string, T]> {
  for (const key of Object.keys(obj)) {
    yield [key, obj[key]];
  }
}

// TODO(sdh): pull this out into a common library
function readFileJson(filename: string): Promise<object> {
  return new Promise((resolve, reject) => {
    readFile(filename, (err, data) => err ? reject(err) : resolve(data));
  }).then(JSON.parse);
}

function apiRequest(api: string, args: {[key: string]: string|number}): any {
  const query = Object.keys(args).map(key => `${key}=${args[key]}`).join('&');
  const url = `https://www.namesilo.com/api/${api}?${query}`;
  return new Promise((resolve, reject) => {
    //console.log(`Sending query: ${url}`);
    https.get(url, (res) => {
      //console.log('Waiting on data');
      const chunks = [];
      res.on('data', (d) => { /*console.log('got chunk');*/ chunks.push(d) })
        .on('end', () => { /*console.log('got end');*/ resolve(new X2JS().xml2js(chunks.join(''))) });
    }).on('error', reject).end();
  });
}

let KEY: string = '';

function dnsListRecords(domain: string): any {
  return apiRequest('dnsListRecords', {
    version: 1,
    type: 'xml',
    key: KEY,
    domain});
}

function dnsUpdateRecord(
    domain: string, rrid: string, rrhost: string,
    rrvalue: string, rrttl: string): any {
  return apiRequest('dnsUpdateRecord', {
    version: 1,
    type: 'xml',
    key: KEY,
    domain, rrid, rrhost, rrvalue, rrttl});
}

// NOTE: map is a Map from domains to iterables of subdomains.
function dynDns(map: {[domain: string]: string[]}) {
  for (const [domain, subs] of objectEntries(map)) {
    const dynDomains = new Set(subs);
    const results = [];
    dnsListRecords(domain).then(
      ({namesilo: {request, reply}}) => {
        if (!dynDomains.size) {
          console.log(JSON.stringify(reply, null, 2));
          return null;
        }        
        const myIp = request.ip;
        for (const rec of reply.resource_record) {
          //console.log(`CHECKING: ${JSON.stringify(rec, null, 2)}`);
          if (rec.host == domain) continue;
          let subDomain = rec.host;
          for (;;) {
            const index = subDomain.length - domain.length - 1;
            if (subDomain.substring(index) != '.' + domain) break;
            subDomain = subDomain.substring(0, index);
          }
          if (subDomain == rec.host) {
            console.error('ERROR - bad domain: ' + rec.host);
            continue;
          }
          if (dynDomains.has(subDomain) &&
              (rec.value != myIp || rec.host != subDomain + '.' + domain)) {
            const rrid = rec.record_id;
            const rrhost = subDomain;
            const rrvalue = myIp;
            const rrttl = rec.ttl;
            console.log(`Updating ${rrhost} to ${rrvalue}`);
            results.push(
                dnsUpdateRecord(domain, rrid, rrhost, rrvalue, rrttl));
          }
        }
        return Promise.all(results);
      }).catch(e => console.error('something went wrong', e));
  }
}

(async () => {
  const config = NameSilo.from(await readFileJson(process.argv[2]));
  KEY = config.key;
  const map: {[key: string]: string[]} = {};
  for (const domain of config.domains) {
    const parts = domain.split('.');
    const top = parts.slice(parts.length - 2).join('.');
    const bottom = parts.slice(0, parts.length - 2).join('.');
    map[domain] = map[domain] || [];
    map[domain].push(bottom);
  }
  dynDns(map);
})();
