# 🧪 Quick Test: Domain Routing Locally

## Prerequisites

✅ Traefik is running (you already have this!)
✅ Hosts file configured with `kalpana.local`
✅ App is running on `http://localhost:3000`

---

## Step-by-Step Test

### 1. **Add Domain via UI**

1. Go to: http://localhost:3000/dashboard/settings/domains
2. Click **"Add Domain"**
3. Enter: `kalpana.local`
4. Click **Save**

Copy the **Domain ID** from the URL or response.

---

### 2. **Verify Domain (Dev Mode - No DNS!)**

```bash
# Replace YOUR_DOMAIN_ID with the actual ID
curl -X POST http://localhost:3000/api/domains/YOUR_DOMAIN_ID/verify-dev \
  -H "Content-Type: application/json" \
  --cookie-jar cookies.txt \
  --cookie cookies.txt

# Expected response:
# {
#   "domain": { "id": "...", "domain": "kalpana.local", "verified": true },
#   "message": "Domain verified (dev mode - no DNS check)"
# }
```

**OR use browser:**

- Go to your domain settings
- Click **"Verify"** (the UI might call the dev endpoint automatically in dev mode)

---

### 3. **Create Deployment with Domain**

Go to your workspace → Deployments → Create New:

- **Name:** Test App
- **Domain:** `kalpana.local` (select from dropdown)
- **Subdomain:** `api` (or leave blank for random)
- **Port:** `3000` (or your app port)
- **Start Command:** `npm start` or `python -m http.server 3000`

---

### 4. **Test the Route**

```bash
# Check Traefik dashboard to see the route
http://localhost:8080/dashboard/

# Should show:
# - Router: deployment-xxx@docker
# - Rule: Host(`api.kalpana.local`)
# - Service: deployment-xxx

# Test the domain
curl http://api.kalpana.local

# Or open in browser:
http://api.kalpana.local
```

---

## 🎯 Quick Script (Copy & Paste)

Save this as `test-local-domain.sh`:

```bash
#!/bin/bash

echo "🧪 Testing Local Domain Routing"
echo "================================"
echo ""

# 1. Check Traefik
echo "✓ Checking Traefik..."
if docker ps | grep -q kalpana-traefik; then
  echo "  ✅ Traefik is running"
else
  echo "  ❌ Traefik not running. Start it first!"
  exit 1
fi

# 2. Check hosts file
echo ""
echo "✓ Checking hosts file..."
if grep -q "kalpana.local" /etc/hosts || grep -q "kalpana.local" /c/Windows/System32/drivers/etc/hosts 2>/dev/null; then
  echo "  ✅ kalpana.local found in hosts file"
else
  echo "  ⚠️  kalpana.local not in hosts file"
  echo "     Add: 127.0.0.1  kalpana.local"
fi

# 3. Test DNS resolution
echo ""
echo "✓ Testing DNS resolution..."
if ping -c 1 kalpana.local > /dev/null 2>&1 || ping -n 1 kalpana.local > /dev/null 2>&1; then
  echo "  ✅ kalpana.local resolves to localhost"
else
  echo "  ❌ kalpana.local doesn't resolve"
fi

# 4. Check Traefik dashboard
echo ""
echo "✓ Testing Traefik dashboard..."
if curl -s http://localhost:8080/api/overview > /dev/null; then
  echo "  ✅ Traefik dashboard accessible"
  echo "     http://localhost:8080/dashboard/"
else
  echo "  ❌ Traefik dashboard not accessible"
fi

# 5. Check app
echo ""
echo "✓ Testing main app..."
if curl -s http://localhost:3000 > /dev/null; then
  echo "  ✅ App running on port 3000"
else
  echo "  ❌ App not running. Start with: npm run dev"
fi

echo ""
echo "================================"
echo ""
echo "📋 Next Steps:"
echo "  1. Go to: http://localhost:3000/dashboard/settings/domains"
echo "  2. Add domain: kalpana.local"
echo "  3. Verify it (dev mode - no DNS needed!)"
echo "  4. Create deployment with that domain"
echo "  5. Access at: http://SUBDOMAIN.kalpana.local"
echo ""
echo "🎉 All checks passed!"
```

Run it:

```bash
chmod +x test-local-domain.sh
./test-local-domain.sh
```

---

## 💡 Pro Tips

### Tip 1: Use Multiple Subdomains

```
api.kalpana.local    → API deployment
app.kalpana.local    → Frontend deployment
admin.kalpana.local  → Admin panel deployment
```

All routed by the same Traefik!

### Tip 2: Check Traefik Logs

```bash
# Watch Traefik in real-time
docker logs kalpana-traefik -f

# You should see:
# - Container connected
# - Router created
# - Service registered
```

### Tip 3: Inspect Container Labels

```bash
# Check if deployment has correct labels
docker inspect deployment-xxx | grep -A 20 Labels

# Should show:
# "traefik.enable": "true"
# "traefik.http.routers.deployment-xxx.rule": "Host(`api.kalpana.local`)"
```

---

## 🐛 Troubleshooting

### "Connection Refused" on `api.kalpana.local`

**Check:**

1. Is Traefik running? `docker ps | grep traefik`
2. Is deployment running? `docker ps | grep deployment`
3. Is deployment on Traefik network? `docker inspect deployment-xxx | grep Networks`

**Fix:**

```bash
# Connect deployment to Traefik network
docker network connect traefik-proxy deployment-xxx

# Restart Traefik
docker restart kalpana-traefik
```

### Domain Not Showing in Traefik Dashboard

**Check:**

1. Go to: http://localhost:8080/dashboard/
2. Look under **HTTP** → **Routers**
3. Should see `deployment-xxx@docker` with rule `Host(\`api.kalpana.local\`)`

**If missing:**

```bash
# Restart Traefik to rescan containers
docker restart kalpana-traefik
```

---

## 📚 Related Docs

- `docs/DOMAIN_VERIFICATION.md` - How DNS verification works (production)
- `docs/ROUTING.md` - Complete routing architecture
- `docs/TESTING_ROUTING_LOCALLY.md` - Full local testing guide
- `docs/TRAEFIK_DOMAIN_ROUTING.md` - How Traefik uses database domains
