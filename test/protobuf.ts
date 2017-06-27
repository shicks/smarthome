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

  it('should handle repeated primitive fields', () => {
    const Foo: any = pb('message Foo { repeated string field = 1; }').Foo;
    const n = normalizer(Foo);

    expect(json(n({field: ['x', 'y', 'z']}))).to.eql({field: ['x', 'y', 'z']});
    expect(json(n({field: ['x']}))).to.eql({field: ['x']});
    expect(json(n({field: 'x'}))).to.eql({field: ['x']});
  });

  it('should handle repeated message fields', () => {
    const Foo: any = pb(`
      message Foo { repeated Bar bar = 1; }
      message Bar { string baz = 1; }
    `).Foo;
    const n = normalizer(Foo);

    expect(json(n({bar: [{baz: 'x'}, {baz: 'y'}]})))
      .to.eql({bar: [{baz: 'x'}, {baz: 'y'}]});
    expect(json(n({bar: {baz: 'x'}}))).to.eql({bar: [{baz: 'x'}]});
  });

  it('should support nested types', () => {
    const Foo: any = pb(`
      message Foo {
        Bar bar = 1;
        message Bar {
          Baz baz = 2;
          message Baz {
            repeated double qux = 3;
          }
        }
      }
    `).Foo;
    const n = normalizer(Foo);

    expect(json(n({}))).to.eql({});
    expect(json(n({bar: {}}))).to.eql({bar: {}});
    expect(json(n({bar: {baz: {}}}))).to.eql({bar: {baz: {}}});
    expect(json(n({bar: {baz: {qux: ['1', '2']}}})))
        .to.eql({bar: {baz: {qux: [1, 2]}}});
    expect(json(n({bar: {baz: {qux: '1'}}}))).to.eql({bar: {baz: {qux: [1]}}});
  });

  it('should handle multiple fields of different types', () => {
    const Foo: any = pb(`
      message Foo {
        string foo = 1;
        uint32 bar = 2;
        double baz = 3;
        bool qux = 4;
      }
    `).Foo;
    const n = normalizer(Foo);

    expect(json(n({foo: 'x', bar: '4'}))).to.eql({foo: 'x', bar: 4});
    expect(json(n({baz: '.1', qux: 'false'}))).to.eql({baz: .1, qux: false});
  });

  it('should handle enums', () => {
    const Foo: any = pb(`
      message Foo {
        Bar bar = 1;
        enum Bar {
          BAZ = 1;
          QUX = 2;
        }
      }
    `).Foo;
    const n = normalizer(Foo);

    expect(json(n({bar: '1'}))).to.eql({bar: 'BAZ'});
    expect(json(n({bar: '2'}))).to.eql({bar: 'QUX'});
    expect(json(n({bar: 'BAZ'}))).to.eql({bar: 'BAZ'});
    expect(json(n({bar: 'QUX'}))).to.eql({bar: 'QUX'});
    expect(json(n({bar: 'BLEE'}))).to.eql({});
  });
});
