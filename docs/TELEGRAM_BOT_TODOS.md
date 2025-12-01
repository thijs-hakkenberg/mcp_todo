# Telegram Bot Integration - Detailed Task List

This document contains all todos for implementing the Telegram bot integration with voice transcription, speaker recognition, Ollama integration, and GitLab initialization features.

## Phase 1: Core Telegram Bot (Priority: High)

### 1.1 Set up Telegram bot project structure and dependencies
**Tags:** tdd, setup, telegram, phase-1
**Priority:** high
**Description:**
Initialize project structure for Telegram bot. Install dependencies: node-telegram-bot-api, @types/node-telegram-bot-api. Set up TypeScript configuration. Create basic folder structure (src/telegram/bot, src/telegram/handlers, src/telegram/services).

**Gherkin Scenarios:**

```gherkin
Scenario: Install Telegram bot dependencies
  Given a Node.js project with package.json
  When I run npm install node-telegram-bot-api @types/node-telegram-bot-api
  Then the dependencies should be added to package.json
  And the node_modules should contain the packages

Scenario: Create project folder structure
  Given a src/telegram directory
  When I create subdirectories for bot, handlers, and services
  Then src/telegram/bot should exist
  And src/telegram/handlers should exist
  And src/telegram/services should exist
```

### 1.2 Write tests for Telegram bot initialization and configuration
**Tags:** tdd, testing, telegram, phase-1
**Priority:** high
**Description:**
TDD: Write tests for bot initialization with token validation, configuration loading from environment variables, and error handling for missing configuration.

**Gherkin Scenarios:**

```gherkin
Scenario: Bot initializes with valid token
  Given a valid Telegram bot token in TELEGRAM_BOT_TOKEN
  When I initialize the TelegramBot
  Then the bot should connect successfully
  And the bot should be ready to receive messages

Scenario: Bot fails with missing token
  Given TELEGRAM_BOT_TOKEN is not set
  When I attempt to initialize the TelegramBot
  Then initialization should throw an error
  And the error message should indicate missing token

Scenario: Bot loads configuration from environment
  Given TELEGRAM_BOT_TOKEN and AUTHORIZED_USER_ID are set
  When I initialize the TelegramBot
  Then the bot should load the token
  And the bot should load the authorized user ID
  And the configuration should be validated
```

### 1.3 Implement Telegram bot foundation with configuration
**Tags:** telegram, implementation, phase-1
**Priority:** high
**Description:**
Implement TelegramBot class with configuration loading, bot initialization, and basic error handling. Use environment variables for TELEGRAM_BOT_TOKEN.

**Gherkin Scenarios:**

```gherkin
Scenario: Bot starts and listens for messages
  Given a valid bot configuration
  When I start the bot
  Then the bot should connect to Telegram API
  And the bot should start polling for messages
  And the bot should log successful startup
```

### 1.4 Write tests for group chat authentication
**Tags:** tdd, testing, telegram, auth, phase-1
**Priority:** high
**Description:**
TDD: Write tests for single-user authorization in group chats. Test authorized user can execute commands, unauthorized users receive rejection messages, and user ID validation works correctly.

**Gherkin Scenarios:**

```gherkin
Scenario: Authorized user executes command
  Given a user with ID matching AUTHORIZED_USER_ID
  When the user sends a command in a group chat
  Then the authentication should pass
  And the command should be processed

Scenario: Unauthorized user is rejected
  Given a user with ID not matching AUTHORIZED_USER_ID
  When the user sends a command in a group chat
  Then the authentication should fail
  And the user should receive a rejection message
  And the command should not be processed

Scenario: Authentication validates user ID format
  Given a message from a user
  When I validate the user ID
  Then the user ID should be a valid Telegram user ID
  And the validation should handle edge cases
```

### 1.5 Implement single-user authorization middleware
**Tags:** telegram, auth, implementation, phase-1
**Priority:** high
**Description:**
Implement authentication middleware that checks user ID against AUTHORIZED_USER_ID environment variable. Reject unauthorized users with friendly message.

**Gherkin Scenarios:**

```gherkin
Scenario: Middleware allows authorized user
  Given an incoming message from authorized user
  When the authentication middleware processes the message
  Then the middleware should call next()
  And the message should proceed to command handler

Scenario: Middleware blocks unauthorized user
  Given an incoming message from unauthorized user
  When the authentication middleware processes the message
  Then the middleware should send rejection message
  And the middleware should not call next()
  And the message should be logged for security
```

### 1.6 Write tests for MCP client integration
**Tags:** tdd, testing, mcp, telegram, phase-1
**Priority:** high
**Description:**
TDD: Write tests for MCP client wrapper that communicates with MCP server via stdio. Test connection establishment, tool execution, error handling, and connection recovery.

**Gherkin Scenarios:**

```gherkin
Scenario: MCP client connects to server
  Given an MCP server is available
  When I initialize the MCP client
  Then the client should spawn the MCP server process
  And the client should establish stdio communication
  And the client should send initialize request

Scenario: MCP client executes tool successfully
  Given a connected MCP client
  When I call a tool with valid arguments
  Then the client should send tools/call request
  And the client should receive a successful response
  And the client should return the tool result

Scenario: MCP client handles connection failure
  Given an MCP server that fails to start
  When I initialize the MCP client
  Then the client should throw a connection error
  And the error should include diagnostic information

Scenario: MCP client recovers from disconnection
  Given a connected MCP client
  When the MCP server process terminates
  Then the client should detect the disconnection
  And the client should attempt to reconnect
  And the client should restore the connection
```

### 1.7 Implement MCP client wrapper for Telegram bot
**Tags:** mcp, telegram, implementation, phase-1
**Priority:** high
**Description:**
Create MCPClient class that spawns MCP server process and communicates via stdio. Implement methods for calling MCP tools (create_todo, list_todos, update_todo, delete_todo).

