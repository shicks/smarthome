import * as fs from 'fs';
import 'mocha';
import {exec} from 'child_process';
import {expect} from 'chai';
import {Database} from '../out/db';

// TODO(sdh): inject path of tmpdir
// TODO(sdh): detect whether -d /dev/shm - if not, run the following:
//    device = $(hdiutil attach -nomount ram://[size / 512b]
//    diskutil eraseVolume HFS+ RAMDisk $device
//    oncleanup = hdiutil detach $device

//  --- need to get tmp stuff working!


const diskFile = tmpname();
const memFile = tmpname();
const lockFile = memFile + '.lock';


// TODO - handle/test case where diskfile doesn't exist, either
//  -- (i.e. stat -> mtimeMs -> (catch -> 0)) for this case

const randomName = () => Math.random().toString(36).substring(2);


describe('Database', () => {
  // how to set up mocking?
  let mount: string|void;
  let tmpdir: string|void = '/dev/shm';

  before(() => new Promise((resolve, reject) => {
    fs.stat('/dev/shm', (err, stats) => {
      if (err) {
        reject(err);
      } else if (stats.isDirectory()) {
        resolve();
      } else {
        // next option: make a new mount point
        exec('hdiutil attach -nomount ram://20480', (err, out) => {
          if (err) {
            reject(err);
          } else {
            mount = out.replace(/\s+/g, '');
            let tmpname = randomName();
            tmpdir = `/Volumes/${tmpname}`;
            exec(`diskutil eraseVolume HFS+ ${tmpname} ${mount}`, (err) => {
              if (err) {
                reject(err);
              } else {
                resole();
              }
            });
          }
        });
      }
    });
  }));

  after(() => new Promise((resolve, reject) => {
    if (mount) {
      exec(`hdiutil detach ${mount}`, resolve);
    } else {
      resolve();
    }
  }));

  let clock: FakeClock|void;
  let dbPath: string|void;
  let db: Database|void;
  beforeEach(() => {
    clock = new FakeClock();
    dbPath = `${tmpdir}/${randomName()}`;
    db = new Database(dbPath, 10000, {clock, tmpdir});
  });

  // TODO(sdh): any need to use an afterEach to delete the file?

  it('should open a database', () => {
    return db.run((db) => new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('CREATE TABLE foo (bar TEXT, baz TEXT);');
        db.run('INSERT INTO foo VALUES ("ab", "cd");');
        db.run('INSERT INTO foo VALUES ("ef", "gh");');
        const results: Array<string> = [];
        db.each('SELECT bar, baz FROM foo', (err, row) => {
          if (err) reject(err);
          results.push(' '.join(row || []));
        }, () => resolve('|'.join(results)));
      });
    })).then(result => {
      assert.equal('ab cd|ef gh', result);
    });
  });
});
