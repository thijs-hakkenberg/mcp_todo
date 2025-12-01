# Docker Deployment Guide for Telegram Bot

This guide provides comprehensive instructions for deploying the Telegram bot using Docker and Docker Compose.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Architecture Overview](#architecture-overview)
- [Git Repository Setup](#git-repository-setup)
- [Installation](#installation)
- [Operations](#operations)
- [Troubleshooting](#troubleshooting)
- [Production Considerations](#production-considerations)
- [Migration from Local to Docker](#migration-from-local-to-docker)

## Prerequisites

Before deploying the Telegram bot with Docker, ensure you have:

1. **Docker** (version 20.10 or later)
   ```bash
   docker --version
   ```

2. **Docker Compose** (version 2.0 or later)
   ```bash
   docker compose version
   ```

3. **Git Repository** for storing todos
   - GitHub, GitLab, Bitbucket, or self-hosted Git server
   - Repository must be accessible from the Docker container

4. **Telegram Bot Token**
   - Create a bot with [@BotFather](https://t.me/BotFather) on Telegram
   - Save the bot token (format: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

5. **Telegram User ID**
   - Get your user ID from [@userinfobot](https://t.me/userinfobot)
   - This restricts bot access to authorized users only

## Architecture Overview

The Docker deployment uses the following architecture:

```
┌─────────────────────────────────────────────────┐
│           Docker Container                       │
│                                                  │
│  ┌──────────────────────────────────────────┐  │
│  │  Telegram Bot (Node.js)                  │  │
│  │  - Long polling for messages             │  │
│  │  - Command processing                    │  │
│  │  - MCP client communication              │  │
│  └──────────────┬───────────────────────────┘  │
│                 │                                │
│  ┌──────────────▼───────────────────────────┐  │
│  │  MCP Server (stdio)                      │  │
│  │  - Todo CRUD operations                  │  │
│  │  - Git operations                        │  │
│  └──────────────┬───────────────────────────┘  │
│                 │                                │
│  ┌──────────────▼───────────────────────────┐  │
│  │  Local Git Repository                    │  │
│  │  /app/data/todos/                        │  │
│  │  - Directory-based storage               │  │
│  │  - Symlink views                         │  │
│  └──────────────┬───────────────────────────┘  │
│                 │                                │
└─────────────────┼────────────────────────────────┘
                  │
                  │ Auto-sync (every 60s)
                  │
         ┌────────▼─────────┐
         │  Remote Git      │
         │  (GitHub/GitLab) │
         └──────────────────┘
```

### Key Features

- **Isolated Environment**: Bot runs in its own container with minimal dependencies
- **Git Sync Strategy**: Each container has its own Git clone that syncs with remote
- **Automatic Recovery**: Container restarts automatically on failures
- **Persistent Storage**: Git repository stored in Docker volume
- **Security**: Non-root user, no exposed ports, environment-based secrets

## Git Repository Setup

The bot requires a Git repository to store todos. You have two options for authentication:

### Option 1: HTTPS with Personal Access Token (Recommended)

This is the simplest method and works well for most use cases.

#### GitHub Setup

1. **Create a new repository** (or use existing):
   ```bash
   # On GitHub.com
   # New repository > Create repository
   # Name: my-todos (or any name)
   # Private or Public (your choice)
   ```

2. **Generate Personal Access Token**:
   - Go to GitHub Settings > Developer settings > Personal access tokens > Tokens (classic)
   - Click "Generate new token (classic)"
   - Set note: "Telegram Bot Todo Access"
   - Select scopes: **repo** (full control of private repositories)
   - Click "Generate token"
   - **Copy the token immediately** (you won't see it again!)

3. **Format the URL**:
   ```bash
   # Format: https://TOKEN@github.com/USERNAME/REPO.git
   # Example:
   TODO_REPO_URL=https://ghp_xxxxxxxxxxxxxxxxxxxx@github.com/myuser/my-todos.git
   ```

#### GitLab Setup

1. **Create a new project** (or use existing)

2. **Generate Personal Access Token**:
   - Go to User Settings > Access Tokens
   - Token name: "Telegram Bot"
   - Select scopes: **api**, **read_repository**, **write_repository**
   - Click "Create personal access token"
   - **Copy the token immediately**

3. **Format the URL**:
   ```bash
   # Format: https://oauth2:TOKEN@gitlab.com/USERNAME/REPO.git
   # Example:
   TODO_REPO_URL=https://oauth2:glpat-xxxxxxxxxxxxxxxxxxxx@gitlab.com/myuser/my-todos.git
   ```

### Option 2: SSH Keys (More Secure)

SSH keys provide better security but require additional setup.

#### Generate SSH Key

```bash
# Generate new SSH key
ssh-keygen -t ed25519 -C "telegram-bot@example.com" -f ~/.ssh/telegram_bot_key

# Start SSH agent
eval "$(ssh-agent -s)"

# Add key to agent
ssh-add ~/.ssh/telegram_bot_key
```

#### Add Public Key to Git Provider

**GitHub**:
1. Copy public key: `cat ~/.ssh/telegram_bot_key.pub`
2. Go to GitHub Settings > SSH and GPG keys > New SSH key
3. Paste the public key

**GitLab**:
1. Copy public key: `cat ~/.ssh/telegram_bot_key.pub`
2. Go to User Settings > SSH Keys
3. Paste the public key

#### Configure Docker Compose

Add SSH key mount to `docker-compose.telegram.yml`:

```yaml
services:
  telegram-bot:
    volumes:
      - telegram-git-data:/app/data
      - ~/.ssh:/home/node/.ssh:ro  # Mount SSH keys as read-only
```

#### Use SSH URL Format

```bash
# Format: git@github.com:USERNAME/REPO.git
# Example:
TODO_REPO_URL=git@github.com:myuser/my-todos.git
```

### Initialize Remote Repository

Before starting the bot, ensure your remote repository is initialized:

```bash
# Clone the repository locally
git clone YOUR_REPO_URL
cd my-todos

# Create initial commit (if empty)
git commit --allow-empty -m "Initial commit"
git push origin main

# Or initialize with directory structure
mkdir -p todos/tasks
echo "# My Todos" > README.md
git add .
git commit -m "Initialize todo repository"
git push origin main
```

## Installation

### Step 1: Clone the Project

```bash
git clone https://github.com/yourusername/our_todo.git
cd our_todo
```

### Step 2: Create Environment File

```bash
# Copy the example environment file
cp .env.telegram.example .env.telegram

# Edit the file with your configuration
nano .env.telegram
# or
vim .env.telegram
```

### Step 3: Configure Environment Variables

Edit `.env.telegram` and set the following **required** variables:

```bash
# Telegram Configuration
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_AUTHORIZED_USER_ID=123456789

# Git Configuration
TODO_REPO_URL=https://ghp_xxxxxxxxxxxx@github.com/myuser/my-todos.git
GIT_USER_NAME=Telegram Bot
GIT_USER_EMAIL=bot@example.com

# Sync Configuration (optional, defaults shown)
AUTO_SYNC=true
SYNC_INTERVAL_SECONDS=60
```

**Important**: Never commit `.env.telegram` to Git! It's already in `.gitignore`.

### Step 4: Build Docker Image

```bash
# Build the Docker image
docker build -f Dockerfile.telegram -t todo-telegram-bot:latest .
```

This will:
- Install dependencies
- Build TypeScript code
- Run tests
- Create production image with minimal size

**Expected output**:
```
[+] Building 45.2s (18/18) FINISHED
 => [builder 1/7] FROM docker.io/library/node:24-alpine
 => [builder 2/7] WORKDIR /app
 => [builder 3/7] COPY package*.json ./
 => [builder 4/7] RUN npm ci
 => [builder 5/7] COPY src/ ./src/
 => [builder 6/7] COPY tsconfig.json ./
 => [builder 7/7] RUN npm run build
 => [stage-1 1/8] FROM docker.io/library/node:24-alpine
 => [stage-1 2/8] RUN apk add --no-cache git openssh-client
 => [stage-1 3/8] WORKDIR /app
 => [stage-1 4/8] COPY package*.json ./
 => [stage-1 5/8] RUN npm ci --only=production
 => [stage-1 6/8] COPY --from=builder /app/dist ./dist
 => [stage-1 7/8] COPY scripts/init-git-repo.sh /usr/local/bin/
 => [stage-1 8/8] RUN chmod +x /usr/local/bin/init-git-repo.sh
 => exporting to image
Successfully tagged todo-telegram-bot:latest
```

### Step 5: Start the Container

```bash
# Start the container in detached mode
docker compose -f docker-compose.telegram.yml up -d
```

**Expected output**:
```
[+] Running 2/2
 ✔ Volume "todo-telegram-git-data" created
 ✔ Container todo-telegram-bot      Started
```

### Step 6: Verify Deployment

```bash
# Check container status
docker ps | grep telegram

# View logs
docker logs -f todo-telegram-bot
```

**Expected log output**:
```
=== Git Repository Initialization ===
Repository path: /app/data/todos
Git repository does not exist
Cloning repository from: https://github.com/myuser/my-todos.git
Successfully cloned repository
=== Git Repository Ready ===

Connecting to MCP server...
Connected to MCP server
Bot started successfully
```

### Step 7: Test the Bot

1. Open Telegram and find your bot
2. Send `/start` command
3. You should receive a welcome message
4. Try `/help` to see available commands

## Operations

### View Logs

```bash
# Follow logs in real-time
docker logs -f todo-telegram-bot

# View last 100 lines
docker logs --tail 100 todo-telegram-bot

# View logs with timestamps
docker logs -t todo-telegram-bot
```

### Start/Stop Container

```bash
# Stop the container
docker compose -f docker-compose.telegram.yml down

# Start the container
docker compose -f docker-compose.telegram.yml up -d

# Restart the container
docker restart todo-telegram-bot
```

### Update Bot Code

After making code changes:

```bash
# 1. Rebuild the Docker image
docker build -f Dockerfile.telegram -t todo-telegram-bot:latest .

# 2. Restart with new image
docker compose -f docker-compose.telegram.yml up -d

# 3. Verify logs
docker logs -f todo-telegram-bot
```

### Backup Data

The Git repository is automatically backed up to the remote repository via sync. For additional local backup:

```bash
# Backup the Docker volume
docker run --rm \
  -v todo-telegram-git-data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/telegram-data-backup.tar.gz /data

# Restore from backup
docker run --rm \
  -v todo-telegram-git-data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/telegram-data-backup.tar.gz -C /
```

### Access Container Shell

For debugging:

```bash
# Access container shell
docker exec -it todo-telegram-bot /bin/sh

# View Git repository
docker exec -it todo-telegram-bot ls -la /app/data/todos

# Check Git status
docker exec -it todo-telegram-bot git -C /app/data/todos status
```

### Monitor Resource Usage

```bash
# View resource usage
docker stats todo-telegram-bot

# View container details
docker inspect todo-telegram-bot
```

## Troubleshooting

### Bot Not Starting

**Symptoms**: Container exits immediately or keeps restarting

**Diagnosis**:
```bash
# Check container status
docker ps -a | grep telegram

# View logs
docker logs todo-telegram-bot

# Check exit code
docker inspect todo-telegram-bot | grep ExitCode
```

**Common Issues**:

1. **Invalid Bot Token**
   ```
   Error: 401 Unauthorized
   ```
   - Verify `TELEGRAM_BOT_TOKEN` in `.env.telegram`
   - Test token: `curl https://api.telegram.org/bot<TOKEN>/getMe`

2. **Missing Environment Variables**
   ```
   ERROR: TELEGRAM_BOT_TOKEN environment variable is required
   ```
   - Ensure `.env.telegram` file exists
   - Check all required variables are set

3. **Git Repository Access Failed**
   ```
   WARNING: Failed to clone repository
   ```
   - Verify `TODO_REPO_URL` is correct
   - Check Git credentials (token or SSH key)
   - Test access: `git ls-remote YOUR_REPO_URL`

### Git Sync Failures

**Symptoms**: Logs show Git errors, todos not syncing

**Diagnosis**:
```bash
# Check Git operations from container
docker exec -it todo-telegram-bot git -C /app/data/todos status

# Test remote access
docker exec -it todo-telegram-bot git -C /app/data/todos ls-remote origin
```

**Common Issues**:

1. **Token Expired**
   ```
   fatal: Authentication failed
   ```
   - Generate new personal access token
   - Update `TODO_REPO_URL` in `.env.telegram`
   - Restart container

2. **No Push Permissions**
   ```
   error: failed to push some refs
   ```
   - Verify token has write permissions
   - Check repository permissions

3. **Network Connectivity**
   ```
   fatal: unable to access 'https://github.com/...': Could not resolve host
   ```
   - Check Docker network: `docker network inspect bridge`
   - Verify internet connectivity from container
   - Check firewall rules

### Container Keeps Restarting

**Symptoms**: Container status shows "Restarting"

**Diagnosis**:
```bash
# View restart count
docker inspect todo-telegram-bot | grep RestartCount

# View full logs
docker logs --tail 200 todo-telegram-bot

# Check resource usage
docker stats todo-telegram-bot
```

**Common Issues**:

1. **Uncaught Exception**
   - Check logs for error stack traces
   - Report bug with full logs

2. **Out of Memory**
   ```
   Error: JavaScript heap out of memory
   ```
   - Increase memory limit in docker-compose.yml:
     ```yaml
     deploy:
       resources:
         limits:
           memory: 512M
     ```

3. **Git Initialization Failure**
   - Check Git repository URL
   - Verify credentials
   - Check disk space: `docker exec -it todo-telegram-bot df -h`

### Bot Not Responding to Commands

**Symptoms**: Bot is running but doesn't respond to messages

**Diagnosis**:
```bash
# Check bot is polling
docker logs todo-telegram-bot | grep "polling"

# Verify user authorization
docker logs todo-telegram-bot | grep "authorized"
```

**Common Issues**:

1. **User Not Authorized**
   ```
   User 987654321 is not authorized
   ```
   - Add user ID to `TELEGRAM_AUTHORIZED_USER_ID`
   - Restart container

2. **Polling Error**
   ```
   Polling error: ETELEGRAM: 409 Conflict
   ```
   - Another instance is running
   - Stop all instances: `docker stop todo-telegram-bot`
   - Wait 30 seconds, then start again

3. **MCP Server Connection Failed**
   ```
   Failed to connect to MCP server
   ```
   - Check MCP_SERVER_PATH is correct
   - Verify dist/index.js exists in container

## Production Considerations

### Resource Limits

Add resource limits to prevent container from consuming too much:

```yaml
# docker-compose.telegram.yml
services:
  telegram-bot:
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M
```

### Monitoring

**Health Checks**:
The Dockerfile includes a health check that verifies the bot process is running:

```bash
# Check health status
docker inspect todo-telegram-bot | grep Health -A 10
```

**Log Monitoring**:
Set up log aggregation for production:

```bash
# Use Docker logging driver
# docker-compose.telegram.yml
services:
  telegram-bot:
    logging:
      driver: "syslog"
      options:
        syslog-address: "tcp://logs.example.com:514"
```

**Metrics**:
For advanced monitoring, consider:
- Prometheus for metrics collection
- Grafana for visualization
- AlertManager for alerts

### Security Hardening

1. **Use Docker Secrets** (Docker Swarm):
   ```yaml
   services:
     telegram-bot:
       secrets:
         - telegram_bot_token
       environment:
         TELEGRAM_BOT_TOKEN_FILE: /run/secrets/telegram_bot_token
   ```

2. **Read-Only Root Filesystem**:
   ```yaml
   services:
     telegram-bot:
       read_only: true
       tmpfs:
         - /tmp
   ```

3. **Network Isolation**:
   ```yaml
   services:
     telegram-bot:
       networks:
         - telegram-net
   networks:
     telegram-net:
       driver: bridge
       internal: false  # Needs internet for Telegram API
   ```

4. **Regular Updates**:
   ```bash
   # Update base image regularly
   docker pull node:24-alpine
   docker build -f Dockerfile.telegram -t todo-telegram-bot:latest .
   ```

### Backup Strategy

1. **Git Remote Sync** (Primary):
   - Automatic sync every 60 seconds
   - All changes pushed to remote
   - Remote repository is the source of truth

2. **Volume Backup** (Secondary):
   ```bash
   # Daily backup cron job
   0 2 * * * docker run --rm -v todo-telegram-git-data:/data -v /backup:/backup alpine tar czf /backup/telegram-$(date +\%Y\%m\%d).tar.gz /data
   ```

3. **Retention Policy**:
   - Keep daily backups for 7 days
   - Keep weekly backups for 4 weeks
   - Keep monthly backups for 12 months

### Scaling Considerations

**Single Bot Instance**:
- Telegram bots can only have one active polling connection
- Running multiple instances will cause "409 Conflict" errors
- Use `restart: unless-stopped` to ensure high availability

**Multiple Users**:
- Adjust `SYNC_INTERVAL_SECONDS` based on activity:
  - 1-2 users: 60-120 seconds
  - 3-5 users: 30-60 seconds
  - High activity: 15-30 seconds

**High Availability**:
- Use Docker Swarm or Kubernetes for orchestration
- Implement health checks and automatic failover
- Use shared remote Git repository for state

## Migration from Local to Docker

If you're currently running the bot locally, follow these steps to migrate to Docker:

### Step 1: Backup Local Data

```bash
# Backup your local todo repository
cp -r $TODO_REPO_PATH $TODO_REPO_PATH.backup

# Ensure all changes are committed
cd $TODO_REPO_PATH
git status
git add .
git commit -m "Backup before Docker migration"
```

### Step 2: Push to Remote

```bash
# Push all changes to remote
cd $TODO_REPO_PATH
git push origin main

# Verify push succeeded
git log origin/main
```

### Step 3: Stop Local Bot

```bash
# Find the bot process
ps aux | grep telegram

# Stop the process
pkill -f "telegram/index"

# Verify it stopped
ps aux | grep telegram
```

### Step 4: Configure Docker

```bash
# Navigate to project directory
cd /path/to/our_todo

# Create environment file
cp .env.telegram.example .env.telegram

# Edit with same values as local setup
nano .env.telegram
```

### Step 5: Start Docker Bot

```bash
# Build image
docker build -f Dockerfile.telegram -t todo-telegram-bot:latest .

# Start container
docker compose -f docker-compose.telegram.yml up -d

# Verify logs
docker logs -f todo-telegram-bot
```

### Step 6: Verify Functionality

1. **Test Bot Commands**:
   - Send `/start` to bot
   - Send `/list` to see existing todos
   - Send `/create` to create a new todo

2. **Verify Git Sync**:
   ```bash
   # Check Git repository in container
   docker exec -it todo-telegram-bot ls -la /app/data/todos

   # Verify sync is working
   docker logs todo-telegram-bot | grep "sync"
   ```

3. **Test Data Persistence**:
   ```bash
   # Create a todo via bot
   # Restart container
   docker restart todo-telegram-bot
   # Verify todo still exists
   ```

### Step 7: Monitor for 24 Hours

- Check logs regularly: `docker logs -f todo-telegram-bot`
- Verify no errors or warnings
- Test all bot commands
- Ensure Git sync is working
- Monitor resource usage: `docker stats todo-telegram-bot`

### Step 8: Clean Up Local Installation (Optional)

After confirming Docker deployment works:

```bash
# Remove local bot files (keep backup!)
# Only do this after 100% confident Docker works

# Keep the backup for at least 30 days
# $TODO_REPO_PATH.backup
```

## Additional Resources

- **Docker Documentation**: https://docs.docker.com/
- **Docker Compose Documentation**: https://docs.docker.com/compose/
- **Telegram Bot API**: https://core.telegram.org/bots/api
- **GitHub Personal Access Tokens**: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token
- **GitLab Personal Access Tokens**: https://docs.gitlab.com/ee/user/profile/personal_access_tokens.html

## Support

For issues and questions:
1. Check the troubleshooting section above
2. Review Docker logs: `docker logs todo-telegram-bot`
3. Open an issue on GitHub with full logs and configuration (remove secrets!)

## Summary

This deployment guide covers:
- ✅ Complete setup from scratch
- ✅ Git repository configuration (HTTPS and SSH)
- ✅ Docker build and deployment
- ✅ Comprehensive troubleshooting
- ✅ Production considerations
- ✅ Migration from local to Docker

The Docker deployment provides:
- **Reliability**: Automatic restarts on failures
- **Isolation**: Contained environment with minimal dependencies
- **Portability**: Run anywhere Docker is available
- **Scalability**: Easy to deploy multiple instances (with different bots)
- **Maintainability**: Simple updates and rollbacks
