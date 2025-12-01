# Telegram Bot Setup Guide

This document describes the Telegram bot integration for the git-todo MCP server, which enables voice-based todo management through Telegram.

## Overview

The Telegram bot provides:
- Voice message transcription using Whisper
- Natural language processing with Ollama
- Todo management via MCP protocol
- Text command interface
- Speaker diarization (optional)

## Architecture

```
Telegram User
    ↓ (voice/text)
Telegram Bot API
    ↓
Bot Handler
    ├─→ AuthHandler (authorization)
    ├─→ CommandHandler (text commands)
    └─→ VoiceHandler (voice messages)
        ├─→ WhisperClient (transcription)
        ├─→ OllamaClient (NLP)
        ├─→ SpeakerRecognition (diarization)
        └─→ MCPClient (todo operations)
            ↓
MCP Server → TodoRepository → Git
```

## Project Structure

```
src/telegram/
├── bot.ts                    # Main bot entry point
├── handlers/
│   ├── commandHandler.ts     # Text command handlers
│   ├── voiceHandler.ts       # Voice message handlers
│   └── authHandler.ts        # Authentication logic
├── services/
│   ├── ollamaClient.ts       # Ollama integration
│   ├── whisperClient.ts      # Whisper transcription
│   ├── speakerRecognition.ts # Speaker diarization
│   └── mcpClient.ts          # MCP client adapter
└── types/
    └── telegram.ts           # TypeScript types

tests/telegram/
├── unit/
│   ├── commandHandler.test.ts
│   ├── voiceHandler.test.ts
│   ├── authHandler.test.ts
│   ├── ollamaClient.test.ts
│   ├── whisperClient.test.ts
│   └── speakerRecognition.test.ts
└── integration/
    ├── bot.integration.test.ts
    └── mcp.integration.test.ts
```

## Prerequisites

