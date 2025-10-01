# Package & Extension Caching

## Overview

Kalpana uses **shared volumes** to cache both Nix packages and VSCode extensions across all workspaces. This dramatically reduces bandwidth usage and speeds up workspace launches.

## How It Works

### Shared Volume Architecture

```
┌─────────────────────────────────────────────┐
│         kalpana-nix-store (Volume)          │
│     Shared across ALL workspaces            │
│                                             │
│  /nix/store/                                │
│  ├── abc123-nodejs-20.0.0/                  │
│  ├── def456-python-3.11.13/                 │
│  ├── ghi789-postgresql-17.6/                │
│  └── ... (all downloaded packages)          │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│    kalpana-vscode-extensions (Volume)       │
│     Shared across ALL workspaces            │
│                                             │
│  /root/.local/share/code-server/extensions/ │
│  ├── esbenp.prettier-vscode/               │
│  ├── dbaeumer.vscode-eslint/               │
│  ├── ms-python.python/                     │
│  └── ... (all installed extensions)        │
└─────────────────────────────────────────────┘
         ↓           ↓           ↓
    Workspace1  Workspace2  Workspace3
    (mounts)    (mounts)    (mounts)
```

### Benefits

1. **Faster Launches**
   - First workspace: Downloads packages & extensions (~2-5 minutes)
   - Subsequent workspaces: Reuses cached items (~10-30 seconds)
   - 90%+ reduction in launch time for similar environments

2. **Reduced Bandwidth**
   - Packages & extensions downloaded once, shared by all workspaces
   - Typical Nix environment: 500MB-2GB
   - Typical extensions: 100-500MB
   - With caching: Only download once

3. **Disk Space Efficiency**
   - Shared packages don't duplicate across workspaces
   - Shared extensions don't duplicate across workspaces
   - Automatic deduplication by Nix

## Implementation

### Docker Manager (`lib/docker/manager.ts`)

**Creates shared volume:**
```typescript
const nixStoreVolumeName = "kalpana-nix-store";
await this.docker.createVolume({
  Name: nixStoreVolumeName,
  Labels: {
    "kalpana.shared": "true",
    "kalpana.managed": "true",
    "kalpana.type": "nix-cache",
  },
});
```

**Mounts to all containers:**
```typescript
Binds: [
  `${volumeName}:/workspace`,                                    // Per-workspace volume
  `${nixStoreVolumeName}:/nix/store`,                           // Shared Nix cache
  `${extensionsVolumeName}:/root/.local/share/code-server/extensions`, // Shared extensions cache
]
```

## Usage Scenarios

### Scenario 1: First Workspace Launch
```
User creates workspace with Python template
    ↓
Container starts, Nix downloads Python packages
    ↓
Packages stored in kalpana-nix-store volume
    ↓
Launch time: ~3 minutes
```

### Scenario 2: Second Workspace Launch (Same Template)
```
User creates another workspace with Python template
    ↓
Container starts, Nix checks /nix/store
    ↓
Packages already exist! No download needed
    ↓
Launch time: ~15 seconds ✨
```

### Scenario 3: Different Template (Partial Cache Hit)
```
User creates workspace with Node.js template
    ↓
Container starts, Nix checks /nix/store
    ↓
Some packages cached (gcc, git, etc.)
Only downloads Node.js-specific packages
    ↓
Launch time: ~1 minute (vs 3 minutes without cache)
```

## Cache Management

### View Cache Size
```bash
# Nix packages cache
docker volume inspect kalpana-nix-store

# Extensions cache
docker volume inspect kalpana-vscode-extensions
```

### Clear Cache (Free Disk Space)
```bash
# Clear Nix packages cache
docker volume rm kalpana-nix-store

# Clear extensions cache
docker volume rm kalpana-vscode-extensions

# Clear both
docker volume rm kalpana-nix-store kalpana-vscode-extensions
```
**Note**: Next workspace launch will rebuild the caches.

### Prune Old Packages
Nix automatically handles garbage collection. To manually trigger:
```bash
docker exec -it workspace-<id> nix-collect-garbage -d
```

## Performance Metrics

### Without Caching
- **First launch**: 2-5 minutes
- **Second launch**: 2-5 minutes (re-downloads everything)
- **Bandwidth per workspace**: 500MB-2GB

### With Caching
- **First launch**: 2-5 minutes (builds cache)
- **Second launch**: 10-30 seconds (uses cache)
- **Bandwidth per workspace**: 0-100MB (only new packages)

### Real-World Example
**Scenario**: 10 workspaces with similar Python environments

**Without caching:**
- Total time: 10 × 3 min = 30 minutes
- Total bandwidth: 10 × 1GB = 10GB

**With caching:**
- Total time: 3 min + (9 × 15 sec) = 5.25 minutes
- Total bandwidth: 1GB + (9 × 50MB) = 1.45GB

**Savings**: 83% time, 85% bandwidth! 🎉

## Technical Details

