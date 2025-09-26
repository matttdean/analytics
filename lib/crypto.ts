import crypto from 'node:crypto'

const key = Buffer.from(process.env.ENCRYPTION_KEY_BASE64!, 'base64')

export function encrypt(plaintext: string) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return { cipher: enc.toString('base64'), iv, tag }
}

export function decrypt(cipherB64: string, iv: Buffer, tag: Buffer) {
  // Ensure tag is exactly 16 bytes (GCM auth tag length)
  let authTag = tag
  if (tag.length !== 16) {
    if (tag.length === 24) {
      // If it's 24 bytes, it might be base64 encoded - try to decode
      try {
        authTag = Buffer.from(tag.toString(), 'base64')
      } catch {
        // If that fails, truncate to 16 bytes (not ideal but might work)
        authTag = tag.slice(0, 16)
      }
    } else if (tag.length > 16) {
      // Truncate to 16 bytes
      authTag = tag.slice(0, 16)
    } else {
      // Pad with zeros if too short
      authTag = Buffer.concat([tag, Buffer.alloc(16 - tag.length)])
    }
  }

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)
  
  try {
    const dec = Buffer.concat([
      decipher.update(Buffer.from(cipherB64, 'base64')),
      decipher.final(),
    ])
    return dec.toString('utf8')
  } catch (error) {
    throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}