1. **Telegram Bot Token**
   - Create a bot via [@BotFather](https://t.me/BotFather)
   - Save the bot token

2. **User ID**
   - Get your Telegram user ID from [@userinfobot](https://t.me/userinfobot)

3. **Ollama**
   - Install Ollama: https://ollama.ai
   - Pull a model: `ollama pull llama2`
   - Ensure Ollama is running: `ollama serve`

4. **Whisper**
   - Option 1: Use Whisper API server (recommended)
   - Option 2: Use local Whisper model

## Installation

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables in `.env`:
```bash
# Copy example configuration
cp .env.example .env

# Edit .env and set:
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_AUTHORIZED_USER_ID=123456789
OLLAMA_API_URL=http://localhost:11434
WHISPER_API_URL=http://localhost:9000
```

3. Build the project:
```bash
npm run build
```

## Running the Bot

### Development Mode
```bash
npm run dev:telegram
```

### Production Mode
```bash
npm run start:telegram
```

## Testing

### Run All Telegram Tests
```bash
npm run test:telegram
```

### Run Unit Tests Only
```bash
npm run test:telegram:unit
```

### Run Integration Tests Only
```bash
npm run test:telegram:integration
```

### Watch Mode
```bash
npm run test:watch -- tests/telegram
```

## Usage

### Text Commands

- `/start` - Welcome message and bot introduction
- `/help` - Show available commands
- `/list [filters]` - List todos with optional filters
  - Example: `/list status:todo`
  - Example: `/list project:work priority:high`
- `/create <text> [params]` - Create a new todo
  - Example: `/create Buy groceries project:personal priority:high`
  - Example: `/create Meeting notes project:work tags:urgent,meeting`
- `/update <id> [params]` - Update an existing todo
  - Example: `/update 123 status:in-progress`
  - Example: `/update 123 text:Updated text priority:low`
- `/complete <id>` - Mark a todo as complete
- `/delete <id>` - Delete a todo

### Voice Commands

Send a voice message with natural language instructions:

- "Create a todo for buying groceries tomorrow"
- "List all my urgent tasks"
- "Mark task 123 as complete"
- "Update my meeting notes with high priority"

The bot will:
1. Transcribe your voice message
2. Process it with Ollama to understand intent
3. Execute the appropriate MCP tool
4. Reply with the result

### Command Parameters

Available parameters for create/update:
- `text:` - Todo text
- `project:` - Project name
- `priority:` - low, medium, high, urgent
- `status:` - todo, in-progress, blocked, done
- `tags:` - Comma-separated tags
- `assignee:` - Assignee name
- `dueDate:` - Due date (ISO8601)

## Configuration Options

### Environment Variables

#### Required
- `TELEGRAM_BOT_TOKEN` - Bot token from @BotFather
- `TELEGRAM_AUTHORIZED_USER_ID` - Your Telegram user ID
- `OLLAMA_API_URL` - Ollama API endpoint
- `TODO_REPO_PATH` - Path to Git repository
- `GIT_USER_NAME` - Git user name
- `GIT_USER_EMAIL` - Git user email

#### Optional
- `WHISPER_API_URL` - Whisper API endpoint (if using API)
- `WHISPER_MODEL_PATH` - Path to local Whisper model (alternative)
- `ENABLE_SPEAKER_DIARIZATION` - Enable speaker recognition (default: false)
- `MIN_SPEAKERS` - Minimum speakers for diarization (default: 1)
- `MAX_SPEAKERS` - Maximum speakers for diarization (default: 5)

## Development Status

### Current Status: RED Phase (TDD)

All test files have been created and are currently failing. This is expected and correct according to TDD methodology.

### Test Results
```bash
npm run test:telegram:unit
# Expected: All tests fail (modules not implemented)

npm run test:telegram:integration
# Expected: All tests fail (modules not implemented)
```

### Next Steps (GREEN Phase)

1. Implement `src/telegram/handlers/authHandler.ts`
2. Implement `src/telegram/handlers/commandHandler.ts`
3. Implement `src/telegram/handlers/voiceHandler.ts`
4. Implement `src/telegram/services/ollamaClient.ts`
5. Implement `src/telegram/services/whisperClient.ts`
6. Implement `src/telegram/services/speakerRecognition.ts`
7. Implement `src/telegram/services/mcpClient.ts`
8. Implement `src/telegram/bot.ts`
9. Run tests and verify they pass
10. Refactor (REFACTOR phase)

## Security Considerations

1. **Authorization**: Only the configured user ID can use the bot
2. **Token Security**: Keep your bot token secret
3. **Environment Variables**: Never commit `.env` to version control
4. **Voice Files**: Temporary voice files are cleaned up after processing
5. **MCP Access**: Bot has full access to todo repository

## Troubleshooting

### Bot Not Responding
- Check bot token is correct
- Verify bot is running: `ps aux | grep telegram`
- Check logs for errors

### Voice Transcription Fails
- Ensure Whisper service is running
- Check `WHISPER_API_URL` is correct
- Verify audio format is supported (ogg, mp3, wav, m4a)

### Ollama Errors
- Ensure Ollama is running: `ollama serve`
- Check model is pulled: `ollama list`
- Verify `OLLAMA_API_URL` is correct

### MCP Connection Issues
- Ensure MCP server is built: `npm run build`
- Check `TODO_REPO_PATH` exists and is initialized
- Verify Git configuration is correct

## Contributing

When adding new features:

1. Write tests first (TDD)
2. Ensure tests fail (RED)
3. Implement minimal code to pass tests (GREEN)
4. Refactor and improve (REFACTOR)
5. Update this documentation

## References

- [Telegram Bot API](https://core.telegram.org/bots/api)
- [node-telegram-bot-api](https://github.com/yagop/node-telegram-bot-api)
- [Ollama API](https://github.com/ollama/ollama/blob/main/docs/api.md)
- [Whisper](https://github.com/openai/whisper)
- [MCP Protocol](https://modelcontextprotocol.io)
