import { afterEach, expect, it } from 'vitest';
import type { Request } from 'express';
import { clientAddress, clientRateKey } from './clientAddress';

function request(socket: string, headers: Record<string, string> = {}): Request {
  return { socket: { remoteAddress: socket }, headers, header(name: string) { return headers[name.toLowerCase()]; } } as unknown as Request;
}
afterEach(() => { delete process.env.FLY_APP_NAME; delete process.env.MENDEZ_OS_TRUST_FLY_PROXY; });

it('ignores spoofed proxy headers until explicitly behind a private Fly socket', () => {
  const privateSocket = request('10.1.2.3', { 'fly-client-ip': '8.8.8.8', 'x-forwarded-for': '1.1.1.1' });
  expect(clientAddress(privateSocket)).toBeNull();
  process.env.FLY_APP_NAME = 'mendez-test';
  expect(clientAddress(privateSocket)).toBeNull();
  process.env.MENDEZ_OS_TRUST_FLY_PROXY = 'true';
  expect(clientAddress(privateSocket)).toBe('8.8.8.8');
  expect(clientAddress(request('9.9.9.9', { 'fly-client-ip': '8.8.8.8' }))).toBe('9.9.9.9');
  expect(clientAddress(request('127.0.0.1', { 'fly-client-ip': '8.8.8.8' }))).toBeNull();
  expect(clientAddress(request('10.1.2.3', { 'fly-client-ip': '127.0.0.1' }))).toBeNull();
  expect(clientAddress(request('10.1.2.3', { 'x-forwarded-for': '8.8.8.8' }))).toBeNull();
});
it('gives distinct ephemeral rate buckets to visitors behind the same trusted Fly socket', () => {
  process.env.FLY_APP_NAME = 'mendez-test'; process.env.MENDEZ_OS_TRUST_FLY_PROXY = 'true';
  const salt = Buffer.alloc(24, 7);
  const first = clientRateKey(request('fdaa::3', { 'fly-client-ip': '8.8.8.8' }), salt);
  const second = clientRateKey(request('fdaa::3', { 'fly-client-ip': '1.1.1.1' }), salt);
  expect(first).not.toBe(second);
  expect(first).toMatch(/^[a-f0-9]{64}$/);
  expect(first).not.toContain('8.8.8.8');
});
