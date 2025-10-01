# 🧪 Testing Routing Locally

## Quick Start: Port-Based Routing (No Setup Needed)

Port-based routing works immediately on any machine:

### 1. Start Your Application

```bash
npm run dev
# or
bun dev
```

### 2. Create a Deployment

1. Go to http://localhost:3000/dashboard
2. Create a new workspace
3. Create a deployment in that workspace
4. The system will allocate a port (e.g., 40001)

### 3. Access Your Deployment

```bash
# Open in browser
http://localhost:40001
```

✅ **That's it!** Port-based routing requires zero configuration.

---

## 🌐 Testing Domain-Based Routing (Traefik)

To test domain routing on your local machine, you need to fake DNS resolution.

### Step 1: Configure Local DNS (Hosts File)

#### On Windows:

```powershell
# Run as Administrator
notepad C:\Windows\System32\drivers\etc\hosts
```

#### On macOS/Linux:

```bash
sudo nano /etc/hosts
```

#### Add These Lines:

```
127.0.0.1   kalpana.local
127.0.0.1   api.kalpana.local
127.0.0.1   app.kalpana.local
127.0.0.1   blog.kalpana.local
127.0.0.1   *.kalpana.local
```

💡 **What this does:** Makes your browser think these domains point to your local machine (127.0.0.1)

---

### Step 2: Configure Environment Variables

Create/update your `.env.local`:

```bash
# Enable Traefik with local domain
TRAEFIK_BASE_URL=kalpana.local
TRAEFIK_EMAIL=dev@localhost
TRAEFIK_NETWORK=traefik-proxy

# Port ranges for deployments
DEPLOYMENT_PORT_RANGE_START=40000
DEPLOYMENT_PORT_RANGE_END=50000
```

---

### Step 3: Start Traefik

The system should automatically start Traefik when you create a deployment with a domain. But you can manually start it:

```typescript
// Run this in a Node.js script or API route
import { traefikManager } from "@/lib/docker/traefik-manager";

await traefikManager.ensureTraefik();
```

Or use the API:

```bash
# Call the deployment API which will auto-start Traefik
curl -X POST http://localhost:3000/api/domains \
  -H "Content-Type: application/json" \
  -d '{"domain": "kalpana.local"}'
```

---

### Step 4: Verify Traefik is Running

```bash
# Check if Traefik container is running
docker ps | grep traefik

# Expected output:
# kalpana-traefik   traefik:v2.10   Up   0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
```

**Access Traefik Dashboard:**

```
http://localhost:8080/dashboard/
```

You should see the Traefik UI showing routers and services.

---

### Step 5: Create a Domain in the UI

1. Go to: http://localhost:3000/dashboard/settings/domains
2. Click "Add Domain"
3. Enter: `kalpana.local`
4. Mark as verified (for local testing, skip actual verification)

---

### Step 6: Create a Deployment with Domain

1. Create a new workspace
2. Create a deployment with these settings:
   - **Name:** Test App
   - **Domain:** kalpana.local (select from dropdown)
   - **Subdomain:** api (or leave empty for auto-generation)
   - **Port:** 3000 (or whatever your app uses)
   - **Start Command:** `npm start` or `bun start`

---

### Step 7: Test Domain Access

```bash
# Test HTTP (Traefik will redirect to HTTPS in production)
curl http://api.kalpana.local

# Or open in browser:
http://api.kalpana.local
```

You should see your deployment!

---

## 🔍 Troubleshooting

### Issue: "Connection Refused" on Port 80

**Problem:** Another service is using port 80 (like Apache, IIS, or another web server)

**Solution:**

```bash
# Windows - Check what's using port 80
netstat -ano | findstr :80

# macOS/Linux - Check what's using port 80
sudo lsof -i :80

# Stop the conflicting service
# Windows IIS:
net stop w3svc

# macOS Apache:
sudo apachectl stop

# Then restart Traefik
docker restart kalpana-traefik
```

---

### Issue: Domain Not Resolving

**Problem:** Browser can't find the domain

**Solution:**

```bash
# Test DNS resolution
ping api.kalpana.local

# Should respond with 127.0.0.1
# If not, check your hosts file again

# Windows - Flush DNS cache
ipconfig /flushdns

# macOS - Flush DNS cache
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder

# Linux - Flush DNS cache
sudo systemd-resolve --flush-caches
```

---

### Issue: "SSL Certificate Error"

**Problem:** Browser shows "Not Secure" or certificate warning

**Solution:** This is **normal for local development**. You have 3 options:

1. **Ignore the warning** (click "Advanced" → "Proceed")
2. **Use HTTP instead of HTTPS** for local testing
3. **Generate a self-signed certificate** (advanced)

For local testing, **just use HTTP**:

```
http://api.kalpana.local
```

---

### Issue: Traefik Can't Find Container

**Problem:** Traefik shows no routers/services in dashboard

**Check:**

```bash
# 1. Verify container has labels
docker inspect deployment-xxx | grep -A 10 Labels

# Should show Traefik labels like:
# "traefik.enable": "true"
# "traefik.http.routers.deployment-xxx.rule": "Host(`api.kalpana.local`)"

# 2. Verify container is on Traefik network
docker inspect deployment-xxx | grep -A 5 Networks

# Should show "traefik-proxy"

# 3. Restart Traefik to re-scan containers
docker restart kalpana-traefik
```

---

### Issue: Container Not on Traefik Network

**Solution:**

```bash
# Manually connect container to Traefik network
docker network connect traefik-proxy deployment-xxx

# Or recreate the deployment with domain routing enabled
```

---

## 🧪 Test Both Modes Simultaneously

You can test **both routing modes** on the same deployment:

