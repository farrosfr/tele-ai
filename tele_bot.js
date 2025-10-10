require('dotenv').config();
const { Telegraf } = require('telegraf');
const { OpenAI } = require("openai");
const axios = require('axios');
const cheerio = require('cheerio');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!BOT_TOKEN || !OPENAI_API_KEY) {
    throw new Error('"TELEGRAM_BOT_TOKEN" dan "OPENAI_API_KEY" harus ada di file .env');
}

const bot = new Telegraf(BOT_TOKEN);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// --- FUNGSI PEMECAH PESAN PANJANG ---
async function sendLongMessage(ctx, message) {
    const MAX_LENGTH = 4096;
    if (message.length <= MAX_LENGTH) {
        return await ctx.reply(message, { reply_to_message_id: ctx.message.message_id });
    }
    // ... (sisa fungsi sendLongMessage tetap sama)
    console.log(`[INFO] Pesan terlalu panjang (${message.length} karakter), akan dipecah.`);
    const messageParts = [];
    let currentPart = '';
    const lines = message.split('\n');
    for (const line of lines) {
        if (currentPart.length + line.length + 1 > MAX_LENGTH) {
            messageParts.push(currentPart);
            currentPart = '';
        }
        currentPart += line + '\n';
    }
    messageParts.push(currentPart);
    await ctx.reply(messageParts[0], { reply_to_message_id: ctx.message.message_id });
    for (let i = 1; i < messageParts.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 500));
        await ctx.reply(messageParts[i]);
    }
}


// --- Fungsi AI untuk Teks ---
async function getAIResponse(userInput, userName) {
    try {
        const instructions = `Anda adalah Diko, asisten pendidikan AI di Telegram. Sapa pengguna dengan Bapak/Ibu berdasarkan nama beliau: "${userName}". Jawab pertanyaan mereka dengan jelas dan sopan dalam bahasa Indonesia. Gunakan bahasa yang mudah dimengerti, hindari jargon teknis. Jika pertanyaan tidak jelas, minta klarifikasi. Jika pertanyaan di luar topik pendidikan, jawab dengan sopan bahwa Anda hanya fokus pada pendidikan. Respon maksimal 3200 karakter.`;
        const response = await openai.responses.create({
            model: "gpt-5-mini",
            instructions: instructions,
            input: userInput,
        });
        return response.output_text;
    } catch (error) {
        console.error("Error saat memanggil OpenAI API (Teks):", error);
        return "Maaf, sepertinya AI sedang mengalami sedikit gangguan. 🙏";
    }
}

// --- FUNGSI AI BARU UNTUK GAMBAR (VISION) ---
async function getAIResponseWithImage(caption, userName, imageUrl) {
    try {
        const fullPrompt = `Anda adalah Diko, asisten pendidikan AI. Pengguna bernama "${userName}" mengirim sebuah gambar. Berdasarkan gambar tersebut dan caption yang diberikan, berikan analisis atau jawaban yang relevan dengan dunia pendidikan. Caption: "${caption}"`;

        const response = await openai.responses.create({
            // Pastikan menggunakan model yang mendukung vision, contoh: gpt-4o, gpt-4-turbo
            model: "gpt-4o", 
            input: [
                {
                    role: "user",
                    content: [
                        { type: "input_text", text: fullPrompt },
                        {
                            type: "input_image",
                            image_url: imageUrl, // Kirim URL gambar ke OpenAI
                        },
                    ],
                },
            ],
        });
        return response.output_text;
    } catch (error) {
        console.error("Error saat memanggil OpenAI API (Vision):", error);
        return "Maaf, Diko kesulitan menganalisis gambar ini.  Coba lagi nanti ya. 🙏";
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
    ctx.reply(`Halo ${userName}! 👋\n\nSaya Diko, Asisten AI untuk membantu guru dan siswa di dunia pendidikan.`);
});

// --- LISTENER BARU UNTUK PESAN FOTO ---
bot.on('photo', async (ctx) => {
    const caption = ctx.message.caption || '';
    const userName = ctx.message.from.first_name || "Pengguna";

    // Cek apakah caption mengandung kata "diko"
    if (caption.toLowerCase().includes('diko')) {
        console.log(`[PHOTO DETECTED] Gambar dengan caption 'diko' dari ${userName}.`);
        await ctx.replyWithChatAction('typing');

        try {
            // Dapatkan URL gambar dari Telegram
            // 'photo' adalah array, ambil foto kualitas terbaik (terakhir)
            const fileId = ctx.message.photo.pop().file_id;
            const imageUrl = await ctx.telegram.getFileLink(fileId);

            // Panggil fungsi AI Vision dengan URL gambar
            const aiResponse = await getAIResponseWithImage(caption, userName, imageUrl.href);
            await sendLongMessage(ctx, aiResponse);

        } catch (error) {
            console.error("Error saat memproses gambar:", error);
            await ctx.reply("Maaf, terjadi kesalahan saat saya mencoba melihat gambar tersebut.");
        }
    }
});


// Listener untuk pesan teks (tidak berubah banyak)
bot.on('text', async (ctx) => {
    if (!botInfo) return;

    const userInput = ctx.message.text;
    const userName = ctx.message.from.first_name || "Pengguna";
    const chatType = ctx.chat.type;
    const repliedMessage = ctx.message.reply_to_message;

    // ... (sisa kode 'text' listener tetap sama) ...
    const processAndReply = async (input) => {
        await ctx.replyWithChatAction('typing');
        const aiResponse = await getAIResponse(input, userName);
        await sendLongMessage(ctx, aiResponse);
    };
    if (repliedMessage && repliedMessage.from.id === botInfo.id) {
        console.log(`[REPLY DETECTED] Balasan dari ${userName}`);
        const chatHistory = [{ role: "assistant", content: repliedMessage.text }, { role: "user", content: userInput }];
        await processAndReply(chatHistory);
        return;
    }
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urlsFound = userInput.match(urlRegex);
    if (urlsFound) {
        console.log(`https://dictionary.cambridge.org/dictionary/english/detected Link dari ${userName}: ${urlsFound[0]}`);
        await ctx.reply(`Mendeteksi link, saya akan coba merangkumnya... 📄`, { reply_to_message_id: ctx.message.message_id });
        try {
            const { data } = await axios.get(urlsFound[0]);
            const $ = cheerio.load(data);
            const mainText = $('p').text().replace(/\s\s+/g, ' ').trim();
            if (mainText.length < 200) {
                await ctx.reply("Maaf, tidak cukup teks paragraf untuk dirangkum.", { reply_to_message_id: ctx.message.message_id });
                return;
            }
            const promptForSummary = `Rangkum poin-poin utama dari artikel berikut dalam 3-5 kalimat, dalam bahasa Indonesia: "${mainText.substring(0, 4000)}"`;
            await processAndReply(promptForSummary);
        } catch (error) {
            console.error("Gagal merangkum URL:", error.message);
            await ctx.reply("Maaf, terjadi kesalahan saat mengakses link tersebut.", { reply_to_message_id: ctx.message.message_id });
        }
        return;
    }
    const shouldRespond = chatType === 'private' || userInput.toLowerCase().includes('diko');
    if (shouldRespond) {
        console.log(`[TRIGGERED] Pesan dari ${userName} di ${chatType}`);
        await processAndReply(userInput);
    }
});

bot.launch();
console.log('Bot Telegram AI sedang berjalan...');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));