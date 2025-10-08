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
// *** BAGIAN INI TELAH DISESUAIKAN DENGAN DOKUMENTASI BARU ***
async function getAIResponse(userInput, userName) {
    try {
        // 'instructions' memberikan konteks atau kepribadian pada AI
        const instructions = `Anda adalah asisten AI di Telegram. Sapa pengguna bernama "${userName}". Jawab pertanyaan mereka dengan jelas dan ramah dalam bahasa Indonesia.`;

        // Menggunakan client.responses.create sesuai dokumentasi terbaru
        const response = await openai.responses.create({
            model: "gpt-5-mini", // atau model lain seperti "gpt-5"
            instructions: instructions,
            input: userInput, // 'input' langsung berisi teks dari pengguna
        });

        // Mengambil hasil langsung dari 'output_text'
        return response.output_text;

    } catch (error) {
        console.error("Error saat memanggil OpenAI API:", error);
        return "Maaf, sepertinya AI sedang mengalami sedikit gangguan. Coba lagi nanti ya. 🙏";
    }
}


// --- Logika Bot Telegram ---

// Menangani perintah /start
bot.start((ctx) => {
    const userName = ctx.message.from.first_name || "Pengguna";
    ctx.reply(`Halo ${userName}! 👋\n\nSaya adalah bot AI yang siap membantu. Silakan ajukan pertanyaan apa saja.`);
});

// Menangani semua pesan teks yang masuk
bot.on('text', async (ctx) => {
    const userInput = ctx.message.text;
    const userName = ctx.message.from.first_name || "Pengguna";
    
    await ctx.replyWithChatAction('typing');
    const aiResponse = await getAIResponse(userInput, userName);
    await ctx.reply(aiResponse, { reply_to_message_id: ctx.message.message_id });
});

// Menangani pesan selain teks (misal: stiker, gambar)
bot.on('message', (ctx) => {
    if (!ctx.message.text) {
        ctx.reply('Maaf, saat ini saya hanya bisa merespons pesan dalam bentuk teks.', { reply_to_message_id: ctx.message.message_id });
    }
});


// --- Menjalankan Bot ---
bot.launch();
console.log('Bot Telegram AI sedang berjalan...');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));