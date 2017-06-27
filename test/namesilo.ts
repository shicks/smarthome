// Test NameSilo API.

import 'mocha';
import {HttpClient} from '../src/async';
import {NameSilo} from '../src/dns/namesilo';
import {Root} from 'protobufjs';
import * as chai from 'chai';

require('dirty-chai');

const expect = chai.expect;

const root = new Root();

before(() => {
  return root.load('../src/dns/dns.proto');
});

describe('NameSilo', () => {
  const {DnsListRecordsRequest, DnsListRecordsReply} = root as any;
  const {DnsUpdateRecordRequest, DnsUpdateRecordReply} = root as any;
  const client = HttpClient.fake();

  let ns: NameSilo;

  beforeEach(() => { ns = new NameSilo('secret', 'https://ns.api', client); });

  it('should send the right request for dnsListRecords', () => {
    client.expect(
        'https://ns.api?key=secret&version=1&type=xml&domain=example.com',
        `<namesilo><request><operation>op</operation><ip>1.2.3.4</ip></request>
         <reply><code>500</code><detail>testing</detail><resource_record>
         <type>AA</type><host>www</host>
         </resource_record></reply></namesilo>`);
    const resp = ns.dnsListRecords({domain: 'example.com'});
    expect((resp as any).toJSON()).to.eql({
      request: {operation: 'op', ip: '1.2.3.4'},
      code: 500, detail: 'testing',
      resourceRecord: [{type: 'AA', host: 'www'}]});
  });
});
