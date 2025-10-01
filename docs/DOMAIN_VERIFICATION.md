# 🔐 Domain Verification Guide

## How It Works

When you add a domain to Kalpana, you need to **prove you own it** before you can use it for deployments. This is done via **DNS TXT record verification**.

---

## 📋 Verification Flow

### 1. Add Domain

When you add a domain via the UI or API:

```typescript
// POST /api/domains
{
  "domain": "example.com"
}

// System generates a unique verification token:
{
  "id": "abc123",
  "domain": "example.com",
  "verified": false,
  "verificationToken": "f4a3b2c1d5e6f7g8h9i0j1k2l3m4n5o6..."  // 64-char hex
}
```

### 2. Add DNS TXT Record

You need to add this token to your domain's DNS settings:

**DNS Record Type:** `TXT`  
**Name/Host:** `@` or `example.com` (root domain)  
**Value/Content:** `kalpana-verify=f4a3b2c1d5e6f7g8h9i0j1k2l3m4n5o6...`

### 3. Verify Domain

After adding the DNS record, click "Verify" in the UI:

```typescript
// POST /api/domains/:id/verify

// System does DNS lookup:
dns.resolveTxt("example.com")
// → ["kalpana-verify=f4a3b2c1d5e6f7g8h9i0j1k2l3m4n5o6..."]

// If found and matches:
{
  "verified": true,
  "verifiedAt": "2025-10-01T12:00:00Z"
}
```

---

## 🌐 Setting Up DNS Records (Production)

### Step-by-Step Guide

#### 1. Get Your Verification Token

When you add a domain, the system displays your verification token. **Copy it!**

```
Domain: example.com
Token: kalpana-verify=f4a3b2c1d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7a8b9c0d1e2
```

#### 2. Log Into Your DNS Provider

Go to your domain registrar or DNS provider:

- **Namecheap:** https://www.namecheap.com/myaccount/login
- **GoDaddy:** https://sso.godaddy.com
- **Cloudflare:** https://dash.cloudflare.com
- **Google Domains:** https://domains.google.com
- **AWS Route 53:** https://console.aws.amazon.com/route53

#### 3. Add TXT Record

**Example for Cloudflare:**

1. Go to your domain → **DNS** → **Records**
2. Click **Add record**
3. Fill in:
   - **Type:** `TXT`
   - **Name:** `@` (or leave blank for root domain)
   - **Content:** `kalpana-verify=f4a3b2c1d5e6f7g8h9i0j1k2l3m4n5o6...`
   - **TTL:** `Auto` or `300` (5 minutes)
4. Click **Save**

**Example for Namecheap:**

1. Go to **Domain List** → Select your domain → **Advanced DNS**
2. Under **Host Records**, click **Add New Record**
3. Fill in:
   - **Type:** `TXT Record`
   - **Host:** `@`
   - **Value:** `kalpana-verify=f4a3b2c1d5e6f7g8h9i0j1k2l3m4n5o6...`
   - **TTL:** `Automatic` or `300`
4. Click **Save**

**Example for GoDaddy:**

1. Go to **My Products** → **DNS**
2. Scroll to **Records** → Click **Add**
3. Fill in:
   - **Type:** `TXT`
   - **Name:** `@`
   - **Value:** `kalpana-verify=f4a3b2c1d5e6f7g8h9i0j1k2l3m4n5o6...`
   - **TTL:** `600` (10 minutes)
4. Click **Save**

#### 4. Wait for DNS Propagation

DNS changes can take **5 minutes to 48 hours** to propagate globally.

**Check propagation status:**

```bash
# Linux/Mac
dig +short TXT example.com

# Windows
nslookup -type=TXT example.com

# Expected output:
# "kalpana-verify=f4a3b2c1d5e6f7g8h9i0j1k2l3m4n5o6..."
```

**Online tools:**

- https://dnschecker.org
- https://www.whatsmydns.net

#### 5. Verify in Kalpana

Once DNS has propagated:

1. Go to your **Domains** page
2. Click **Verify** on your domain
3. System checks DNS and marks as verified ✅

---

## 🧪 Testing Locally (Skip Verification)

For **local testing**, you can bypass DNS verification:

### Option 1: Manual Database Update (Quick & Dirty)

```javascript
// Connect to MongoDB
mongosh "mongodb://localhost:27017/kalpana"

// Find your domain
db.Domain.find({ domain: "kalpana.local" })

// Mark as verified manually
db.Domain.updateOne(
  { domain: "kalpana.local" },
  {
    $set: {
      verified: true,
      verifiedAt: new Date()
    }
  }
)
```

### Option 2: Add Test Endpoint (Recommended)

Create a bypass route for development:

```typescript
// app/api/domains/[id]/verify-dev/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";

// DEV ONLY: Skip DNS verification for local testing
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Only allow in development
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Not available in production" },
      { status: 403 }
    );
  }

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const domain = await prisma.domain.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!domain) {
    return NextResponse.json({ error: "Domain not found" }, { status: 404 });
  }

  // Mark as verified without DNS check
  const updated = await prisma.domain.update({
    where: { id },
    data: {
      verified: true,
      verifiedAt: new Date(),
    },
  });

  return NextResponse.json({
    domain: updated,
    message: "Domain verified (dev mode - no DNS check)",
  });
}
```

