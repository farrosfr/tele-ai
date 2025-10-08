require('dotenv').config();
const { Telegraf } = require('telegraf');
const { OpenAI } = require("openai");

// --- Inisialisasi Kunci API dan Klien ---
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!BOT_TOKEN || !OPENAI_API_KEY) {
    throw new Error('"TELEGRAM_BOT_TOKEN" dan "OPENAI_API_KEY" harus ada di file .env');
}

const bot = new Telegraf(BOT_TOKEN);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });


// --- Fungsi untuk memanggil AI (Otak Bot) ---
async function getAIResponse(userInput, userName) {
    try {
        const instructions = `Anda adalah Diko, asisten AI di Telegram. Sapa pengguna bernama "${userName}". Jawab pertanyaan mereka dengan jelas dan ramah dalam bahasa Indonesia.`;

        const response = await openai.responses.create({
            model: "gpt-5-mini",
            instructions: instructions,
            input: userInput,
        });

        return response.output_text;

    } catch (error) { // <-- PERBAIKAN DI SINI: Ditambahkan kurung kurawal
        console.error("Error saat memanggil OpenAI API:", error);
        return "Maaf, sepertinya AI sedang mengalami sedikit gangguan. Coba lagi nanti ya. 🙏";
    }
}


// --- Logika Bot Telegram ---

bot.start((ctx) => {
    const userName = ctx.message.from.first_name || "Pengguna";
    ctx.reply(`Halo ${userName}! 👋\n\nSaya Diko, bot AI yang siap membantu. Di grup, panggil nama saya 'Diko' agar saya merespons.`);
});

// Menangani semua pesan teks yang masuk
bot.on('text', async (ctx) => {
    const userInput = ctx.message.text;
    const userName = ctx.message.from.first_name || "Pengguna";
    const chatType = ctx.chat.type;

    const shouldRespond = chatType === 'private' || userInput.toLowerCase().includes('diko');

    if (shouldRespond) {
        console.log(`[TRIGGERED] Pesan dari ${userName} di chat ${chatType}: ${userInput}`);
        
        await ctx.replyWithChatAction('typing');
        const aiResponse = await getAIResponse(userInput, userName);
        await ctx.reply(aiResponse, { reply_to_message_id: ctx.message.message_id });
    }
});


// --- Menjalankan Bot ---
bot.launch();
console.log('Bot Telegram AI sedang berjalan...');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));