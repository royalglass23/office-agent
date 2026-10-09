import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";

function parseKey(encodedKey: string): Buffer {
  const key = Buffer.from(encodedKey, "base64");
  if (key.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes");
  return key;
}

export function encryptToken(plaintext: string, encodedKey: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", parseKey(encodedKey), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptToken(envelope: string, encodedKey: string): string {
  const [version, ivPart, tagPart, ciphertextPart, extra] = envelope.split(".");
  if (version !== VERSION || !ivPart || !tagPart || !ciphertextPart || extra) {
    throw new Error("Invalid encrypted-token envelope");
  }
  const decipher = createDecipheriv("aes-256-gcm", parseKey(encodedKey), Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
