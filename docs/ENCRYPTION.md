# 🔒 Environment Variable Encryption

## Overview

All deployment environment variables are automatically encrypted at rest using **AES-256-GCM** encryption with authenticated encryption. This ensures that sensitive data like API keys, database passwords, and tokens are securely stored in the database.

---

## 🔑 Encryption Details

### Algorithm: **AES-256-GCM**

- **AES-256**: Advanced Encryption Standard with 256-bit keys
- **GCM**: Galois/Counter Mode for authenticated encryption
- **PBKDF2**: Key derivation function with 100,000 iterations
- **SHA-256**: Hash function for key derivation

### Security Features

✅ **Authenticated Encryption**: Prevents tampering with encrypted data  
✅ **Random IV**: Each encryption uses a unique Initialization Vector  
✅ **Salt-based Key Derivation**: 64-byte random salt per encryption  
✅ **Authentication Tag**: 16-byte tag for integrity verification  
✅ **Backward Compatible**: Gracefully handles unencrypted data

---

## 🚀 Setup

### 1. Generate an Encryption Key

Generate a secure 32+ character encryption key:

```bash
# Using OpenSSL
openssl rand -base64 32

# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Using Python
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### 2. Set Environment Variable

Add to your `.env` or `.env.local`:

```bash
ENCRYPTION_KEY="your-generated-encryption-key-here-min-32-chars"
```

### 3. Restart Your Application

```bash
npm run dev
# or
bun dev
```

---

## ⚙️ How It Works

### Encryption Flow

```
User Input → API Route → encrypt() → Database
```

1. User provides environment variables in the UI
2. API route receives JSON object: `{ "API_KEY": "secret123" }`
3. Each value is encrypted individually: `{ "API_KEY": "salt:iv:tag:encrypted" }`
4. Encrypted JSON string is stored in database

### Decryption Flow

```
Database → decrypt() → Docker Container
```

1. Deployment manager retrieves encrypted data from database
2. Each value is decrypted: `{ "API_KEY": "secret123" }`
3. Decrypted values are passed as environment variables to Docker container
4. Containers receive plain-text environment variables (as expected)

### Encryption Format

Each encrypted value is stored as:

```
salt:iv:authTag:encryptedData
```

All components are base64-encoded:

- **salt** (64 bytes): Random salt for key derivation
- **iv** (16 bytes): Initialization vector
- **authTag** (16 bytes): Authentication tag for GCM
- **encryptedData**: The encrypted value

---

## 📝 Usage

### Creating a Deployment

When creating a deployment through the UI or API, environment variables are automatically encrypted:

```javascript
// Frontend sends plain-text
const envVars = {
  DATABASE_URL: "postgres://...",
  API_KEY: "sk-1234567890",
  SECRET_TOKEN: "my-secret-token"
};

// Backend encrypts before storing
POST /api/deployments
{
  "name": "My App",
  "envVars": JSON.stringify(envVars),
  ...
}
```

### Updating Environment Variables

```javascript
// API automatically encrypts new values
PATCH /api/deployments/:id
{
  "envVars": JSON.stringify({
    "NEW_VAR": "new-value",
    "API_KEY": "updated-key"
  })
}
```

### Viewing Environment Variables

```javascript
// API automatically decrypts when fetching
GET /api/deployments/:id

// Response includes decrypted values
{
  "deployment": {
    "envVars": "{\"API_KEY\":\"sk-1234567890\"}",
    ...
  }
}
```

---

## 🔧 API Reference

### `encrypt(text: string): string`

Encrypts a single string value.

```typescript
import { encrypt } from "@/lib/crypto";

const encrypted = encrypt("my-secret-value");
// Returns: "salt:iv:authTag:encryptedData"
```

### `decrypt(encryptedText: string): string`

Decrypts an encrypted string value.

```typescript
import { decrypt } from "@/lib/crypto";

const decrypted = decrypt("salt:iv:authTag:encryptedData");
// Returns: "my-secret-value"
```

### `encryptEnvVars(envVars: Record<string, string>): string`

Encrypts an object of environment variables and returns a JSON string.

```typescript
import { encryptEnvVars } from "@/lib/crypto";

const encrypted = encryptEnvVars({
  API_KEY: "secret123",
  DB_URL: "postgres://...",
});
// Returns: '{"API_KEY":"salt:iv:tag:data","DB_URL":"salt:iv:tag:data"}'
```

### `decryptEnvVars(encryptedJson: string): Record<string, string>`

Decrypts a JSON string of encrypted environment variables.

```typescript
import { decryptEnvVars } from "@/lib/crypto";

