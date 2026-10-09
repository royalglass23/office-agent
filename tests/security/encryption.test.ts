import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptToken, encryptToken } from "@/lib/security/encryption";

describe("token encryption", () => {
  it("round-trips with authenticated AES-GCM and random nonces", () => {
    const key = randomBytes(32).toString("base64");
    const first = encryptToken("secret-token", key);
    const second = encryptToken("secret-token", key);
    expect(first).not.toBe(second);
    expect(decryptToken(first, key)).toBe("secret-token");
  });

  it("rejects tampered ciphertext", () => {
    const key = randomBytes(32).toString("base64");
    const envelope = encryptToken("secret-token", key);
    const tampered = `${envelope.slice(0, -1)}${envelope.endsWith("A") ? "B" : "A"}`;
    expect(() => decryptToken(tampered, key)).toThrow();
  });
});
