/**
 * @file A simple Telegram bot that interacts with an AI.
 * @author Your Name
 * @version 1.0.0
 */

require('dotenv').config();
const { Telegraf } = require('telegraf');

// Fetch the bot token from the .env file.
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) {
    console.error('Error: "TELEGRAM_BOT_TOKEN" must be provided in your .env file.');
    process.exit(1); // Exit the process with an error code
}

const bot = new Telegraf(BOT_TOKEN);

/**
 * Handles the /start command.
 * Greets the user and provides a welcome message.
 */
bot.start((ctx) => {
    const userName = ctx.message.from.first_name;
    ctx.reply(`Hello ${userName}! Welcome to the AI bot. Please ask your questions.`);
});

/**
 * Handles all incoming text messages.
 * It processes the user's input, shows a "typing" indicator,
 * gets a response from the AI, and sends it back to the user.
 */
bot.on('text', async (ctx) => {
    try {
        const userInput = ctx.message.text;
        const userName = ctx.message.from.first_name;
        const chatId = ctx.chat.id;

        console.log(`Message from ${userName} (ID: ${chatId}): ${userInput}`);
        
        // Inform the user that the bot is "typing..."
        await ctx.replyWithChatAction('typing');

        // --- THIS IS WHERE YOU CALL YOUR AI FUNCTION ---
        // Replace this with your AI logic (e.g., OpenAI API call)
        const aiResponse = `AI response for your question "${userInput}" will appear here.`;
        // ---------------------------------------------

        // Send the reply
        await ctx.reply(aiResponse);

    } catch (error) {
        console.error('Error processing message:', error);
        await ctx.reply('Sorry, an error occurred while processing your request.');
    }
});

/**
 * Launches the bot and handles potential startup errors.
 */
async function startBot() {
    try {
        await bot.launch();
        console.log('Telegram bot is running...');
    } catch (error) {
        console.error('Failed to launch the bot:', error);
        process.exit(1);
    }
}

startBot();

// Enable graceful stop on SIGINT and SIGTERM signals
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
