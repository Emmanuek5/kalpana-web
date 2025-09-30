# Terminal & Logs Access Guide

This guide explains how to access and use the terminal and log viewing features for your deployments.

## Overview

For each running deployment, you have access to:
- **Terminal**: Execute commands directly in the container
- **Logs**: View application logs in real-time or static

## Accessing Terminal

### 1. Open Terminal

1. Navigate to your workspace
2. Click the **Deployments** tab
3. Find a **running** deployment
4. Click the **Terminal** icon (📟)

### 2. Execute Commands

The terminal allows you to run any shell command in your deployment container:

**Basic Commands**:
```bash
# List files
ls -la

# Print working directory  
pwd

# View file contents
cat app.js

# Check environment variables
env

# View running processes
ps aux

# Check disk space
df -h

# Check memory usage
free -m

# Test network connectivity
curl localhost:3000
```

**Application-Specific**:
```bash
# Node.js
npm list
node --version

# Python
pip list
python --version

# Check logs
tail -f /var/log/app.log

# Database
psql -U user -d database
```

### 3. Understanding Output

- **Command** (green): Your command with `$` prefix
- **Output** (white): Standard output (stdout)
- **Errors** (red): Error output (stderr) and exit codes

### 4. Features

- **Clear**: Remove all output and start fresh
- **Run Button**: Execute the current command
- **Enter Key**: Press Enter to execute command
- **Auto-scroll**: Terminal automatically scrolls to bottom

## Accessing Logs

### 1. Open Logs Viewer

1. Navigate to your workspace
2. Click the **Deployments** tab
3. Find a **running** deployment  
4. Click the **Logs** icon (📄)

### 2. Viewing Logs

**Static Logs**:
- Shows last 200 lines by default
- Click **Refresh** (🔄) to reload
- Historical snapshot of logs

**Live Streaming**:
- Click **Live Stream** button
- Logs update in real-time as they're generated
- Perfect for monitoring deployments
- Click **Stop Stream** to pause

### 3. Log Controls

**Pause/Resume Auto-scroll**:
- Click ⏸️ to pause automatic scrolling
- Useful for reviewing specific log entries
- Click ▶️ to resume auto-scrolling

**Clear Logs**:
- Removes all logs from the viewer
- Doesn't delete actual logs
- Useful for focusing on new entries

**Refresh**:
- Manually reload static logs
- Gets latest entries from container

### 4. Log Color Coding

- **Red**: Lines containing "error" or "fail"
- **Yellow**: Lines containing "warn"  
- **White**: Normal log output

### 5. Features

- **Line Count**: Shows total lines displayed
- **Live Indicator**: Animated dot when streaming
- **Pause Indicator**: Shows when auto-scroll is paused
- **Timestamps**: Preserved from container logs

## Use Cases

### Debugging Application Errors

1. **View Logs**: Open logs viewer
2. **Find Error**: Look for red-highlighted lines
3. **Open Terminal**: Click terminal icon
4. **Investigate**: 
   ```bash
   # Check configuration
   cat config/app.json
   
   # View environment
   env | grep DATABASE
   
   # Test connectivity
   curl -I http://localhost:3000/health
   ```

### Monitoring Deployment

1. **Start Deployment**: Click Play on deployment
2. **Open Logs**: Click logs icon
3. **Live Stream**: Click "Live Stream" button
4. **Watch**: Monitor application startup
5. **Verify**: Look for "Server started" or similar

### Checking Application Status

```bash
# Check if app is running
ps aux | grep node

# Check port binding
netstat -tlnp | grep 3000

# Check recent logs
tail -n 50 /var/log/app.log

# Check for errors
grep -i error /var/log/app.log
```

### Performance Diagnostics

```bash
# CPU usage
top -n 1

# Memory usage
free -m

# Disk usage
df -h

# Network connections
netstat -an

# Process details
ps auxf
```

## Best Practices

### Terminal Usage

1. **Start Simple**: Use basic commands first (`ls`, `pwd`)
2. **Check First**: View before modifying (`cat` before `rm`)
3. **Be Careful**: Commands run with container permissions
4. **Test Locally**: Try risky commands in dev environment first
5. **Document**: Keep track of useful commands

### Log Viewing

1. **Use Live Stream**: For active debugging and monitoring
2. **Pause When Needed**: Stop auto-scroll to review errors
3. **Clear Regularly**: Remove old logs to focus on new ones
4. **Look for Patterns**: Watch for repeated errors or warnings
5. **Export**: Copy important logs for offline analysis

## Tips & Tricks

### Terminal Tips

**Quick File Inspection**:
```bash
# View first 10 lines
head -10 file.txt

# View last 20 lines  
tail -20 file.txt

# Search in files
grep "error" app.log

# Count lines
wc -l file.txt
```

**Process Management**:
```bash
# Find process by name
ps aux | grep node

# Check process tree
pstree

# Get process info
cat /proc/PID/status
```

**Disk Operations**:
```bash
# Find large files
du -h --max-depth=1 | sort -hr

# Check inode usage
df -i

# Find files by size
find . -type f -size +10M
```

### Log Tips

**Effective Monitoring**:
- Start with static logs to understand baseline
- Use live streaming during active development
- Pause when you see an error to read details
- Clear logs after resolving issues

**Pattern Recognition**:
- Look for timestamp patterns (repeated errors)
- Watch for stack traces (multi-line errors)
- Notice HTTP status codes
- Track response times

## Troubleshooting

### Terminal Not Working

**Problem**: Terminal button is grayed out
- **Cause**: Deployment is not running
- **Solution**: Start the deployment first

**Problem**: Commands return errors
- **Cause**: Wrong working directory or permissions
- **Solution**: Check `pwd`, use absolute paths

### Logs Not Showing

**Problem**: Logs viewer is empty
- **Cause**: Application not logging to stdout/stderr
- **Solution**: Configure app to log to console

**Problem**: Live stream not updating
- **Cause**: Network connection or container stopped
- **Solution**: Stop and restart streaming

## Advanced Usage

### Running Scripts

```bash
# Create a script
cat > check.sh << 'EOF'
#!/bin/bash
echo "=== System Check ==="
echo "CPU: $(nproc) cores"
echo "Memory: $(free -h | grep Mem | awk '{print $2}')"
echo "Disk: $(df -h / | tail -1 | awk '{print $4}' )"
EOF

# Make executable
chmod +x check.sh

# Run it
./check.sh
```

### Log Analysis

```bash
# Count error occurrences
grep -c "ERROR" /var/log/app.log

# Find unique errors
grep "ERROR" /var/log/app.log | sort | uniq

# Errors in last hour (if timestamped)
grep "$(date +%Y-%m-%d\ %H)" /var/log/app.log | grep ERROR

# Most common errors
grep ERROR /var/log/app.log | sort | uniq -c | sort -nr
```

## Security Notes

1. **Access Control**: Only container owner can access terminal/logs
2. **Isolated Environment**: Commands run within container only
3. **No Persistence**: Terminal sessions don't persist
4. **Log Privacy**: Logs are private to your deployments
5. **Command Limits**: Some privileged commands may be restricted

## Next Steps

- [Deployment Guide](./DEPLOYMENTS.md)
- [Domain Management](../DEPLOYMENT_SYSTEM_SUMMARY.md)
- [GitHub Integration](./GITHUB_INTEGRATION.md)