**Gherkin Scenarios:**

```gherkin
Scenario: Client spawns MCP server process
  Given MCP server is built and available
  When I create an MCPClient instance
  Then the client should spawn node dist/index.js
  And the client should capture stdout and stderr
  And the client should be ready for tool calls
```

### 1.8 Write tests for /list command
**Tags:** tdd, testing, telegram, commands, phase-1
**Priority:** high
**Description:**
TDD: Write tests for /list command with filters (status, priority, project, tags). Test output formatting, empty results, and error handling.

**Gherkin Scenarios:**

```gherkin
Scenario: List all todos
  Given multiple todos exist in the system
  When I send /list command
  Then I should receive a formatted list of all todos
  And each todo should show ID, text, status, and priority

Scenario: List todos with status filter
  Given todos with various statuses
  When I send /list status:todo
  Then I should receive only todos with status 'todo'
  And completed todos should not be shown

Scenario: List todos with priority filter
  Given todos with various priorities
  When I send /list priority:high
  Then I should receive only high priority todos

Scenario: List todos with project filter
  Given todos in multiple projects
  When I send /list project:work
  Then I should receive only todos from 'work' project

Scenario: List returns empty result
  Given no todos match the filter
  When I send /list status:blocked
  Then I should receive a message indicating no todos found

Scenario: List handles MCP error
  Given MCP server is unavailable
  When I send /list command
  Then I should receive an error message
  And the error should be user-friendly
```

### 1.9 Implement /list command handler
**Tags:** telegram, commands, implementation, phase-1
**Priority:** high
**Description:**
Implement /list command that calls MCP list_todos tool and formats results for Telegram. Support filters: /list status:todo, /list priority:high, /list project:work.

**Gherkin Scenarios:**

```gherkin
Scenario: Format todos for Telegram display
  Given a list of todos from MCP
  When I format the todos for display
  Then each todo should be on a separate line
  And each todo should include emoji indicators for status
  And the message should fit Telegram's message length limit
```

### 1.10 Write tests for /create command
**Tags:** tdd, testing, telegram, commands, phase-1
**Priority:** high
**Description:**
TDD: Write tests for /create command with text parsing, validation, and MCP integration. Test various input formats and error cases.

**Gherkin Scenarios:**

```gherkin
Scenario: Create todo with simple text
  Given I am an authorized user
  When I send /create Buy groceries
  Then a new todo should be created with text 'Buy groceries'
  And the todo should use default project
  And I should receive confirmation with todo ID

Scenario: Create todo with project
  Given I am an authorized user
  When I send /create [work] Review pull request
  Then a new todo should be created in 'work' project
  And the text should be 'Review pull request'

Scenario: Create todo with tags
  Given I am an authorized user
  When I send /create Fix bug #urgent #backend
  Then a new todo should be created with tags 'urgent' and 'backend'
  And the text should be 'Fix bug'

Scenario: Create todo with priority
  Given I am an authorized user
  When I send /create Deploy to production priority:high
  Then a new todo should be created with priority 'high'
  And the text should be 'Deploy to production'

Scenario: Create todo with all options
  Given I am an authorized user
  When I send /create [work] Fix critical bug #urgent #backend priority:high
  Then a new todo should be created with all specified attributes

Scenario: Create fails with empty text
  Given I am an authorized user
  When I send /create
  Then I should receive an error message
  And no todo should be created
```

### 1.11 Implement /create command handler
**Tags:** telegram, commands, implementation, phase-1
**Priority:** high
**Description:**
Implement /create command that parses todo text and calls MCP create_todo tool. Support format: /create [project] Todo text #tag1 #tag2 priority:high.

**Gherkin Scenarios:**

```gherkin
Scenario: Parse complex create command
  Given a command /create [work] Review PR #code-review priority:high
  When I parse the command
  Then project should be 'work'
  And text should be 'Review PR'
  And tags should include 'code-review'
  And priority should be 'high'
```

### 1.12 Write tests for /update command
**Tags:** tdd, testing, telegram, commands, phase-1
**Priority:** high
**Description:**
TDD: Write tests for /update command with ID validation, field updates, and error handling.

**Gherkin Scenarios:**

```gherkin
Scenario: Update todo status
  Given a todo with ID '123' exists
  When I send /update 123 status:done
  Then the todo status should be updated to 'done'
  And I should receive confirmation

Scenario: Update todo priority
  Given a todo with ID '123' exists
  When I send /update 123 priority:urgent
  Then the todo priority should be updated to 'urgent'

Scenario: Update multiple fields
  Given a todo with ID '123' exists
  When I send /update 123 status:in-progress priority:high
  Then both status and priority should be updated

Scenario: Update fails with invalid ID
  Given no todo with ID '999' exists
  When I send /update 999 status:done
  Then I should receive an error message
  And no todo should be modified

Scenario: Update fails with invalid field
  Given a todo with ID '123' exists
  When I send /update 123 invalid:value
  Then I should receive an error message
  And the todo should not be modified
```

### 1.13 Implement /update command handler
**Tags:** telegram, commands, implementation, phase-1
**Priority:** high
**Description:**
Implement /update command that calls MCP update_todo tool. Support format: /update <id> status:done, /update <id> priority:urgent.

**Gherkin Scenarios:**

```gherkin
Scenario: Parse update command with multiple fields
  Given a command /update 123 status:done priority:high
  When I parse the command
  Then todo ID should be '123'
  And updates should include status: 'done'
  And updates should include priority: 'high'
```

### 1.14 Write tests for /delete command
**Tags:** tdd, testing, telegram, commands, phase-1
**Priority:** high
**Description:**
TDD: Write tests for /delete command with ID validation, confirmation, and error handling.

