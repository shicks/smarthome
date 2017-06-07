require('source-map-support').install();
import * as sqlite3 from 'sqlite3';
import * as http from 'http';

const db = new sqlite3.Database('foo.db');
db.serialize(() => {
  db.run('PRAGMA journal_mode=WAL');
  db.run('CREATE TABLE IF NOT EXISTS foo (id TEXT, count INTEGER);')
  db.run('INSERT INTO foo VALUES ($id, $count);', 'foo', 2);
  console.log('created db');
});