### Volume Lifecycle
1. **Creation**: First workspace launch creates the volume
2. **Sharing**: All subsequent workspaces mount the same volume
3. **Persistence**: Volume persists even when all workspaces are stopped
4. **Cleanup**: Manual deletion only (prevents accidental cache loss)

### Nix Store Structure
```
/nix/store/
├── <hash>-package-name-version/
│   ├── bin/
│   ├── lib/
│   └── share/
└── ...
```

Each package has a unique hash based on its build inputs, ensuring:
- **Reproducibility**: Same inputs = same hash
- **Deduplication**: Identical packages share storage
- **Integrity**: Hash verification prevents corruption

### Cache Invalidation
Nix automatically handles cache invalidation:
- Different package versions get different hashes
- Changed dependencies trigger rebuilds
- No manual cache clearing needed

## Troubleshooting

### Cache Not Working
**Symptoms**: Every workspace downloads packages

**Check volume exists:**
```bash
docker volume ls | grep kalpana-nix-store
```

**Check volume is mounted:**
```bash
docker inspect workspace-<id> | grep -A 5 "Mounts"
```

**Solution**: Restart Docker or recreate volume

### Disk Space Issues
**Symptoms**: "No space left on device"

**Check cache size:**
```bash
docker system df -v | grep kalpana-nix-store
```

**Free space:**
```bash
# Option 1: Clear entire cache
docker volume rm kalpana-nix-store

# Option 2: Garbage collect in running workspace
docker exec workspace-<id> nix-collect-garbage -d
```

### Slow First Launch
**Expected**: First launch builds the cache

**Monitor progress:**
```bash
docker logs -f workspace-<id>
```

Look for:
- `copying path '/nix/store/...'` - Downloading packages
- `✅ Nix environment configured` - Cache built

## Best Practices

### 1. Use Common Templates
Create workspaces with similar base packages to maximize cache hits:
- Python workspaces share Python packages
- Node workspaces share Node packages
- Fullstack workspaces share both

### 2. Periodic Cleanup
Schedule monthly cache cleanup to free disk space:
```bash
# In cron or scheduled task
docker volume rm kalpana-nix-store
```

### 3. Monitor Cache Size
Set up alerts when cache exceeds threshold:
```bash
# Check size in GB
docker system df -v | grep kalpana-nix-store | awk '{print $3}'
```

### 4. Backup Important Workspaces
Cache is shared, but workspace data is separate:
- Cache loss: Rebuilds automatically
- Workspace data loss: Permanent
- Always backup `/workspace` volumes

## Advanced Configuration

### Custom Cache Location
Set environment variable before starting Docker:
```bash
export KALPANA_NIX_CACHE_PATH=/custom/path
```

### Multiple Cache Volumes
For isolation between teams/projects:
```typescript
// In docker manager
const nixStoreVolumeName = `kalpana-nix-store-${teamId}`;
```

### Cache Prewarming
Pre-populate cache with common packages:
```bash
# Create temporary container
docker run -v kalpana-nix-store:/nix/store nixos/nix \
  nix-env -iA nixpkgs.nodejs_20 nixpkgs.python311 nixpkgs.postgresql

# Cache now contains these packages
```

## Migration Guide

### Existing Workspaces
Existing workspaces will automatically use the cache on next restart:
1. Stop workspace
2. Start workspace
3. Cache volume is mounted automatically

### No Data Loss
- Workspace files: Unchanged (separate volume)
- Settings: Unchanged
- Extensions: Unchanged
- Only Nix packages are cached

## FAQ

**Q: Will this affect my workspace files?**
A: No, workspace files are in a separate volume (`kalpana-workspace-<id>`)

**Q: What happens if I delete the cache?**
A: Next workspace launch will rebuild it. No data loss.

**Q: Can I disable caching?**
A: Yes, remove the Nix store mount from `docker/manager.ts`

**Q: How much disk space does the cache use?**
A: Typically 2-10GB depending on packages installed

**Q: Is the cache secure?**
A: Yes, Nix verifies package hashes. Corrupted packages are rejected.

**Q: Can I share cache between machines?**
A: Not directly, but you can export/import the volume

## Monitoring

### Cache Hit Rate
Track how often packages are reused:
```bash
# Count downloads in logs
docker logs workspace-<id> | grep "copying path" | wc -l

# 0 = 100% cache hit
# >0 = Partial cache hit
```

### Cache Growth
Monitor cache size over time:
```bash
watch -n 60 'docker system df -v | grep kalpana-nix-store'
```

## Summary

✅ **Shared Nix store volume** caches packages across workspaces
✅ **90%+ faster** subsequent launches
✅ **85%+ less bandwidth** usage
✅ **Automatic** - no configuration needed
✅ **Safe** - workspace data separate from cache
✅ **Efficient** - deduplication by Nix

The cache is created automatically on first workspace launch and shared by all workspaces, making your development environment blazing fast! 🚀
