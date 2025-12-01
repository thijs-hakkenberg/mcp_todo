/**
 * Telegram bot entry point
 * Loads environment variables and starts the bot
 */

import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config({ debug: false });

// Import and start the bot
import { main } from './bot';

// Run the bot
main();
