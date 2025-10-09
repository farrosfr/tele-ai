require('dotenv').config();
const { Telegraf } = require('telegraf');
const { OpenAI } = require("openai");
const axios = require('axios'); // <-- Impor library baru
const cheerio = require('cheerio'); // <-- Impor library baru

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
    } catch (error) {
        console.error("Error saat memanggil OpenAI API:", error);
        return "Maaf, sepertinya AI sedang mengalami sedikit gangguan. Coba lagi nanti ya. 🙏";
    }
}

// --- Logika Bot Telegram ---
let botInfo;
bot.telegram.getMe().then(info => {
    botInfo = info;
    console.log(`Bot info berhasil dimuat: ${botInfo.first_name} (@${botInfo.username})`);
});

bot.start((ctx) => {
    const userName = ctx.message.from.first_name || "Pengguna";
    ctx.reply(`Halo ${userName}! 👋\n\nSaya Diko, bot AI yang siap membantu. Di grup, panggil nama saya 'Diko' atau balas pesan saya agar saya merespons.`);
});

bot.on('text', async (ctx) => {
    if (!botInfo) return;

    const userInput = ctx.message.text;
    const userName = ctx.message.from.first_name || "Pengguna";
    const chatType = ctx.chat.type;
    const repliedMessage = ctx.message.reply_to_message;

    // --- LOGIKA BARU DENGAN PRIORITAS ---

    // PRIORITAS 1: Cek apakah ini balasan ke sebuah pesan
    if (repliedMessage) {
        const originalMessageText = repliedMessage.text || "";
        const userReplyText = userInput.toLowerCase();

        // Sub-Prioritas 1.1: Cek permintaan rangkuman artikel
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const urls = originalMessageText.match(urlRegex);
        
        if (urls && userReplyText.includes('diko') && (userReplyText.includes('rangkum') || userReplyText.includes('summary'))) {
            console.log(`[SUMMARY DETECTED] Permintaan rangkuman dari ${userName} untuk link: ${urls[0]}`);
            await ctx.replyWithChatAction('typing');
            
            try {
                // Ambil konten web
                const { data } = await axios.get(urls[0]);
                // Ekstrak teks dari HTML
                const $ = cheerio.load(data);
                const mainText = $('body').text().replace(/\s\s+/g, ' ').trim();

                if (mainText.length < 100) {
                    await ctx.reply("Maaf, saya tidak bisa menemukan cukup teks untuk dirangkum dari link tersebut.", { reply_to_message_id: ctx.message.message_id });
                    return;
                }

                // Buat prompt untuk AI
                const promptForSummary = `Rangkum poin-poin utama dari artikel berikut dalam 3-5 kalimat: "${mainText.substring(0, 4000)}"`;
                const summary = await getAIResponse(promptForSummary, userName);
                await ctx.reply(`Berikut rangkuman dari artikel tersebut:\n\n${summary}`, { reply_to_message_id: ctx.message.message_id });

            } catch (error) {
                console.error("Gagal mengambil atau merangkum URL:", error);
                await ctx.reply("Maaf, terjadi kesalahan saat mencoba mengakses atau merangkum link tersebut.", { reply_to_message_id: ctx.message.message_id });
            }
            return;
        }

        // Sub-Prioritas 1.2: Cek balasan ke bot untuk melanjutkan percakapan
        if (repliedMessage.from.id === botInfo.id) {
            console.log(`[REPLY DETECTED] Balasan dari ${userName} untuk bot.`);
            const chatHistory = [{ role: "assistant", content: originalMessageText }, { role: "user", content: userInput }];
            await ctx.replyWithChatAction('typing');
            const aiResponse = await getAIResponse(chatHistory, userName);
            await ctx.reply(aiResponse, { reply_to_message_id: ctx.message.message_id });
            return;
        }
    }

    // PRIORITAS 2: Jika bukan balasan, jalankan logika panggilan 'diko'
    const shouldRespond = chatType === 'private' || userInput.toLowerCase().includes('diko');
    if (shouldRespond) {
        console.log(`[TRIGGERED] Pesan dari ${userName} di chat ${chatType}: ${userInput}`);
        await ctx.replyWithChatAction('typing');
        const aiResponse = await getAIResponse(userInput, userName);
        await ctx.reply(aiResponse, { reply_to_message_id: ctx.message.message_id });
    }
});

bot.on('new_chat_members', (ctx) => {
    const newMembers = ctx.message.new_chat_members;
    newMembers.forEach((member) => {
        const userName = member.first_name;
        ctx.reply(`Selamat datang di grup, ${userName}! 🎉\n\nJangan lupa baca aturan grup di pesan yang di-pin ya!`);
    });
});

bot.launch();
console.log('Bot Telegram AI sedang berjalan...');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));