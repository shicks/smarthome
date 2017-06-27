// Converts xml to json that can be validated as a protobuf
// In particular, converts certain expected fields to arrays
// and numbers, and ensures camelCase fields.

const camelCase: (s: string) => string = require('camel-case');

// Protobuf constructor.

export interface Protobuf<T> {
  fromObject(obj: {[k: string]: any}): T;
  toObject(msg: T): {[k: string]: any};
  verify(obj: {[k: string]: any}): string|null;
}

// Reflection API for Protobufs.  This doesn't show up in any
// .d.ts files, but if using protobufjs/light, then all Proto<T>
// will also implement Descriptor.

interface DescriptorRoot {
  lookup(name: string): Descriptor|undefined;
}
interface DescriptorField {
  type: string;
  repeated: boolean;
}
interface Descriptor {
  fields: {[name: string]: DescriptorField};
  root: DescriptorRoot;
  values?: {[name: string]: number};
  valuesById?: {[id: number]: string};
}

const NUMERIC = /[su]?(?:fixed|int)\d+|float|double/;

export function normalizer<T>(proto: Protobuf<T>): (json: any) => T {

  function normalize(
      descriptor: Descriptor|void, typeName: string, json: any)
  : any {
    if (NUMERIC.test(typeName)) {
      return Number(json);
    } else if (typeName == 'string' || typeName == 'bytes') {
      return String(json);
    } else if (typeName == 'bool') {
      const lc = String(json).toLowerCase();
      if (lc == '0' || lc == 'false') return false;
      if (lc == '1' || lc == 'true') return true;
      throw new Error('Bad boolean vaue: ' + json);
    } else if (descriptor && descriptor.values && descriptor.valuesById
               && (typeof json == 'string' || typeof json == 'number')) {
      // an enum: look up string field or return number
      if (json in descriptor.valuesById) return Number(json);
      if (json in descriptor.values) return descriptor.values[json];
      // TODO(sdh): error?
      return undefined;
    }
    const out: {[k: string]: any} = {};
    for (const name in json) {
      const camel = camelCase(name);
      let value = json[name];
      const field = descriptor && descriptor.fields[camel];
      if (!field) {
        out[camel] = value;
        continue;
      }
      if (field.repeated && !(value instanceof Array)) {
        value = [value];
      }
      const d = descriptor!.root.lookup(field.type);
      if (value instanceof Array) {
        out[camel] = value.map(v => normalize(d, field.type, v)).filter(x => x);
      } else {
        value = normalize(d, field.type, value);
        if (value != null) out[camel] = value;
      }
    }
    return out;
  }

  return (json: any) => {
    json = normalize(proto as any, '', json);
    const err = proto.verify(json);
    if (err) throw new TypeError(err);
    return proto.fromObject(json);
  }
}
