require('source-map-support').install();

import {NameSilo} from './namesilo';
import {readFile} from '../async';
import {DnsConfig, DnsListRecordsReply} from './dns.pb';

function* objectEntries<T>(obj: {[key: string]: T}): IterableIterator<[string, T]> {
  for (const key of Object.keys(obj)) {
    yield [key, obj[key]];
  }
}

// NOTE: map is a Map from domains to iterables of subdomains.
function dynDns(ns: NameSilo, map: {[domain: string]: string[]}): void {
  for (const [domain, subs] of objectEntries(map)) {
    const dynDomains = new Set(subs);
    const results: Promise<any>[] = [];
    
    ns.dnsListRecords({domain}).then(
      ({request, reply}) => {
        if (!dynDomains.size) {
          console.log(JSON.stringify(reply, null, 2));
          return Promise.resolve([]);
        }        
        const myIp = request.ip;
        for (const rec of reply.resourceRecord) {
          //console.log(`CHECKING: ${JSON.stringify(rec, null, 2)}`);
          if (rec.host == domain) continue;
          let subDomain = rec.host!;
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
            const rrId = rec.recordId;
            const rrHost = subDomain;
            const rrValue = myIp;
            const rrTtl = rec.ttl;
            console.log(`Updating ${rrHost} to ${rrValue}`);
            results.push(
                ns.dnsUpdateRecord({domain, rrId, rrHost, rrValue, rrTtl}));
          }
        }
        return Promise.all(results);
      }).catch(e => console.error('something went wrong', e));
  }
}

(async () => {
  const config =
      DnsConfig.fromObject(JSON.parse(await readFile(process.argv[2])));
  const map: {[key: string]: string[]} = {};
  for (const domain of config.domains) {
    const parts = domain.split('.');
    const top = parts.slice(parts.length - 2).join('.');
    const bottom = parts.slice(0, parts.length - 2).join('.');
    map[domain] = map[domain] || [];
    map[domain].push(bottom);
  }
  dynDns(new NameSilo(config.key), map);
})();
