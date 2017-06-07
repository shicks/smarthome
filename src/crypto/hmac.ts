import {createHmac} from 'crypto';

export function sign(message: string, nonce: string, secret: string): string {
  const hmac = createHmac('sha1', secret);
  hmac.update(message + ' ' + nonce);
  return hmac.digest('base64');
  // TODO(sdh): url-safe, by replacing (+ -> _), (/ -> -), and (= -> ).
}
