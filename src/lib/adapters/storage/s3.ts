import { AwsClient } from 'aws4fetch';

export interface EdgeS3Config {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

export class EdgeS3Client {
  private client: AwsClient;
  private endpoint: string;
  private bucket: string;

  constructor(config: EdgeS3Config) {
    this.client = new AwsClient({
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      service: 's3',
      region: config.region || 'auto',
    });
    this.endpoint = config.endpoint.replace(/\/$/, '');
    this.bucket = config.bucket;
  }

  private url(key: string): string {
    return `${this.endpoint}/${this.bucket}/${key}`;
  }

  async putObject(
    key: string,
    body: ArrayBuffer | Uint8Array | string,
    contentType: string,
    cacheControl?: string,
  ): Promise<void> {
    const headers: Record<string, string> = { 'Content-Type': contentType };
    if (cacheControl) headers['Cache-Control'] = cacheControl;
    const res = await this.client.fetch(this.url(key), {
      method: 'PUT',
      headers,
      body: body as BodyInit,
    });
    if (!res.ok) {
      throw new Error(`PutObject failed: ${res.status} ${await res.text()}`);
    }
  }

  async getObject(key: string): Promise<{ body: ArrayBuffer; contentType: string }> {
    const res = await this.client.fetch(this.url(key));
    if (!res.ok) {
      throw new Error(`GetObject failed: ${res.status}`);
    }
    return {
      body: await res.arrayBuffer(),
      contentType: res.headers.get('content-type') || 'application/octet-stream',
    };
  }

  async headObject(key: string): Promise<boolean> {
    const res = await this.client.fetch(this.url(key), { method: 'HEAD' });
    return res.ok;
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.fetch(this.url(key), { method: 'DELETE' });
  }

  async copyObject(sourceKey: string, destKey: string): Promise<void> {
    const res = await this.client.fetch(this.url(destKey), {
      method: 'PUT',
      headers: {
        'x-amz-copy-source': `/${this.bucket}/${sourceKey}`,
      },
    });
    if (!res.ok) {
      throw new Error(`CopyObject failed: ${res.status} ${await res.text()}`);
    }
  }

  async listObjects(
    prefix: string,
    maxKeys = 1000,
  ): Promise<{ key: string; size: number }[]> {
    const results: { key: string; size: number }[] = [];
    let continuationToken: string | undefined;

    do {
      let url = `${this.endpoint}/${this.bucket}?list-type=2&prefix=${encodeURIComponent(prefix)}&max-keys=${maxKeys}`;
      if (continuationToken) {
        url += `&continuation-token=${encodeURIComponent(continuationToken)}`;
      }

      const res = await this.client.fetch(url);
      const xml = await res.text();

      const keyMatches = xml.matchAll(/<Key>([^<]+)<\/Key>/g);
      const sizeMatches = xml.matchAll(/<Size>(\d+)<\/Size>/g);
      const keys = [...keyMatches].map((m) => m[1]);
      const sizes = [...sizeMatches].map((m) => parseInt(m[1]));

      keys.forEach((k, i) => results.push({ key: k, size: sizes[i] || 0 }));

      const isTruncated = xml.includes('<IsTruncated>true</IsTruncated>');
      const tokenMatch = xml.match(
        /<NextContinuationToken>([^<]+)<\/NextContinuationToken>/,
      );
      continuationToken =
        isTruncated && tokenMatch ? tokenMatch[1] : undefined;
    } while (continuationToken);

    return results;
  }

  async getSignedUploadUrl(
    key: string,
    contentType: string,
    expiresIn = 3600,
  ): Promise<string> {
    const url = new URL(this.url(key));
    url.searchParams.set('X-Amz-Expires', String(expiresIn));
    const signed = await this.client.sign(
      new Request(url.toString(), {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
      }),
      { aws: { signQuery: true } },
    );
    return signed.url;
  }

  async getSignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
    const url = new URL(this.url(key));
    url.searchParams.set('X-Amz-Expires', String(expiresIn));
    const signed = await this.client.sign(
      new Request(url.toString(), { method: 'GET' }),
      { aws: { signQuery: true } },
    );
    return signed.url;
  }
}
