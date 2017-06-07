import * as subtle from 'subtle';
import {sqlite3} from 'sqlite3';
import * as base64 from 'base64-js';

// need separate keys for encrypting/decrypting (note: two-way)
// and for signing (note: one-way - only client signs)
//  -- client generates a signing key and encryption key, sends
//     result to server that keeps them together
//  -- server also has own public key available for free.

const RSA_ALG = {
  // todo - try AES-GCM which should be pretty fast? - raw import/export?
  // current subtle lib doesn't seem to work
  //  -- https://gist.github.com/chrisveness/43bcda93af9f646d083fad678071b90a
  name: 'RSA-OAEP',
  modulusLength: 2048,
  publicExponent: new Uint8Array([1,0,1]),
  hash: {name: 'SHA-256'},
};

export class KeyPair {
  public static async create(): Promise<KeyPair> {
    const serverKey =
        await subtle.generateKey(RSA_ALG, true, ['encrypt', 'decrypt']);
    const privateKey =
        (await subtle.exportKey('pkcs8', serverKey.privateKey))
            .toString('base64');
    const publicKey =
        (await subtle.exportKey('spki', serverKey.publicKey))
            .toString('base64');
    
    // other side...
    const privKey = await subtle.importKey(
        'pkcs8', base64.toByteArray(privateKey),
        RSA_ALG, true, ['decrypt']);
    const pubKey = await subtle.importKey(
        'spki', base64.toByteArray(privateKey),
        RSA_ALG, true, ['encrypt']);

    const message = base64.toByteArray(btoa('foo bar baz'));
    const cyphertext = await subtle.encrypt(RSA_ALG, pubKey, message);
    const decoded = await subtle.decrypt(RSA_ALG, privKey, cyphertext);

    // NOTE: seems to be a limit of 190 chars or so to encrypt.
    //  - what determines that length?
    // https://crypto.stackexchange.com/questions/42097/what-is-the-maximum-size-of-the-plaintext-message-for-rsa-oaep
    //  - sha-256 has 66 bytes overhead, leaving 190 from the 256 block

  }

  // Load keypair from database, or else create one.
  public static load(): Promise<KeyPair> {


  }
}

export class PubKey {

  
}
