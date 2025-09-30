# GitHub Integration Guide

This guide explains how to connect your GitHub account to Kalpana and use it to work with private repositories.

## Overview

The GitHub integration allows you to:

- 🔐 Clone private repositories
- 📤 Push changes directly from containers
- 🔄 Pull latest changes from your repos
- ⚡ Automatic Git authentication without manual token management

## Setup

### 1. Configure GitHub OAuth App

First, you need to create a GitHub OAuth App:

1. Go to GitHub Settings → Developer settings → OAuth Apps
2. Click "New OAuth App"
3. Fill in the details:
   - **Application name**: Kalpana (or your preferred name)
   - **Homepage URL**: `http://localhost:3000` (or your deployment URL)
   - **Authorization callback URL**: `http://localhost:3000/api/auth/callback/github`
4. Click "Register application"
5. Copy the **Client ID** and **Client Secret**

### 2. Add Environment Variables

Add the following to your `.env` file:

```env
GITHUB_CLIENT_ID=your_client_id_here
GITHUB_CLIENT_SECRET=your_client_secret_here
```

### 3. Connect Your GitHub Account

1. Navigate to **Settings** in the Kalpana dashboard
2. Scroll to the **GitHub Integration** section
3. Click **Connect GitHub Account**
4. Authorize Kalpana to access your GitHub account
5. You'll be redirected back to settings with your GitHub account connected

## Usage

### Cloning Private Repositories

Once connected, you can clone private repositories in your workspaces:

1. Create a new workspace
2. Enter the GitHub repository URL or `owner/repo` format
3. Start the workspace
4. The repository will be cloned automatically with your credentials

### Git Operations in Containers

When your workspace starts, Git is automatically configured with:

- ✅ Your GitHub access token for authentication
- ✅ Your GitHub name and email from your profile
- ✅ Credential helper for seamless push/pull operations

You can use Git commands normally in the terminal:

```bash
# Clone a private repo
git clone https://github.com/yourname/private-repo.git

# Make changes and push
git add .
git commit -m "Update from Kalpana"
git push origin main

# Pull latest changes
git pull origin main
```

### Disconnecting GitHub

To disconnect your GitHub account:

1. Go to **Settings** → **GitHub Integration**
2. Click **Disconnect**
3. Confirm the action

**Note**: Existing workspaces will lose GitHub authentication, but no data will be deleted.

## Security

### How Tokens Are Stored

- GitHub access tokens are stored in the database in the `Account` table
- Tokens are associated with your user account
- Tokens are only injected into YOUR containers
- Tokens are not exposed in logs or API responses

### Token Scope

Kalpana requests the following GitHub scopes:

- `read:user` - Read your basic profile information
- `repo` - Access to repositories (public and private)

### Container Security

In containers:

- Tokens are stored in `~/.git-credentials` with restrictive permissions (600)
- Credentials are only accessible within your container
- Credentials are removed when the container is stopped

## Troubleshooting

### "Git clone failed" Error

If cloning fails:

1. Check that your GitHub account is connected in Settings
2. Verify the repository name/URL is correct
3. Ensure you have access to the repository on GitHub
4. Check container logs for detailed error messages

### Authentication Errors When Pushing

If you get authentication errors:

1. Disconnect and reconnect your GitHub account
2. Restart your workspace to reload credentials
3. Check that your GitHub token hasn't expired or been revoked

### Can't See Private Repos

Make sure:

1. You've authorized Kalpana with the `repo` scope
2. Your GitHub account is properly connected
3. You're using the correct repository name/URL

## Environment Variables Reference

| Variable               | Required | Description                         |
| ---------------------- | -------- | ----------------------------------- |
| `GITHUB_CLIENT_ID`     | Yes      | OAuth App Client ID from GitHub     |
| `GITHUB_CLIENT_SECRET` | Yes      | OAuth App Client Secret from GitHub |

## API Reference

### GET `/api/user/github`

Get GitHub connection status for the current user.

**Response:**

```json
{
  "connected": true,
  "username": "octocat",
  "avatarUrl": "https://avatars.githubusercontent.com/u/...",
  "name": "The Octocat",
  "connectedAt": "2025-09-30T12:00:00.000Z"
}
```

### DELETE `/api/user/github`

Disconnect GitHub account for the current user.

**Response:**

```json
{
  "success": true,
  "message": "GitHub account disconnected"
}
```

## Best Practices

1. **Keep Your Token Secure**: Never share your GitHub token or commit it to repositories
2. **Regular Reconnections**: If you revoke your GitHub token, reconnect in Kalpana
3. **Use SSH for Personal Projects**: For local development, consider using SSH keys
4. **Review Permissions**: Periodically review authorized OAuth apps in GitHub settings

## Next Steps

- [Working with Workspaces](./WORKSPACES.md)
- [Environment Configuration](./ENVIRONMENTS.md)
- [Container Management](./CONTAINERS.md)