**Gherkin Scenarios:**

```gherkin
Scenario: Delete existing todo
  Given a todo with ID '123' exists
  When I send /delete 123
  Then the todo should be deleted (archived)
  And I should receive confirmation

Scenario: Delete fails with invalid ID
  Given no todo with ID '999' exists
  When I send /delete 999
  Then I should receive an error message
  And no todo should be deleted

Scenario: Delete requires confirmation
  Given a todo with ID '123' exists
  When I send /delete 123
  Then I should receive a confirmation prompt
  And the todo should not be deleted yet
  When I confirm the deletion
  Then the todo should be deleted
```

### 1.15 Implement /delete command handler
**Tags:** telegram, commands, implementation, phase-1
**Priority:** high
**Description:**
Implement /delete command that calls MCP delete_todo tool. Support format: /delete <id>.

**Gherkin Scenarios:**

```gherkin
Scenario: Delete command with confirmation
  Given a todo with ID '123' exists
  When I send /delete 123
  Then I should see todo details
  And I should see confirmation buttons
  When I click confirm
  Then the todo should be deleted
```

### 1.16 Write integration tests for basic Telegram commands
**Tags:** tdd, testing, telegram, integration, phase-1
**Priority:** high
**Description:**
Write end-to-end integration tests for all basic commands (/list, /create, /update, /delete) with real MCP server and mock Telegram API.

**Gherkin Scenarios:**

```gherkin
Scenario: Complete todo workflow
  Given a running Telegram bot with MCP server
  When I send /create [test] Integration test todo
  Then I should receive a todo ID
  When I send /list project:test
  Then I should see the created todo
  When I send /update <id> status:done
  Then the todo should be marked as done
  When I send /delete <id>
  Then the todo should be deleted

Scenario: Multiple users in group chat
  Given a group chat with multiple users
  When unauthorized user sends /list
  Then they should receive rejection message
  When authorized user sends /list
  Then they should receive todo list
```

---

## Phase 2: Voice Transcription (Priority: High)

### 2.1 Research Whisper implementation options (local vs API)
**Tags:** research, voice, whisper, phase-2
**Priority:** high
**Description:**
Research and compare Whisper implementation options: OpenAI Whisper API vs local whisper.cpp vs faster-whisper. Evaluate trade-offs: cost, latency, accuracy, privacy, resource requirements.

**Gherkin Scenarios:**

```gherkin
Scenario: Evaluate OpenAI Whisper API
  Given OpenAI Whisper API documentation
  When I analyze the API capabilities
  Then I should document API pricing
  And I should document API latency
  And I should document API accuracy benchmarks
  And I should document privacy implications

Scenario: Evaluate local Whisper implementations
  Given whisper.cpp and faster-whisper options
  When I compare local implementations
  Then I should document resource requirements
  And I should document inference speed
  And I should document model size options
  And I should document accuracy vs speed trade-offs

Scenario: Make implementation recommendation
  Given research on all options
  When I evaluate for Telegram bot use case
  Then I should recommend an implementation
  And I should justify the recommendation
  And I should document setup requirements
```

### 2.2 Write tests for voice message download from Telegram
**Tags:** tdd, testing, voice, telegram, phase-2
**Priority:** high
**Description:**
TDD: Write tests for downloading voice messages from Telegram, saving to temporary files, and cleanup.

**Gherkin Scenarios:**

```gherkin
Scenario: Download voice message successfully
  Given a voice message with file_id
  When I download the voice message
  Then the file should be saved to temp directory
  And the file should be in .ogg format
  And the file path should be returned

Scenario: Handle download failure
  Given an invalid file_id
  When I attempt to download the voice message
  Then the download should fail with error
  And the error should be logged
  And no temp file should be created

Scenario: Clean up temp files after processing
  Given a downloaded voice file
  When the transcription is complete
  Then the temp file should be deleted
  And no orphaned files should remain

Scenario: Handle concurrent downloads
  Given multiple voice messages arriving simultaneously
  When I download all voice messages
  Then each should have unique temp file
  And downloads should not interfere with each other
```

### 2.3 Implement voice message download handler
**Tags:** voice, telegram, implementation, phase-2
**Priority:** high
**Description:**
Implement handler for downloading voice messages from Telegram API, saving to temp files with proper cleanup.

**Gherkin Scenarios:**

```gherkin
Scenario: Download and save voice message
  Given a Telegram voice message event
  When the handler processes the message
  Then it should get file info from Telegram
  And it should download the file stream
  And it should save to /tmp/voice-{timestamp}.ogg
  And it should return the file path
```

### 2.4 Write tests for Whisper transcription service
**Tags:** tdd, testing, voice, whisper, phase-2
**Priority:** high
**Description:**
TDD: Write tests for Whisper transcription service with audio file input, transcription output, language detection, and error handling.

**Gherkin Scenarios:**

```gherkin
Scenario: Transcribe English audio successfully
  Given an English voice file
  When I transcribe the audio
  Then I should receive transcribed text
  And the language should be detected as 'en'
  And the confidence score should be included

Scenario: Transcribe non-English audio
  Given a Spanish voice file
  When I transcribe the audio
  Then I should receive transcribed text
  And the language should be detected as 'es'
  And the text should be in Spanish

Scenario: Handle corrupted audio file
  Given a corrupted audio file
  When I attempt to transcribe
  Then transcription should fail with error
  And the error should indicate invalid audio

Scenario: Handle empty audio file
  Given an empty audio file
  When I attempt to transcribe
  Then transcription should return empty text
  Or transcription should fail gracefully

Scenario: Transcribe with timestamps
  Given a voice file
  When I transcribe with timestamp option
  Then I should receive text with word-level timestamps
  And timestamps should be in seconds
```

