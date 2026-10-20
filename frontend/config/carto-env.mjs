import {createDecipheriv} from 'node:crypto';
import {readFileSync} from 'node:fs';

export function cartoKeyDefine(env, keyFile) {
  if (env.VITE_CARTO_API_KEY || !env.CARTO_API_KEY_ENCRYPTED) return {};
  try {
    // Envelope: 12-byte IV, 16-byte authentication tag, then ciphertext.
    const envelope = Buffer.from(env.CARTO_API_KEY_ENCRYPTED, 'base64');
    if (envelope.length <= 28 || envelope.toString('base64') !== env.CARTO_API_KEY_ENCRYPTED) throw new Error();
    const decipher = createDecipheriv('aes-256-gcm', readFileSync(keyFile), envelope.subarray(0, 12));
    decipher.setAuthTag(envelope.subarray(12, 28));
    const apiKey = Buffer.concat([decipher.update(envelope.subarray(28)), decipher.final()]).toString('utf8');
    return {'import.meta.env.VITE_CARTO_API_KEY': JSON.stringify(apiKey)};
  } catch {
    throw new Error('Cannot decrypt CARTO configuration. Restore .runtime/carto-env.key or configure VITE_CARTO_API_KEY.');
  }
}
