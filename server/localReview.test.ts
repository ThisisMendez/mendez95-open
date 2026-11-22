import { afterEach, expect, it } from 'vitest';
import type { Request } from 'express';
import { isLocalReview } from './localReview';

const environment = { node: process.env.NODE_ENV, review: process.env.MENDEZ_OS_LOCAL_REVIEW };
afterEach(() => {
  if (environment.node === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = environment.node;
  if (environment.review === undefined) delete process.env.MENDEZ_OS_LOCAL_REVIEW; else process.env.MENDEZ_OS_LOCAL_REVIEW = environment.review;
});
const request = (remoteAddress: string) => ({ socket: { remoteAddress } }) as Request;
it('requires an explicit local-only development flag and actual loopback socket', () => {
  process.env.NODE_ENV = 'development';
  delete process.env.MENDEZ_OS_LOCAL_REVIEW;
  expect(isLocalReview(request('127.0.0.1'))).toBe(false);
  process.env.MENDEZ_OS_LOCAL_REVIEW = '1';
  expect(isLocalReview(request('127.0.0.1'))).toBe(true);
  expect(isLocalReview(request('::1'))).toBe(true);
  expect(isLocalReview(request('::ffff:127.0.0.1'))).toBe(true);
  expect(isLocalReview(request('10.0.0.4'))).toBe(false);
  expect(isLocalReview(request('203.0.113.7'))).toBe(false);
  process.env.NODE_ENV = 'production';
  expect(isLocalReview(request('127.0.0.1'))).toBe(false);
});
