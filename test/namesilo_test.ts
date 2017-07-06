// Test NameSilo API.

import 'mocha';
import {HttpClient} from '../src/async';
import {NameSilo} from '../build/dns/namesilo';
import {DnsListRecordsRequest, DnsListRecordsReply, DnsUpdateRecordRequest, DnsUpdateRecordReply} from '../build/dns/dns.pb';
import {Root} from 'protobufjs';
import * as chai from 'chai';

require('dirty-chai');

const expect = chai.expect;

function url(base: string, ...args: string[]): string {
  return base + '?' + args.join('&');
}

describe('NameSilo', () => {
  // const {DnsListRecordsRequest, DnsListRecordsReply} = root as any;
  // const {DnsUpdateRecordRequest, DnsUpdateRecordReply} = root as any;
  const client = HttpClient.fake();

  let ns: NameSilo;

  beforeEach(() => { ns = new NameSilo('secret', 'https://ns.api', client); });

  it('should send the right request for dnsListRecords', async () => {
    client.expect(
        url('https://ns.api/dnsListRecords',
            'key=secret', 'version=1', 'type=xml', 'domain=example.com'),
        `<namesilo><request>
           <operation>dnsListRecords</operation>
           <ip>1.2.3.4</ip>
         </request><reply>
           <code>500</code><detail>testing</detail>
           <resource_record>
             <type>AA</type><host>www</host>
           </resource_record>
         </reply></namesilo>`);
    const resp: any = await ns.dnsListRecords({domain: 'example.com'});
    resp.reply = resp.reply.toJSON();
    expect(resp).to.eql({
      request: {operation: 'dnsListRecords', ip: '1.2.3.4'},
      code: 500, detail: 'testing',
      reply: {resourceRecord: [{type: 'AA', host: 'www'}]}});
  });

  it('should send the right request for dnsUpdateRecord', async () => {
    client.expect(
        url('https://ns.api/dnsUpdateRecord',
            'key=secret', 'version=1', 'type=xml', 'domain=example.com',
            'rrid=1a2b3', 'rrhost=test', 'rrvalue=2.3.4.5', 'rrttl=7207'),
        `<namesilo><request>
           <operation>dnsUpdateRecord</operation>
           <ip>1.2.3.4</ip>
         </request><reply>
           <code>500</code><detail>testing</detail>
           <record_id>1a2b3c4d5e</record_id>
         </reply></namesilo>`);
    const resp: any = await ns.dnsUpdateRecord({
      domain: 'example.com', rrId: '1a2b3', rrHost: 'test',
      rrValue: '2.3.4.5', rrTtl: 7207,
    });
    resp.reply = resp.reply.toJSON();
    expect(resp).to.eql({
      request: {operation: 'dnsUpdateRecord', ip: '1.2.3.4'},
      code: 500, detail: 'testing',
      reply: {recordId: '1a2b3c4d5e'}});
  });
});
