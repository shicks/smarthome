// NameSilo API
import {HttpClient} from '../async';
import {normalizer, Protobuf} from '../protobuf';
import {DnsListRecordsReply, DnsUpdateRecordReply, IDnsListRecordsRequest, IDnsUpdateRecordRequest} from './dns.pb';
import {Message} from 'protobufjs/light';

const X2JS: any = require('x2js');

interface RequestProto {
  toJSON(): {[key: string]: any};
}

type Response<T> = {
  request: {
    operation: string,
    ip: string,
  },
  code: number,
  detail: string,
  reply: T,
};

const DEFAULT_BASEURL = 'https://www.namesilo.com/api';

export class NameSilo {

  constructor(
      private readonly key: string,
      private readonly baseUrl: string = DEFAULT_BASEURL,
      private readonly client: HttpClient = HttpClient.https()) {}

  public dnsListRecords(req: IDnsListRecordsRequest)
  : Promise<Response<DnsListRecordsReply>> {
    return this.apiRequest('dnsListRecords', req, DnsListRecordsReply);
  }

  public dnsUpdateRecord(req: IDnsUpdateRecordRequest)
  : Promise<Response<DnsUpdateRecordReply>> {
    return this.apiRequest('dnsUpdateRecord', req, DnsUpdateRecordReply);
    
  }

  private apiRequest<T>(
      api: string,
      args: any,
      reply: Protobuf<T>)
  : Promise<Response<T>> {
    const normalize = normalizer(reply);
    // TODO - figure out supertype for message objects
    const argsObj =
        args instanceof Message ? args.toJSON() : Object.assign({}, args);
    argsObj['key'] = this.key;
    argsObj['type'] = 'xml';
    argsObj['version'] = 1;
    const query =
        Object.keys(argsObj)
            .map(key => `${key.toLowerCase()}=${argsObj[key]}`)
            .join('&');
    const url = `${this.baseUrl}/${api}?${query}`;
    return this.client.get(url).then(xml => {
      const json = new X2JS().xml2js(xml).namesilo;
      const code = Number(json.reply.code);
      const detail = json.reply.detail as string;
      delete json.reply.code;
      delete json.reply.detail;
      return {
        code, detail,
        request: json.request,
        reply: reply.fromObject(normalize(json.reply)),
      };
    });
  }
}
