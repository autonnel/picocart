import { describe, expect, it } from 'vitest';
import { bucketBaseUrl } from '@/lib/adapters/storage/s3';

describe('bucketBaseUrl', () => {
  it('uses path-style for a plain endpoint', () => {
    expect(bucketBaseUrl('https://oss-cn-hongkong.aliyuncs.com/', 'maneki')).toBe('https://oss-cn-hongkong.aliyuncs.com/maneki');
  });

  it('keeps a virtual-hosted endpoint as is', () => {
    expect(bucketBaseUrl('https://maneki.oss-cn-hongkong.aliyuncs.com', 'maneki')).toBe('https://maneki.oss-cn-hongkong.aliyuncs.com');
  });
});