Then use it:

```bash
# Verify domain without DNS check (dev only)
curl -X POST http://localhost:3000/api/domains/YOUR_DOMAIN_ID/verify-dev \
  -H "Cookie: better-auth.session_token=YOUR_SESSION"
```

### Option 3: Modify Verification Logic

Add a local domain bypass in the verify route:

```typescript
// app/api/domains/[id]/verify/route.ts

// Add at the top of the verification logic:
const isLocalDomain =
  domain.domain.endsWith(".local") ||
  domain.domain.endsWith(".localhost") ||
  process.env.NODE_ENV === "development";

if (isLocalDomain) {
  // Skip DNS check for local testing
  const updated = await prisma.domain.update({
    where: { id },
    data: {
      verified: true,
      verifiedAt: new Date(),
    },
  });

  return NextResponse.json({
    domain: updated,
    message: "Domain verified (local testing)",
  });
}

// Continue with normal DNS verification...
```

---

## 🔍 Troubleshooting

### Issue: "DNS verification failed"

**Problem:** The TXT record isn't found or doesn't match.

**Solutions:**

1. **Check DNS propagation:**
   ```bash
   nslookup -type=TXT example.com
   ```
2. **Verify record format:**
   - Should be: `kalpana-verify=TOKEN`
   - NOT: `"kalpana-verify=TOKEN"` (some providers add quotes automatically)
3. **Check record name:**
   - Use `@` for root domain
   - NOT `www` or subdomain
4. **Wait longer:**

   - DNS can take up to 48 hours
   - Try again in a few hours

5. **Clear DNS cache:**

   ```bash
   # Windows
   ipconfig /flushdns

   # Mac
   sudo dscacheutil -flushcache

   # Linux
   sudo systemd-resolve --flush-caches
   ```

### Issue: "Domain already exists"

**Problem:** Someone else already added this domain.

**Solutions:**

1. **Check if it's you:**

   - Look in your domains list
   - Maybe you already added it?

2. **Contact support:**
   - If it's your domain but someone else claimed it
   - Admin can investigate and transfer ownership

### Issue: "TXT record not showing up"

**Problem:** Added TXT record but `dig` doesn't show it.

**Solutions:**

1. **Check TTL:**
   - Set TTL to 300 (5 minutes) for faster updates
2. **Remove old records:**
   - Delete any old verification TXT records
3. **Check DNS provider:**
   - Some providers batch DNS updates
   - May take 10-30 minutes to apply

---

## 📊 How Verification Works (Technical)

```
┌──────────────────────────────────────────────────────┐
│  1. User Adds Domain                                 │
│                                                       │
│  POST /api/domains                                   │
│  { "domain": "example.com" }                         │
│                                                       │
└───────────────┬──────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────────┐
│  2. System Generates Token                           │
│                                                       │
│  verificationToken = crypto.randomBytes(32)          │
│  → "f4a3b2c1d5e6f7g8..."                            │
│                                                       │
│  Saved to database:                                  │
│  - domain: "example.com"                            │
│  - verified: false                                   │
│  - verificationToken: "f4a3b2c1..."                 │
│                                                       │
└───────────────┬──────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────────┐
│  3. User Adds DNS TXT Record                         │
│                                                       │
│  @ TXT "kalpana-verify=f4a3b2c1..."                 │
│                                                       │
│  [Waits for DNS propagation]                         │
│                                                       │
└───────────────┬──────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────────┐
│  4. User Clicks "Verify"                             │
│                                                       │
│  POST /api/domains/:id/verify                        │
│                                                       │
└───────────────┬──────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────────┐
│  5. System Checks DNS                                │
│                                                       │
│  const records = await dns.resolveTxt("example.com")│
│  → ["kalpana-verify=f4a3b2c1..."]                   │
│                                                       │
│  if (records.includes(domain.verificationToken)) {   │
│    domain.verified = true ✅                        │
│  }                                                   │
│                                                       │
└──────────────────────────────────────────────────────┘
```

---

## 🎯 Quick Reference

### For Local Testing (`.local` domains):

1. Add domain: `kalpana.local`
2. **Skip DNS verification** (use Option 2 or 3 above)
3. Deploy and test!

### For Production (Real domains):

1. Add domain: `example.com`
2. Get verification token
3. Add TXT record to DNS:
   - Type: `TXT`
   - Name: `@`
   - Value: `kalpana-verify=TOKEN`
4. Wait 5-30 minutes
5. Click "Verify"
6. Deploy! 🚀

---

## 🔗 Related Files

- `app/api/domains/route.ts` - Create domains, generate tokens
- `app/api/domains/[id]/verify/route.ts` - DNS verification logic
- `prisma/schema.prisma` - Domain model with `verificationToken`
- `docs/ROUTING.md` - How routing works after verification
- `docs/TESTING_ROUTING_LOCALLY.md` - Local testing guide
