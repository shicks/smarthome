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
}

const NUMERIC = /[su]?(?:fixed|int)\d+|float|double/;

// Declared API for protobufs

// function dump(descriptor: Descriptor, prefix: string = ''): void {
//   for (const name in descriptor.fields) {
//     const field = descriptor.fields[name];
//     console.log(`${prefix}${field.repeated ? 'repeated ' : ''}${name}: ${field.type}`);
//     const sub = descriptor.root.lookup(field.type);
//     if (sub) {
//       dump(sub, prefix + '  ');
//     }
//   }
// }

// dump(FrontEnd as any);

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
        out[camel] = value.map(v => normalize(d, field.type, v));
      } else {
        out[camel] = normalize(d, field.type, value);
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


// export public class Xml2Proto<T> {
//   private ctor: ProtoCtor<T>;


//   private fields: {[k: string]: ProtoField};

//   constructor(ctor: ProtoCtor<T>, fields: {[k: string]: ProtoField}) {
//     this.ctor = ctor;
//     this.fields = fields;
//   }

//   public parse(xml: string): T {
//     const json: any = new X2JS().xml2js(xml);
//     // now normalize the json
//     return this.normalize(json, '');
//   }

//   private normalize(json: any, pos: string): any {
//     if (this.fields[pos] == 'array') {
//       if (!(json instanceof Array)) json = [json];
//       return json.map((elem) => this.normalize(elem, pos + '[]'));
//     } else if (this.fields[pos] == 'number') {
//       return Number(json);
//     }
//     let out = {};
//     for (const key in json) {
//       const prop = camelCase(key);
//       // TODO(sdh): continue if fields[pos+prop] == 'skip' ?
//       out[prop] = this.normalize(json[key], (pos ? pos + '.' : '') + prop);
//     }
//     return out;
//   }
// }
