/**
 * Password hashing and verification using Web Crypto PBKDF2.
 * Format: base64(salt):iterations:base64(hash)
 */

const ITERATIONS = 100000;
const SALT_LENGTH = 16;
const HASH_LENGTH = 32;

function b64Encode(arr: ArrayBuffer | Uint8Array): string {
  const u8 = arr instanceof Uint8Array ? arr : new Uint8Array(arr);
  return btoa(String.fromCharCode(...u8));
}

function b64Decode(str: string): Uint8Array {
  const binary = atob(str);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return arr;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    key,
    HASH_LENGTH * 8
  );
  return `${b64Encode(salt)}:${ITERATIONS}:${b64Encode(bits)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltB64, iterStr, hashB64] = stored.split(':');
  if (!saltB64 || !iterStr || !hashB64) return false;
  const salt = b64Decode(saltB64);
  const iterations = parseInt(iterStr, 10);
  const expectedHash = b64Decode(hashB64);
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations,
      hash: 'SHA-256',
    },
    key,
    expectedHash.length * 8
  );
  const actual = new Uint8Array(bits as ArrayBuffer);
  if (actual.length !== expectedHash.length) return false;
  return actual.every((b, i) => b === expectedHash[i]);
}