### 2.5 Integrate Whisper for speech-to-text
**Tags:** voice, whisper, implementation, phase-2
**Priority:** high
**Description:**
Integrate chosen Whisper implementation for speech-to-text transcription. Implement WhisperService class with transcribe method.

**Gherkin Scenarios:**

```gherkin
Scenario: Initialize Whisper service
  Given Whisper model is available
  When I initialize WhisperService
  Then the model should be loaded
  And the service should be ready for transcription

Scenario: Transcribe voice message
  Given a downloaded voice file
  When I call whisperService.transcribe(filePath)
  Then the audio should be transcribed
  And the result should include text and language
  And the result should include confidence score
```

### 2.6 Write tests for speaker diarization with pyannote.audio
**Tags:** tdd, testing, voice, diarization, phase-2
**Priority:** high
**Description:**
TDD: Write tests for speaker diarization to identify who spoke when in audio recordings.

**Gherkin Scenarios:**

```gherkin
Scenario: Diarize single speaker audio
  Given an audio file with one speaker
  When I perform diarization
  Then I should receive one speaker segment
  And the segment should span the entire audio
  And the speaker should be labeled as 'SPEAKER_00'

Scenario: Diarize multi-speaker audio
  Given an audio file with three speakers
  When I perform diarization
  Then I should receive multiple speaker segments
  And each segment should have speaker label
  And each segment should have start and end time
  And speakers should be distinguished correctly

Scenario: Align diarization with transcription
  Given transcribed text and diarization segments
  When I align the results
  Then each text segment should be attributed to a speaker
  And the alignment should be time-accurate

Scenario: Handle overlapping speech
  Given audio with overlapping speakers
  When I perform diarization
  Then overlapping segments should be identified
  And both speakers should be labeled in overlap
```

### 2.7 Implement speaker diarization with pyannote.audio
**Tags:** voice, diarization, implementation, phase-2
**Priority:** high
**Description:**
Implement speaker diarization using pyannote.audio to identify different speakers in voice messages. Create Python service that can be called from Node.js.

**Gherkin Scenarios:**

```gherkin
Scenario: Setup pyannote.audio service
  Given Python environment with pyannote.audio
  When I initialize the diarization service
  Then the model should be loaded
  And the service should accept audio file paths
  And the service should return speaker segments

Scenario: Call diarization from Node.js
  Given a Node.js Telegram bot
  When I need to diarize audio
  Then I should spawn Python process
  And I should pass audio file path
  And I should receive JSON with speaker segments
```

### 2.8 Write tests for speaker profile storage and recognition
**Tags:** tdd, testing, voice, speaker-recognition, phase-2
**Priority:** high
**Description:**
TDD: Write tests for storing speaker voice profiles and recognizing speakers across messages.

**Gherkin Scenarios:**

```gherkin
Scenario: Create speaker profile from voice sample
  Given a voice message from a new speaker
  When I create a speaker profile
  Then voice embeddings should be extracted
  And the profile should be stored with speaker ID
  And the profile should be linked to Telegram user

Scenario: Recognize known speaker
  Given an existing speaker profile
  And a new voice message
  When I perform speaker recognition
  Then the speaker should be identified
  And the confidence score should be provided
  And the Telegram user should be linked

Scenario: Handle unknown speaker
  Given no matching speaker profile
  And a new voice message
  When I perform speaker recognition
  Then the speaker should be marked as unknown
  And I should suggest creating new profile

Scenario: Update speaker profile with new samples
  Given an existing speaker profile
  And new voice messages from same speaker
  When I update the profile
  Then the profile should incorporate new samples
  And recognition accuracy should improve

Scenario: Distinguish similar voices
  Given two speakers with similar voices
  When I perform speaker recognition
  Then the system should distinguish between them
  And confidence scores should reflect similarity
```

### 2.9 Implement speaker recognition system
**Tags:** voice, speaker-recognition, implementation, phase-2
**Priority:** high
**Description:**
Implement speaker recognition system to identify and track speakers across voice messages. Store speaker profiles and match new audio.

**Gherkin Scenarios:**

```gherkin
Scenario: Extract speaker embeddings
  Given a voice audio file
  When I extract speaker embeddings
  Then I should receive a feature vector
  And the vector should represent speaker characteristics
  And the vector should be suitable for comparison

Scenario: Store speaker profile in database
  Given speaker embeddings and metadata
  When I store the speaker profile
  Then the profile should be saved to database
  And the profile should include Telegram user ID
  And the profile should include creation timestamp

Scenario: Match speaker against profiles
  Given new speaker embeddings
  And existing speaker profiles
  When I perform matching
  Then I should calculate similarity scores
  And I should return best match above threshold
  And I should return confidence score
```

### 2.10 Write integration tests for voice transcription pipeline
**Tags:** tdd, testing, voice, integration, phase-2
**Priority:** high
**Description:**
Write end-to-end integration tests for complete voice transcription pipeline: download -> transcribe -> diarize -> recognize speakers.

**Gherkin Scenarios:**

```gherkin
Scenario: Complete voice message processing
  Given a voice message in Telegram group chat
  When the bot receives the voice message
  Then it should download the audio file
  And it should transcribe the audio to text
  And it should perform speaker diarization
  And it should recognize speakers
  And it should send formatted transcription to chat
  And it should clean up temp files

Scenario: Multi-speaker voice message
  Given a voice message with two speakers
  When the bot processes the message
  Then the transcription should show both speakers
  And each speaker's text should be labeled
  And the output should be formatted as conversation

Scenario: Voice processing with errors
  Given a voice message that fails to transcribe
  When the bot processes the message
  Then it should handle the error gracefully
  And it should notify the user of the failure
  And it should clean up temp files
  And it should not crash the bot
```

---

## Phase 3: Ollama Integration (Priority: High)

