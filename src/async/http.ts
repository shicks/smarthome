import * as https from 'https';

export abstract class HttpClient {
  public abstract get(url: string): Promise<string>;

  public static of(lambda: (url: string) => Promise<string>): HttpClient {
    return new LambdaClient(lambda);
  }

  public static https(): HttpClient {
    return new HttpsClient();
  }

  public static fake(expectations: {[url: string]: string} = {}): FakeClient {
    return new FakeClient(expectations);
  }
}

class LambdaClient extends HttpClient {
  constructor(private readonly lambda: (url: string) => Promise<string>) {
    super();
  }

  public get(url: string): Promise<string> {
    return this.lambda(url);
  }
}

class HttpsClient extends HttpClient {
  public get(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      https.get(url, (res: any) => {
        const chunks: string[] = [];
        res.on('data', (chunk: string) => { chunks.push(chunk); });
        res.on('end', () => { resolve(chunks.join('')); });
      }).on('error', reject).end();
    });
  }
}

class FakeClient extends HttpClient {
  private readonly expectations: {[url: string]: string} = {};

  constructor (expectations: {[url: string]: string}) {
    super();
    // TODO(sdh): support arrays for different results?
    for (const url in expectations) {
      this.expectations[normalize(url)] = expectations[url];
    }
  }

  public expect(url: string, result: string) {
    this.expectations[normalize(url)] = result;
  }

  public get(url: string): Promise<string> {
    const result = this.expectations[normalize(url)];
    return result ? Promise.resolve(result) :
        Promise.reject(new Error(`Unexpected URL: ${url}`));
  }
}

function normalize(url: string): string {
  const [path, query] = url.split('?');
  if (!query) return url;
  const params = query.split('&');
  params.sort();
  return `${path}?${params.join('&')}`; 
}