```typescript
// Create deployment with both modes
const deployment = await deploymentManager.createDeployment(workspaceId, {
  name: "Hybrid Test",
  port: 3000,
  subdomain: "api",
  domainId: domain.id,
});

// Result:
// Port-based:   http://localhost:40001
// Domain-based: http://api.kalpana.local

// Both URLs point to the SAME container!
```

---

## 📋 Complete Test Checklist

Use this to verify everything works:

### Port-Based Routing:

- [ ] Create workspace
- [ ] Create deployment (no domain)
- [ ] System allocates port (e.g., 40001)
- [ ] Access at `http://localhost:40001`
- [ ] See your app running

### Domain-Based Routing:

- [ ] Edit hosts file (add kalpana.local)
- [ ] Set `TRAEFIK_BASE_URL=kalpana.local` in `.env.local`
- [ ] Restart dev server
- [ ] Create domain in UI
- [ ] Create deployment with domain
- [ ] Verify Traefik container running: `docker ps`
- [ ] Access Traefik dashboard: `http://localhost:8080/dashboard/`
- [ ] Access deployment: `http://api.kalpana.local`
- [ ] Verify routing in Traefik dashboard

---

## 🎯 Quick Test Script

Save this as `test-routing.sh`:

```bash
#!/bin/bash

echo "🧪 Testing Kalpana Routing..."
echo ""

# Test 1: Port-based routing
echo "✓ Testing port-based routing..."
if curl -s http://localhost:40001 > /dev/null; then
  echo "  ✅ Port 40001 is accessible"
else
  echo "  ❌ Port 40001 is not accessible"
fi

# Test 2: Traefik running
echo ""
echo "✓ Checking Traefik..."
if docker ps | grep -q kalpana-traefik; then
  echo "  ✅ Traefik container is running"
else
  echo "  ❌ Traefik container is not running"
fi

# Test 3: Traefik dashboard
echo ""
echo "✓ Testing Traefik dashboard..."
if curl -s http://localhost:8080/api/overview > /dev/null; then
  echo "  ✅ Traefik dashboard is accessible"
else
  echo "  ❌ Traefik dashboard is not accessible"
fi

# Test 4: Domain resolution
echo ""
echo "✓ Testing domain resolution..."
if ping -c 1 api.kalpana.local > /dev/null 2>&1; then
  echo "  ✅ Domain resolves to localhost"
else
  echo "  ❌ Domain does not resolve (check /etc/hosts)"
fi

# Test 5: Domain routing
echo ""
echo "✓ Testing domain-based routing..."
if curl -s http://api.kalpana.local > /dev/null; then
  echo "  ✅ Domain routing works"
else
  echo "  ❌ Domain routing failed"
fi

echo ""
echo "🎉 Testing complete!"
```

Run it:

```bash
chmod +x test-routing.sh
./test-routing.sh
```

---

## 🌟 Example: Full Local Setup

Here's a complete example of testing locally:

```bash
# 1. Clone and setup
git clone your-repo
cd kalpana
npm install

# 2. Configure environment
cat >> .env.local << EOF
DATABASE_URL="mongodb://localhost:27017/kalpana"
GITHUB_CLIENT_ID="your_id"
GITHUB_CLIENT_SECRET="your_secret"
OPENROUTER_API_KEY="your_key"
TRAEFIK_BASE_URL=kalpana.local
DEPLOYMENT_PORT_RANGE_START=40000
DEPLOYMENT_PORT_RANGE_END=50000
EOF

# 3. Edit hosts file (Windows - run as Admin)
notepad C:\Windows\System32\drivers\etc\hosts
# Add: 127.0.0.1   kalpana.local api.kalpana.local

# 4. Start database
docker run -d -p 27017:27017 mongo:7

# 5. Start dev server
npm run dev

# 6. Build container image
cd container
docker build -t kalpana/workspace:latest .

# 7. Open browser
# → http://localhost:3000
# → Create workspace
# → Create deployment
# → Test both URLs:
#    - http://localhost:40001 (port-based)
#    - http://api.kalpana.local (domain-based)
```

---

## 🔗 Useful Commands

```bash
# View all containers
docker ps

# View Traefik logs
docker logs kalpana-traefik -f

# View deployment logs
docker logs deployment-xxx -f

# List Docker networks
docker network ls

# Inspect Traefik network
docker network inspect traefik-proxy

# Stop all deployments
docker stop $(docker ps -q --filter "label=kalpana.managed=true")

# Remove all deployments
docker rm $(docker ps -aq --filter "label=kalpana.managed=true")

# Restart Traefik
docker restart kalpana-traefik
```

---

## 🎓 Understanding the Flow

**Port-Based (Simple):**

```
Browser → localhost:40001 → Docker port mapping → Container
```

**Domain-Based (Traefik):**

```
Browser → kalpana.local:80
         ↓
    Traefik (checks Host header)
         ↓
    Docker network → Container
```

---

## 📚 Next Steps

Once you've tested locally and it works:

1. **Deploy to a real server** with a real domain
2. **Configure DNS** (A records, wildcards)
3. **Enable Let's Encrypt** for automatic SSL
4. **Set production env vars**
5. **Open ports 80/443** on your firewall

See `docs/ROUTING.md` for production deployment guide!

---

## 🆘 Still Having Issues?

Check the logs:

```bash
# Kalpana app logs
npm run dev  # Watch the console

# Traefik logs
docker logs kalpana-traefik --tail 100 -f

# Deployment container logs
docker logs deployment-xxx --tail 100 -f

# Docker daemon logs (Linux)
sudo journalctl -u docker -f
```

Common issues:

- Port 80 already in use → Stop other web servers
- Domain not resolving → Check hosts file
- Container not found → Check Traefik network connection
- SSL errors → Use HTTP for local testing
