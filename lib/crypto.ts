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
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  const dec = Buffer.concat([
    decipher.update(Buffer.from(cipherB64, 'base64')),
    decipher.final(),
  ])
  return dec.toString('utf8')
}