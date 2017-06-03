import * as http from 'http';
import {readFile} from 'fs';

import {ConfigFile} from './config.pb';

// import {JsonObject, JsonMember, TypedJSON} from 'typedjson-npm';

// TODO(sdh): read the config file, which should have
// the following format:
//  {
//    "domains": {
//      "foo.bar.com": 8081,
//      ...
//    }
//  }


//     TypedJSON.config({
//         enableTypeHints: true
//     });

// class ConfigFile {
//   domains: {[domain: string]: number}
// }

// const opts = TypedJSON.parse('{"domains": {"foo": 42}}', ConfigFile);

function readFileJson(filename: string): Promise<object> {
  return new Promise((resolve, reject) => {
    readFile(filename, (err, data) => err ? reject(err) : resolve(data));
  }).then(JSON.parse);
}

(async () => {
  const config = ConfigFile.from(await readFileJson(process.argv[2]));
  // We've read the config file.
  


  console.dir(config);
  for (const domain of Object.keys(config.domains)) {
    console.log('key: ', domain);
  }
})();
