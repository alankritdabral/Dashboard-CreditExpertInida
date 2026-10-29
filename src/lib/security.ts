import crypto from 'crypto';

// The secrets are read directly from process.env at runtime
// to avoid Next.js static bundling issues.

/**
 * Creates a one-way deterministic hash of a string (e.g., PAN, Mobile)
 * used for lookup and rate-limiting without storing the plaintext.
 */
export function generateHmac(text: string): string {
  const secret = process.env.HMAC_SECRET;
  if (!secret) {
    throw new Error('HMAC_SECRET is not configured');
  }
  return crypto
    .createHmac('sha256', secret)
    .update(text)
    .digest('hex');
}

/**
 * Encrypts a string using AES-256-GCM. 
 * Returns the format: iv:authTag:encryptedData
 */
export function encrypt(text: string): string {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret || Buffer.from(secret, 'hex').length !== 32) {
    throw new Error('ENCRYPTION_SECRET must be a 32-byte hex string');
  }
  
  const key = Buffer.from(secret, 'hex');
  const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM
  
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag().toString('hex');
  
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts a string that was encrypted with encrypt()
 */
export function decrypt(encryptedText: string): string {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret || Buffer.from(secret, 'hex').length !== 32) {
    throw new Error('ENCRYPTION_SECRET must be a 32-byte hex string');
  }

  const key = Buffer.from(secret, 'hex');
  const [ivHex, authTagHex, dataHex] = encryptedText.split(':');
  
  if (!ivHex || !authTagHex || !dataHex) {
    throw new Error('Invalid encrypted text format');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(dataHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
