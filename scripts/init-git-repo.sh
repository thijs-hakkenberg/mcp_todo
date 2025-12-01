#!/bin/sh
# Git repository initialization script for Telegram bot container
# This script runs before the bot starts to ensure Git repository is ready

set -e  # Exit on error

echo "=== Git Repository Initialization ==="

# Check required environment variables
if [ -z "$TODO_REPO_PATH" ]; then
  echo "ERROR: TODO_REPO_PATH environment variable is not set"
  exit 1
fi

if [ -z "$GIT_USER_NAME" ]; then
  echo "ERROR: GIT_USER_NAME environment variable is not set"
  exit 1
fi

if [ -z "$GIT_USER_EMAIL" ]; then
  echo "ERROR: GIT_USER_EMAIL environment variable is not set"
  exit 1
fi

echo "Repository path: $TODO_REPO_PATH"

# Create parent directory if it doesn't exist
PARENT_DIR=$(dirname "$TODO_REPO_PATH")
mkdir -p "$PARENT_DIR"

# Check if Git repository exists
if [ -d "$TODO_REPO_PATH/.git" ]; then
  echo "Git repository exists, pulling latest changes..."
  cd "$TODO_REPO_PATH"

  # Configure Git user
  git config user.name "$GIT_USER_NAME"
  git config user.email "$GIT_USER_EMAIL"

  # Try to pull latest changes (don't fail if it errors)
  if [ -n "$TODO_REPO_URL" ]; then
    echo "Pulling from remote: $TODO_REPO_URL"
    if git pull origin main 2>&1; then
      echo "Successfully pulled latest changes"
    else
      echo "WARNING: Failed to pull from remote, continuing anyway..."
    fi
  else
    echo "No TODO_REPO_URL set, skipping pull"
  fi
else
  echo "Git repository does not exist"

  # Check if we have a remote URL to clone from
  if [ -n "$TODO_REPO_URL" ]; then
    echo "Cloning repository from: $TODO_REPO_URL"

    # Try to clone (don't fail if it errors)
    if git clone "$TODO_REPO_URL" "$TODO_REPO_PATH" 2>&1; then
      echo "Successfully cloned repository"
      cd "$TODO_REPO_PATH"

      # Configure Git user
      git config user.name "$GIT_USER_NAME"
      git config user.email "$GIT_USER_EMAIL"
    else
      echo "WARNING: Failed to clone repository, initializing empty repository..."
      mkdir -p "$TODO_REPO_PATH"
      cd "$TODO_REPO_PATH"
      git init
      git config user.name "$GIT_USER_NAME"
      git config user.email "$GIT_USER_EMAIL"

      # Create initial commit
      git commit --allow-empty -m "Initial commit"

      # Add remote if URL is set
      if [ -n "$TODO_REPO_URL" ]; then
        git remote add origin "$TODO_REPO_URL" || echo "WARNING: Failed to add remote"
      fi
    fi
  else
    echo "No TODO_REPO_URL set, initializing empty repository..."
    mkdir -p "$TODO_REPO_PATH"
    cd "$TODO_REPO_PATH"
    git init
    git config user.name "$GIT_USER_NAME"
    git config user.email "$GIT_USER_EMAIL"

    # Create initial commit
    git commit --allow-empty -m "Initial commit"
  fi
fi

echo "=== Git Repository Ready ==="
echo ""
