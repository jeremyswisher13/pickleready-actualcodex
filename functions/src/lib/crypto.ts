import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";

const getEncryptionKey = () => {
  const secret = process.env.TOKEN_ENCRYPTION_KEY;

  if (!secret) {
    throw new Error("Missing TOKEN_ENCRYPTION_KEY environment variable.");
  }

  return createHash("sha256").update(secret).digest();
};

export const encryptSecret = (plainText: string) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
};

export const decryptSecret = (value: string) => {
  const parts = value.split(".");

  if (parts.length !== 3) {
    return value;
  }

  const [ivPart, tagPart, encryptedPart] = parts;
  const decipher = createDecipheriv(ALGORITHM, getEncryptionKey(), Buffer.from(ivPart, "base64"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, "base64")),
    decipher.final()
  ]);

  return decrypted.toString("utf8");
};