### 3.1 Write tests for Ollama client wrapper
**Tags:** tdd, testing, ollama, llm, phase-3
**Priority:** high
**Description:**
TDD: Write tests for Ollama client that communicates with local Ollama API for LLM inference.

**Gherkin Scenarios:**

```gherkin
Scenario: Initialize Ollama client
  Given Ollama is running on localhost:11434
  When I initialize OllamaClient
  Then the client should connect to Ollama API
  And the client should verify API is reachable

Scenario: Generate completion successfully
  Given a connected Ollama client
  And a prompt text
  When I call generate with model 'gemma2:2b'
  Then I should receive a completion response
  And the response should include generated text
  And the response should include metadata

Scenario: Handle Ollama API unavailable
  Given Ollama is not running
  When I attempt to generate completion
  Then the client should throw connection error
  And the error should indicate Ollama is unreachable

Scenario: Handle model not found
  Given Ollama is running
  When I request non-existent model
  Then the client should throw model error
  And the error should indicate model not found

Scenario: Stream completion tokens
  Given a connected Ollama client
  When I call generate with stream:true
  Then I should receive tokens as they are generated
  And each token should be yielded immediately
  And the stream should complete when done
```

### 3.2 Implement Ollama client wrapper
**Tags:** ollama, llm, implementation, phase-3
**Priority:** high
**Description:**
Implement OllamaClient class that wraps Ollama API for generating completions with gemma2:2b and other models.

**Gherkin Scenarios:**

```gherkin
Scenario: Send generation request to Ollama
  Given a prompt and model name
  When I call ollamaClient.generate()
  Then it should POST to /api/generate
  And it should include model and prompt in request
  And it should handle response streaming
  And it should return complete response

Scenario: Configure generation parameters
  Given generation options
  When I call generate with temperature and top_p
  Then the options should be included in request
  And Ollama should use the specified parameters
```

### 3.3 Write tests for intent detection with LLM
**Tags:** tdd, testing, ollama, nlp, phase-3
**Priority:** high
**Description:**
TDD: Write tests for detecting user intent from natural language messages using gemma2:2b.

**Gherkin Scenarios:**

```gherkin
Scenario: Detect create todo intent
  Given a message 'I need to buy groceries tomorrow'
  When I detect intent
  Then the intent should be 'create_todo'
  And confidence should be high

Scenario: Detect list todos intent
  Given a message 'What do I need to do today?'
  When I detect intent
  Then the intent should be 'list_todos'
  And confidence should be high

Scenario: Detect update todo intent
  Given a message 'Mark the grocery task as done'
  When I detect intent
  Then the intent should be 'update_todo'
  And confidence should be high

Scenario: Detect no todo intent
  Given a message 'Hello, how are you?'
  When I detect intent
  Then the intent should be 'none'
  And confidence should be high

Scenario: Handle ambiguous intent
  Given a message with unclear intent
  When I detect intent
  Then the confidence should be low
  And the system should ask for clarification

Scenario: Detect intent from voice transcription
  Given a transcribed voice message
  When I detect intent
  Then the intent should be detected despite transcription errors
  And the system should be robust to speech artifacts
```

### 3.4 Implement intent detection with gemma2:2b
**Tags:** ollama, nlp, implementation, phase-3
**Priority:** high
**Description:**
Implement intent detection using gemma2:2b model to classify user messages into todo-related intents.

**Gherkin Scenarios:**

```gherkin
Scenario: Create intent detection prompt
  Given a user message
  When I create the intent detection prompt
  Then the prompt should include intent categories
  And the prompt should include examples
  And the prompt should request JSON output
  And the prompt should specify confidence score

Scenario: Parse intent from LLM response
  Given LLM response with intent JSON
  When I parse the response
  Then I should extract intent type
  And I should extract confidence score
  And I should handle malformed JSON gracefully
```

### 3.5 Write tests for todo extraction from natural language
**Tags:** tdd, testing, ollama, nlp, phase-3
**Priority:** high
**Description:**
TDD: Write tests for extracting todo information (text, priority, project, tags) from natural language.

**Gherkin Scenarios:**

```gherkin
Scenario: Extract simple todo
  Given a message 'I need to buy groceries'
  When I extract todo information
  Then text should be 'buy groceries'
  And priority should be default
  And project should be default

Scenario: Extract todo with priority
  Given a message 'Urgent: fix the production bug'
  When I extract todo information
  Then text should be 'fix the production bug'
  And priority should be 'urgent'

Scenario: Extract todo with project
  Given a message 'For work: review the pull request'
  When I extract todo information
  Then text should be 'review the pull request'
  And project should be 'work'

Scenario: Extract todo with tags
  Given a message 'Buy groceries, this is urgent and for home'
  When I extract todo information
  Then text should be 'Buy groceries'
  And tags should include 'urgent' and 'home'

Scenario: Extract todo with due date
  Given a message 'I need to submit the report by Friday'
  When I extract todo information
  Then text should be 'submit the report'
  And due date should be next Friday

Scenario: Extract multiple todos
  Given a message 'I need to buy groceries and also fix the bug'
  When I extract todo information
  Then I should receive two todos
  And first todo should be 'buy groceries'
  And second todo should be 'fix the bug'

Scenario: Handle incomplete information
  Given a message 'I should do that thing'
  When I extract todo information
  Then text should be 'do that thing'
  And the system should flag as vague
  And the system should suggest asking for clarification
```

### 3.6 Implement todo information extraction
**Tags:** ollama, nlp, implementation, phase-3
**Priority:** high
**Description:**
Implement NLP extraction of todo information from natural language using gemma2:2b.

**Gherkin Scenarios:**

