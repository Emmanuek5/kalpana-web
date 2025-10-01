import crypto from "crypto";

/**
 * Encryption/Decryption utility for sensitive data
 * Uses AES-256-GCM for authenticated encryption
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 16 bytes for AES
const AUTH_TAG_LENGTH = 16; // 16 bytes for GCM authentication tag
const SALT_LENGTH = 64; // 64 bytes for key derivation salt

/**
 * Gets the encryption key from environment variable
 * Falls back to a default key in development (NOT SECURE FOR PRODUCTION)
 */
function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "ENCRYPTION_KEY environment variable is required in production"
      );
    }
    console.warn(
      "⚠️  WARNING: Using default encryption key. Set ENCRYPTION_KEY in production!"
    );
    return "dev-encryption-key-please-change-in-production-min-32-chars";
  }

  if (key.length < 32) {
    throw new Error("ENCRYPTION_KEY must be at least 32 characters long");
  }

  return key;
}

/**
 * Derives a 256-bit key from the encryption key using PBKDF2
 */
function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, 100000, 32, "sha256");
}

/**
 * Encrypts a string value
 * @param text - Plain text to encrypt
 * @returns Encrypted string in format: salt:iv:authTag:encryptedData (all base64)
 */
export function encrypt(text: string): string {
  if (!text) return text;

  try {
    const encryptionKey = getEncryptionKey();

    // Generate random salt for key derivation
    const salt = crypto.randomBytes(SALT_LENGTH);

    // Derive key from password and salt
    const key = deriveKey(encryptionKey, salt);

    // Generate random IV
    const iv = crypto.randomBytes(IV_LENGTH);

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    // Encrypt
    let encrypted = cipher.update(text, "utf8", "base64");
    encrypted += cipher.final("base64");

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    // Return format: salt:iv:authTag:encryptedData
    return [
      salt.toString("base64"),
      iv.toString("base64"),
      authTag.toString("base64"),
      encrypted,
    ].join(":");
  } catch (error) {
    console.error("Encryption error:", error);
    throw new Error("Failed to encrypt data");
  }
}

/**
 * Decrypts an encrypted string
 * @param encryptedText - Encrypted string in format: salt:iv:authTag:encryptedData
 * @returns Decrypted plain text
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) return encryptedText;

  try {
    // Check if the text is already in the encrypted format
    const parts = encryptedText.split(":");
    if (parts.length !== 4) {
      // Assume it's unencrypted (for backward compatibility)
      console.warn(
        "⚠️  Decrypting unencrypted data - migrating to encrypted format"
      );
      return encryptedText;
    }

    const encryptionKey = getEncryptionKey();

    // Parse the encrypted data
    const [saltBase64, ivBase64, authTagBase64, encrypted] = parts;
    const salt = Buffer.from(saltBase64, "base64");
    const iv = Buffer.from(ivBase64, "base64");
    const authTag = Buffer.from(authTagBase64, "base64");

    // Derive key from password and salt
    const key = deriveKey(encryptionKey, salt);

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    // Decrypt
    let decrypted = decipher.update(encrypted, "base64", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    console.error("Decryption error:", error);
    throw new Error(
      "Failed to decrypt data - data may be corrupted or key is incorrect"
    );
  }
}

/**
 * Encrypts an object of environment variables
 * @param envVars - Object with environment variables
 * @returns JSON string of encrypted environment variables
 */
export function encryptEnvVars(envVars: Record<string, string>): string {
  if (!envVars || Object.keys(envVars).length === 0) {
    return JSON.stringify({});
  }

  const encrypted: Record<string, string> = {};
  for (const [key, value] of Object.entries(envVars)) {
    encrypted[key] = encrypt(value);
  }

  return JSON.stringify(encrypted);
}

/**
 * Decrypts a JSON string of environment variables
 * @param encryptedJson - JSON string of encrypted environment variables
 * @returns Object with decrypted environment variables
 */
export function decryptEnvVars(encryptedJson: string): Record<string, string> {
  if (!encryptedJson) {
    return {};
  }

  try {
    const encrypted = JSON.parse(encryptedJson);
    const decrypted: Record<string, string> = {};

    for (const [key, value] of Object.entries(encrypted)) {
      if (typeof value === "string") {
        decrypted[key] = decrypt(value);
      }
    }

    return decrypted;
  } catch (error) {
    console.error("Error decrypting env vars:", error);
    // Return empty object on error rather than crashing
    return {};
  }
}