const decrypted = decryptEnvVars('{"API_KEY":"salt:iv:tag:data"}');
// Returns: { API_KEY: "secret123" }
```

---

## 🛡️ Security Best Practices

### ✅ DO

- **Generate a strong encryption key** (32+ characters, random)
- **Store the key in environment variables** (never in code)
- **Use different keys** for development, staging, and production
- **Rotate encryption keys periodically** (see Key Rotation section)
- **Restrict access** to the `ENCRYPTION_KEY` environment variable
- **Use secrets management** in production (AWS Secrets Manager, HashiCorp Vault, etc.)

### ❌ DON'T

- **Never commit the encryption key** to version control
- **Don't use default keys** in production
- **Don't share keys** between environments
- **Don't log decrypted values** in production
- **Don't store the key** in the database

---

## 🔄 Key Rotation

### When to Rotate

- **Regularly**: Every 90 days
- **After a security incident**
- **When an employee with access leaves**
- **If the key is potentially compromised**

### How to Rotate

1. **Backup your database** before starting
2. **Create a new encryption key**
3. **Update `ENCRYPTION_KEY`** in your environment
4. **Run a migration script** to re-encrypt all data:

```typescript
// scripts/rotate-encryption-key.ts
import { prisma } from "@/lib/db";
import { decryptEnvVars, encryptEnvVars } from "@/lib/crypto";

async function rotateKeys() {
  const OLD_KEY = process.env.OLD_ENCRYPTION_KEY!;
  const NEW_KEY = process.env.ENCRYPTION_KEY!;

  // Temporarily set old key for decryption
  process.env.ENCRYPTION_KEY = OLD_KEY;

  const deployments = await prisma.deployment.findMany({
    where: { envVars: { not: null } },
  });

  for (const deployment of deployments) {
    if (!deployment.envVars) continue;

    // Decrypt with old key
    const decrypted = decryptEnvVars(deployment.envVars);

    // Switch to new key
    process.env.ENCRYPTION_KEY = NEW_KEY;

    // Re-encrypt with new key
    const reEncrypted = encryptEnvVars(decrypted);

    await prisma.deployment.update({
      where: { id: deployment.id },
      data: { envVars: reEncrypted },
    });

    console.log(`✅ Re-encrypted: ${deployment.name}`);
  }

  console.log("🎉 All keys rotated successfully!");
}

rotateKeys();
```

4. **Run the script**:

```bash
OLD_ENCRYPTION_KEY="old-key" ENCRYPTION_KEY="new-key" tsx scripts/rotate-encryption-key.ts
```

---

## 🚨 Production Deployment

### Environment-Specific Keys

```bash
# Development (.env.local)
ENCRYPTION_KEY="dev-key-32-chars-or-longer-here"

# Staging (.env.staging)
ENCRYPTION_KEY="staging-key-32-chars-or-longer"

# Production (set in hosting provider)
ENCRYPTION_KEY="prod-key-from-secrets-manager"
```

### Using Secrets Managers

#### AWS Secrets Manager

```bash
# Store secret
aws secretsmanager create-secret \
  --name kalpana/encryption-key \
  --secret-string "your-encryption-key"

# Retrieve in code
import { SecretsManager } from "@aws-sdk/client-secrets-manager";

const client = new SecretsManager({ region: "us-east-1" });
const response = await client.getSecretValue({ SecretId: "kalpana/encryption-key" });
process.env.ENCRYPTION_KEY = response.SecretString;
```

#### Docker Secrets

```bash
# Create secret
echo "your-encryption-key" | docker secret create encryption_key -

# Use in docker-compose.yml
services:
  app:
    secrets:
      - encryption_key
    environment:
      ENCRYPTION_KEY_FILE: /run/secrets/encryption_key

secrets:
  encryption_key:
    external: true
```

---

## 🧪 Testing

### Test Encryption/Decryption

```typescript
import { encrypt, decrypt } from "@/lib/crypto";

const original = "my-secret-value";
const encrypted = encrypt(original);
const decrypted = decrypt(encrypted);

console.log(original === decrypted); // true
```

### Test Environment Variables

```typescript
import { encryptEnvVars, decryptEnvVars } from "@/lib/crypto";

const original = {
  API_KEY: "secret123",
  DB_URL: "postgres://localhost/db",
};

const encrypted = encryptEnvVars(original);
const decrypted = decryptEnvVars(encrypted);

console.log(JSON.stringify(original) === JSON.stringify(decrypted)); // true
```

---

## ❓ FAQ

### Q: What happens if I lose my encryption key?

**A:** Encrypted data cannot be recovered without the encryption key. Always back up your keys securely.

### Q: Can I change the encryption algorithm?

**A:** Yes, but you'll need to re-encrypt all existing data. AES-256-GCM is industry-standard and recommended.

### Q: Is the encryption key stored in the database?

**A:** No, the key is only stored in environment variables and never in the database.

### Q: What if my environment variables are not encrypted?

**A:** The system is backward-compatible. Unencrypted values will be handled gracefully and automatically encrypted on next update.

### Q: Does this encrypt data in transit?

**A:** No, this only encrypts data at rest in the database. Use HTTPS/TLS for data in transit.

### Q: What about database encryption?

**A:** This is application-level encryption. For additional security, enable database-level encryption (e.g., MongoDB encryption at rest).

---

## 📚 Additional Resources

- [NIST Guidelines on Encryption](https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines)
- [OWASP Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
- [Node.js Crypto Documentation](https://nodejs.org/api/crypto.html)

---

**🔐 Your deployment secrets are now protected!**