```gherkin
Scenario: Create extraction prompt
  Given a user message with create_todo intent
  When I create the extraction prompt
  Then the prompt should request structured todo data
  And the prompt should specify all todo fields
  And the prompt should include examples
  And the prompt should request JSON output

Scenario: Parse extracted todo data
  Given LLM response with todo JSON
  When I parse the response
  Then I should extract all todo fields
  And I should validate field values
  And I should apply defaults for missing fields
  And I should handle malformed JSON
```

### 3.7 Write tests for conversation context handling
**Tags:** tdd, testing, ollama, context, phase-3
**Priority:** high
**Description:**
TDD: Write tests for maintaining conversation context across messages for better intent detection and extraction.

**Gherkin Scenarios:**

```gherkin
Scenario: Initialize conversation context
  Given a new conversation with a user
  When I initialize context
  Then context should be empty
  And context should be ready to store messages

Scenario: Add message to context
  Given an existing conversation context
  When a new message arrives
  Then the message should be added to context
  And the context should maintain message order
  And the context should include timestamps

Scenario: Use context for intent detection
  Given a conversation context with previous messages
  And a new ambiguous message 'Can you mark it as done?'
  When I detect intent with context
  Then the system should reference previous messages
  And the system should resolve 'it' to previous todo
  And the intent should be 'update_todo'

Scenario: Limit context window size
  Given a conversation with many messages
  When the context exceeds maximum size
  Then older messages should be removed
  And recent messages should be retained
  And the context should stay within token limit

Scenario: Clear context on timeout
  Given a conversation context
  When no messages arrive for 30 minutes
  Then the context should be cleared
  And the next message should start fresh context

Scenario: Handle multi-turn todo creation
  Given a message 'I need to do something'
  When I ask 'What do you need to do?'
  And user replies 'Buy groceries'
  Then the system should create todo with context
  And the todo should be 'Buy groceries'
```

### 3.8 Implement conversation context management
**Tags:** ollama, context, implementation, phase-3
**Priority:** high
**Description:**
Implement conversation context management to track message history and improve NLP understanding.

**Gherkin Scenarios:**

```gherkin
Scenario: Store context per user
  Given multiple users in group chat
  When messages arrive from different users
  Then each user should have separate context
  And contexts should not interfere

Scenario: Include context in LLM prompts
  Given a user message with context
  When I create LLM prompt
  Then the prompt should include recent messages
  And the prompt should format context clearly
  And the prompt should stay within token limit
```

### 3.9 Write integration tests for Ollama NLP pipeline
**Tags:** tdd, testing, ollama, integration, phase-3
**Priority:** high
**Description:**
Write end-to-end integration tests for complete Ollama NLP pipeline: intent detection -> information extraction -> todo creation.

**Gherkin Scenarios:**

```gherkin
Scenario: Natural language todo creation
  Given a message 'I need to buy groceries tomorrow'
  When the bot processes the message
  Then it should detect create_todo intent
  And it should extract todo information
  And it should create todo via MCP
  And it should confirm todo creation to user

Scenario: Natural language with voice transcription
  Given a voice message transcribed to 'I need to fix the urgent bug'
  When the bot processes the transcription
  Then it should detect create_todo intent
  And it should extract priority as 'urgent'
  And it should create high priority todo

Scenario: Conversational todo update
  Given a previous message created todo with ID '123'
  And a new message 'Mark it as done'
  When the bot processes with context
  Then it should detect update_todo intent
  And it should resolve 'it' to todo '123'
  And it should update todo status to done

Scenario: Handle LLM failures gracefully
  Given Ollama is unavailable
  When a natural language message arrives
  Then the bot should fall back to command parsing
  Or the bot should ask user to use explicit commands
  And the bot should not crash
```

---

## Phase 4: GitLab Integration (Priority: Medium)

### 4.1 Write tests for GitLab API client
**Tags:** tdd, testing, gitlab, api, phase-4
**Priority:** medium
**Description:**
TDD: Write tests for GitLab API client that interacts with GitLab API for repository operations.

**Gherkin Scenarios:**

```gherkin
Scenario: Initialize GitLab client
  Given GitLab API URL and access token
  When I initialize GitLabClient
  Then the client should validate credentials
  And the client should be ready for API calls

Scenario: Create repository successfully
  Given a valid GitLab client
  And a repository name and description
  When I create a repository
  Then the repository should be created in GitLab
  And I should receive repository URL
  And I should receive repository ID

Scenario: Handle repository already exists
  Given a repository name that already exists
  When I attempt to create the repository
  Then the client should detect existing repository
  And the client should return existing repository info
  Or the client should throw appropriate error

Scenario: Get repository information
  Given an existing repository ID
  When I get repository info
  Then I should receive repository details
  And details should include name, URL, and visibility

Scenario: Handle authentication failure
  Given an invalid access token
  When I make API request
  Then the client should throw authentication error
  And the error should indicate invalid credentials

Scenario: Handle network errors
  Given GitLab API is unreachable
  When I make API request
  Then the client should throw network error
  And the client should include retry information
```

### 4.2 Implement GitLab API client
**Tags:** gitlab, api, implementation, phase-4
**Priority:** medium
**Description:**
Implement GitLabClient class that wraps GitLab API for repository management operations.

**Gherkin Scenarios:**

```gherkin
Scenario: Make authenticated API request
  Given a GitLab API endpoint
  When I make a request
  Then the request should include access token header
  And the request should use proper HTTP method
  And the response should be parsed as JSON

Scenario: Create repository via API
  Given repository parameters
  When I call createRepository()
  Then it should POST to /api/v4/projects
  And it should include name and description
  And it should handle response
```

### 4.3 Write tests for repository initialization tool
**Tags:** tdd, testing, gitlab, init, phase-4
**Priority:** medium
**Description:**
TDD: Write tests for repository initialization tool that creates GitLab repo and sets it as MCP server remote.

**Gherkin Scenarios:**

