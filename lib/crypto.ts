/**
 * AES-256-GCM 암호화 유틸리티
 * 문서24 계정 비밀번호 등 민감 데이터 암호화/복호화
 */
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function getKey(): Buffer {
  const keyHex = process.env.DOC24_ENCRYPTION_KEY?.trim();
  if (!keyHex || keyHex.length !== 64) {
    throw new Error(
      `DOC24_ENCRYPTION_KEY error: exists=${!!keyHex}, length=${keyHex?.length ?? 0}, expected=64`
    );
  }
  return Buffer.from(keyHex, 'hex');
}

export function encrypt(plaintext: string): { encrypted: string; iv: string; tag: string } {
  const key = getKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return { encrypted, iv: iv.toString('hex'), tag };
}

export function decrypt(encrypted: string, ivHex: string, tagHex: string): string {
  const key = getKey();
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
