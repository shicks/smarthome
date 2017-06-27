import {VError} from 'verror';

export function wrapError<T>(promise: Promise<T>, message: string): Promise<T> {
  return promise.then(
      (result) => result,
      (err) => Promise.reject(new VError(err, message)));
}