```gherkin
Scenario: Initialize repository with default settings
  Given a repository name
  When I initialize the repository
  Then a GitLab repository should be created
  And the repository should be set as git remote
  And the MCP server should use the new remote
  And initial sync should be performed

Scenario: Initialize with custom settings
  Given a repository name and visibility setting
  When I initialize with visibility 'private'
  Then the GitLab repository should be private
  And the repository should be configured correctly

Scenario: Handle existing git remote
  Given MCP server already has a git remote
  When I attempt to initialize
  Then the tool should detect existing remote
  And the tool should ask for confirmation to override
  Or the tool should fail with appropriate error

Scenario: Validate repository name
  Given an invalid repository name
  When I attempt to initialize
  Then the tool should validate the name
  And the tool should reject invalid names
  And the tool should provide valid name examples

Scenario: Handle GitLab API failures
  Given GitLab API is unavailable
  When I attempt to initialize
  Then the tool should fail gracefully
  And the tool should not modify git configuration
  And the tool should provide troubleshooting info
```

### 4.4 Implement repository initialization tool
**Tags:** gitlab, init, implementation, phase-4
**Priority:** medium
**Description:**
Implement repository initialization tool that creates GitLab repository and configures MCP server to use it.

**Gherkin Scenarios:**

```gherkin
Scenario: Create and configure repository
  Given repository parameters
  When I run initialization
  Then it should create GitLab repository
  And it should add git remote to MCP repo
  And it should update MCP server configuration
  And it should perform initial push

Scenario: Update MCP server environment
  Given a new GitLab repository URL
  When I configure MCP server
  Then TODO_REPO_URL should be updated
  And AUTO_SYNC should be enabled
  And the server should restart with new config
```

### 4.5 Write tests for /init command in Telegram
**Tags:** tdd, testing, telegram, gitlab, phase-4
**Priority:** medium
**Description:**
TDD: Write tests for /init command that allows initializing GitLab repository from Telegram.

**Gherkin Scenarios:**

```gherkin
Scenario: Initialize repository via Telegram
  Given an authorized user
  When I send /init my-todo-repo
  Then the bot should validate repository name
  And the bot should create GitLab repository
  And the bot should configure MCP server
  And the bot should confirm initialization

Scenario: Initialize with description
  Given an authorized user
  When I send /init my-repo "My personal todo list"
  Then the repository should be created with description

Scenario: Handle initialization errors
  Given an authorized user
  When I send /init with invalid name
  Then the bot should return error message
  And the bot should not create repository

Scenario: Show initialization status
  Given repository initialization in progress
  When I check status
  Then the bot should show progress updates
  And the bot should indicate when complete

Scenario: Prevent duplicate initialization
  Given MCP server already has GitLab remote
  When I send /init command
  Then the bot should detect existing configuration
  And the bot should ask for confirmation
  And the bot should warn about override
```

### 4.6 Integrate /init command with Telegram bot
**Tags:** telegram, gitlab, implementation, phase-4
**Priority:** medium
**Description:**
Implement /init command handler that integrates GitLab repository initialization with Telegram bot.

**Gherkin Scenarios:**

```gherkin
Scenario: Parse init command
  Given a command /init my-repo "Description"
  When I parse the command
  Then repository name should be 'my-repo'
  And description should be 'Description'
  And visibility should be default

Scenario: Execute initialization workflow
  Given parsed init command
  When I execute initialization
  Then I should create GitLab repository
  And I should configure MCP server
  And I should send status updates to Telegram
  And I should handle errors gracefully
```

### 4.7 Write integration tests for GitLab initialization flow
**Tags:** tdd, testing, gitlab, integration, phase-4
**Priority:** medium
**Description:**
Write end-to-end integration tests for complete GitLab initialization flow from Telegram command to working sync.

**Gherkin Scenarios:**

```gherkin
Scenario: Complete initialization workflow
  Given a Telegram bot with GitLab integration
  When I send /init test-repo
  Then a GitLab repository should be created
  And the MCP server should be configured
  And the MCP server should sync to GitLab
  And I should receive confirmation in Telegram
  And subsequent todo operations should sync to GitLab

Scenario: Verify sync after initialization
  Given a successfully initialized repository
  When I create a todo via Telegram
  Then the todo should be created in MCP
  And the todo should be synced to GitLab
  And the GitLab repository should show the commit

Scenario: Handle initialization rollback
  Given initialization fails at configuration step
  When the error occurs
  Then the GitLab repository should be deleted
  Or the repository should be marked for cleanup
  And the MCP server should not be modified
  And the user should be notified of failure
```

---

## Phase 5: Documentation (Priority: Low)

### 5.1 Create TELEGRAM_BOT.md documentation
**Tags:** documentation, telegram, phase-5
**Priority:** low
**Description:**
Create comprehensive documentation for Telegram bot with voice transcription features.

**Gherkin Scenarios:**

```gherkin
Scenario: Document bot setup
  Given TELEGRAM_BOT.md file
  When I document setup instructions
  Then I should include prerequisites
  And I should include environment variables
  And I should include installation steps
  And I should include configuration examples

Scenario: Document voice features
  Given voice transcription capabilities
  When I document voice features
  Then I should explain Whisper integration
  And I should explain speaker diarization
  And I should explain speaker recognition
  And I should include usage examples

Scenario: Document commands
  Given all implemented commands
  When I document commands
  Then I should list all commands with syntax
  And I should provide usage examples
  And I should explain command options
  And I should include screenshots or examples

Scenario: Document natural language features
  Given Ollama NLP integration
  When I document NLP features
  Then I should explain intent detection
  And I should provide natural language examples
  And I should explain context handling
  And I should document limitations

Scenario: Document GitLab integration
  Given GitLab repository initialization
  When I document GitLab features
  Then I should explain /init command
  And I should explain sync behavior
  And I should provide setup examples
  And I should document troubleshooting
```

