// Test protobuf normalization.

import 'mocha';
import {parse, Root} from 'protobufjs';
import {normalizer} from '../src/protobuf';
import * as chai from 'chai';

require('dirty-chai');

const expect = chai.expect;

function pb(spec: string): any {
  const root = new Root();
  parse('syntax = "proto3";\n' + spec, root);
  return root;
}

function json(proto: any): any {
  return proto.toJSON();
}

describe('normalizer()', () => {


  it('should work when no conversion is necessary', () => {
    const Foo: any = pb('message Foo { uint32 foo = 1; }').Foo;
    const n = normalizer(Foo);

    const foo: any = n({foo: '1'});
    expect(json(foo)).to.eql({foo: 1});
    expect(foo.$type).to.equal(Foo);
    // expect(() => n({foo: 'foo'})).to.throw(TypeError);
  });

  it('should convert underscore to camelcase', () => {
    const Foo: any = pb('message Foo { string foo_bar = 1; }').Foo;
    const n = normalizer(Foo);

    expect(json(n({foo_bar: 'baz'}))).to.eql({fooBar: 'baz'});
    expect(json(n({fooBar: 'qux'}))).to.eql({fooBar: 'qux'});
  });


});