### 5.2 Create ADR-003 for Telegram bot architecture
**Tags:** documentation, adr, architecture, phase-5
**Priority:** low
**Description:**
Create Architecture Decision Record for Telegram bot implementation decisions.

**Gherkin Scenarios:**

```gherkin
Scenario: Document Whisper implementation choice
  Given research on Whisper options
  When I document the decision
  Then I should explain options evaluated
  And I should justify chosen implementation
  And I should document trade-offs
  And I should note future considerations

Scenario: Document speaker diarization approach
  Given pyannote.audio integration
  When I document the decision
  Then I should explain why pyannote.audio
  And I should document Python-Node.js bridge
  And I should explain alternative approaches
  And I should document performance implications

Scenario: Document Ollama model selection
  Given gemma2:2b model choice
  When I document the decision
  Then I should explain model selection criteria
  And I should document model capabilities
  And I should explain size vs accuracy trade-off
  And I should note when to use larger models

Scenario: Document authentication strategy
  Given single-user authorization
  When I document the decision
  Then I should explain security considerations
  And I should document why single-user
  And I should explain future multi-user path
  And I should document access control

Scenario: Document GitLab integration approach
  Given GitLab API usage
  When I document the decision
  Then I should explain why GitLab
  And I should document API vs git operations
  And I should explain initialization workflow
  And I should document sync strategy
```

### 5.3 Update README.md with Telegram bot features
**Tags:** documentation, readme, phase-5
**Priority:** low
**Description:**
Update main README.md to include Telegram bot as a third interface alongside MCP and Web UI.

**Gherkin Scenarios:**

```gherkin
Scenario: Add Telegram bot to architecture section
  Given existing architecture documentation
  When I update the architecture section
  Then I should add Telegram bot interface
  And I should show Telegram bot architecture diagram
  And I should explain how it relates to MCP server
  And I should update the interface comparison

Scenario: Add Telegram bot to features list
  Given existing features list
  When I update features
  Then I should add voice transcription
  And I should add speaker recognition
  And I should add natural language processing
  And I should add GitLab initialization

Scenario: Add Telegram bot setup to quick start
  Given existing quick start guide
  When I update quick start
  Then I should add Telegram bot setup steps
  And I should include environment variables
  And I should link to detailed documentation
  And I should add troubleshooting tips

Scenario: Update command reference
  Given existing command documentation
  When I update commands
  Then I should add Telegram commands
  And I should compare with MCP tools
  And I should explain command equivalents
  And I should note Telegram-specific features
```

### 5.4 Update CHANGELOG.md with Telegram bot release
**Tags:** documentation, changelog, phase-5
**Priority:** low
**Description:**
Update CHANGELOG.md to document Telegram bot implementation as a new major feature release.

**Gherkin Scenarios:**

```gherkin
Scenario: Document new features
  Given Telegram bot implementation
  When I update changelog
  Then I should list all new features
  And I should use semantic versioning
  And I should categorize changes appropriately
  And I should include migration notes if needed

Scenario: Document breaking changes
  Given any breaking changes
  When I update changelog
  Then I should clearly mark breaking changes
  And I should explain impact
  And I should provide migration path
  And I should update version appropriately

Scenario: Document new dependencies
  Given new dependencies added
  When I update changelog
  Then I should list new dependencies
  And I should explain why they're needed
  And I should note version requirements
  And I should document installation steps

Scenario: Add usage examples to changelog
  Given new Telegram bot features
  When I update changelog
  Then I should include usage examples
  And I should link to full documentation
  And I should highlight key capabilities
  And I should note known limitations
```

### 5.5 Create example configuration files for Telegram bot
**Tags:** documentation, examples, config, phase-5
**Priority:** low
**Description:**
Create example configuration files and environment templates for easy Telegram bot setup.

**Gherkin Scenarios:**

```gherkin
Scenario: Create .env.telegram.example
  Given required environment variables
  When I create example file
  Then I should include all required variables
  And I should include optional variables
  And I should add comments explaining each variable
  And I should provide example values
  And I should note where to get credentials

Scenario: Create docker-compose.telegram.yml
  Given Telegram bot with dependencies
  When I create docker-compose file
  Then I should include bot service
  And I should include Ollama service
  And I should include volume mounts
  And I should configure networking
  And I should document usage

Scenario: Create systemd service example
  Given Telegram bot as system service
  When I create systemd unit file
  Then I should configure service properly
  And I should include restart policy
  And I should configure logging
  And I should document installation

Scenario: Create development setup script
  Given development environment needs
  When I create setup script
  Then I should automate dependency installation
  And I should configure environment
  And I should verify setup
  And I should provide troubleshooting
```

---

## Summary

**Total Tasks:** 47 todos across 5 phases

**Phase Breakdown:**
- Phase 1 (Core Telegram Bot): 16 tasks - Priority: High
- Phase 2 (Voice Transcription): 10 tasks - Priority: High
- Phase 3 (Ollama Integration): 9 tasks - Priority: High
- Phase 4 (GitLab Integration): 7 tasks - Priority: Medium
- Phase 5 (Documentation): 5 tasks - Priority: Low

**Approach:** Test-Driven Development (TDD) with Gherkin scenarios for each task

**Key Technologies:**
- Telegram Bot API (node-telegram-bot-api)
- Whisper (speech-to-text)
- pyannote.audio (speaker diarization)
- Ollama with gemma2:2b (natural language processing)
- GitLab API (repository management)
- MCP Server (todo management backend)

**Next Steps:**
1. Import these todos into the git-todo MCP system using the web UI or MCP tools
2. Start with Phase 1 tasks to establish the foundation
3. Follow TDD approach: write tests first, then implement
4. Use Gherkin scenarios as acceptance criteria for each task
