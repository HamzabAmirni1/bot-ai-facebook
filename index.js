const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const config = require('./config');
const chalk = require('chalk');
const yts = require('yt-search');
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

const app = express().use(bodyParser.json());

const systemPromptText = `You are ${config.botName}, a sophisticated AI assistant created and developed by **Hamza Amirni** (حمزة اعمرني).
- If someone asks who you are, say you are a smart assistant developed by the legendary developer Hamza Amirni.
- If someone asks about Hamza Amirni, describe him as a professional full-stack developer, expert in bots and web development, and also mention he is very handsome and kind.
- You respond fluently in: Moroccan Darija (الدارجة المغربية), Standard Arabic (العربية الفصحى), English, and French.
- Responsably, you are friendly, helpful, and professional.
- ALWAYS respond in the SAME language the user uses.
- For image requests, if someone asks "بغيت صورة" or "صايب ليا صورة", tell them to use the command .imagine followed by the description.
- For "*6 to *3" (نجمة 6) questions, explain that Hamza Amirni offers specialized files (ehi, scl, etc.) for VPNs to do this, and they should contact him on WhatsApp via .owner.`;

// --- SAVETUBE LOGIC ---
const savetube = {
    api: { base: "https://media.savetube.me/api", cdn: "/random-cdn", info: "/v2/info", download: "/download" },
    headers: { 'accept': '*/*', 'content-type': 'application/json', 'origin': 'https://yt.savetube.me', 'referer': 'https://yt.savetube.me/', 'user-agent': 'Postify/1.0.0' },
    crypto: {
        hexToBuffer: (hexString) => Buffer.from(hexString.match(/.{1,2}/g).join(''), 'hex'),
        decrypt: async (enc) => {
            const secretKey = 'C5D58EF67A7584E4A29F6C35BBC4EB12';
            const data = Buffer.from(enc, 'base64');
            const iv = data.slice(0, 16);
            const content = data.slice(16);
            const key = savetube.crypto.hexToBuffer(secretKey);
            const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
            let decrypted = decipher.update(content);
            decrypted = Buffer.concat([decrypted, decipher.final()]);
            return JSON.parse(decrypted.toString());
        }
    },
    download: async (link, format) => {
        try {
            const idMatch = link.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([a-zA-Z0-9_-]{11})/);
            const id = idMatch ? idMatch[1] : null;
            if (!id) throw new Error("Invalid YouTube link");
            const cdnRes = await axios.get(`${savetube.api.base}${savetube.api.cdn}`, { headers: savetube.headers });
            const cdn = cdnRes.data.cdn;
            const infoRes = await axios.post(`https://${cdn}${savetube.api.info}`, { url: `https://www.youtube.com/watch?v=${id}` }, { headers: savetube.headers });
            const decrypted = await savetube.crypto.decrypt(infoRes.data.data);
            const dl = await axios.post(`https://${cdn}${savetube.api.download}`, {
                id: id, downloadType: format === 'mp3' ? 'audio' : 'video', quality: format === 'mp3' ? '128' : format, key: decrypted.key
            }, { headers: savetube.headers });
            return { status: true, result: { title: decrypted.title, download: dl.data.data.downloadUrl } };
        } catch (e) { return { status: false, error: e.message }; }
    }
};

// --- AI FUNCTIONS ---
async function getLuminAIResponse(senderId, message) {
    try {
        const { data } = await axios.post("https://luminai.my.id/", { content: systemPromptText + "\n\nUser: " + message, user: senderId }, { timeout: 8000 });
        return data.result || null;
    } catch (e) { return null; }
}

async function getHectormanuelAI(senderId, message, model = "gpt-4o-mini") {
    try {
        const { data } = await axios.get(`https://all-in-1-ais.officialhectormanuel.workers.dev/?query=${encodeURIComponent(systemPromptText + "\n\nUser: " + message)}&model=${model}`, { timeout: 8000 });
        return data.success ? data.message?.content : null;
    } catch (e) { return null; }
}

async function getGeminiResponse(senderId, text, imageUrl = null) {
    if (!config.geminiApiKey) return null;
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${config.geminiApiKey}`;
        const contents = [{ parts: [{ text: systemPromptText + "\n\nUser: " + text }] }];
        if (imageUrl) {
            const imageRes = await axios.get(imageUrl, { responseType: 'arraybuffer' });
            contents[0].parts.push({ inline_data: { mime_type: "image/jpeg", data: Buffer.from(imageRes.data).toString("base64") } });
        }
        const res = await axios.post(url, { contents }, { timeout: 15000 });
        return res.data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
    } catch (e) { return null; }
}

async function generateAIImage(prompt) {
    return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?nologo=true&enhance=true`;
}

// --- WEBHOOK LOGIC ---
app.get('/webhook', (req, res) => {
    if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === config.VERIFY_TOKEN) {
        res.status(200).send(req.query['hub.challenge']);
    } else { res.sendStatus(403); }
});

app.post('/webhook', (req, res) => {
    if (req.body.object === 'page') {
        req.body.entry.forEach(entry => {
            if (entry.messaging) handleMessage(entry.messaging[0].sender.id, entry.messaging[0].message);
        });
        res.status(200).send('EVENT_RECEIVED');
    } else { res.sendStatus(404); }
});

async function handleMessage(sender_psid, received_message) {
    if (!received_message || (!received_message.text && !received_message.attachments)) return;
    let text = received_message.text || "";
    let imageUrl = null;
    if (received_message.attachments && received_message.attachments[0].type === 'image') {
        imageUrl = received_message.attachments[0].payload.url;
    }

    console.log(chalk.blue(`[MSG] ${sender_psid}: ${text}`));
    sendTypingAction(sender_psid, 'typing_on');

    // 1. Automatic Link Detection
    const ytPattern = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([a-zA-Z0-9_-]{11})/;
    if (ytPattern.test(text)) {
        callSendAPI(sender_psid, { text: "🔗 اكتشفت رابط يوتيوب! جاري التحضير للتحميل..." });
        const res = await savetube.download(text, '720');
        if (res.status) {
            return callSendAPI(sender_psid, { text: `✅ *${res.result.title}*\n\n🎬 رابط الفيديو:\n${res.result.download}\n\n*بواسطة حمزة اعمرني*` });
        }
    }

    const args = text.split(' ');
    const command = args[0].toLowerCase();

    // 2. Arabic/Darija Menu
    if (['.menu', '.help', 'الاوامر', 'menu', 'دليل', 'Menu'].includes(command)) {
        const menu = `🌟 *قائمة أوامر ${config.botName}* 🌟\n\n` +
            `👨‍💻 *المطور:* ${config.ownerName}\n\n` +
            `🖼️ *الذكاء الاصطناعي لرسم الصور:*\n` +
            `🎨 *.imagine [الوصف]* : إنشاء صورة بالذكاء الاصطناعي\n\n` +
            `📽️ *أدوات التحميل (YouTube):*\n` +
            `✨ *.yts [الاسم]* : البحث في اليوتيوب\n` +
            `🎵 *.ytmp3 [الرابط]* : تحميل صوت من اليوتيوب\n` +
            `🎬 *.ytmp4 [الرابط]* : تحميل فيديو من اليوتيوب\n\n` +
            `📖 *المحتوى الديني والترفيهي:*\n` +
            `🕌 *.quran [1-114]* : الاستماع للقرآن الكريم\n` +
            `📚 *.riwaya* : قراءة قصة قصيرة\n` +
            `🕋 *.adhkar* : أذكار وأدعية\n\n` +
            `🔍 *البحث والأدوات:*\n` +
            `🌐 *.wiki [الموضوع]* : البحث في ويكيبيديا\n` +
            `🌍 *.tr [اللغة] [النص]* : الترجمة الفورية\n` +
            `🌦️ *.weather [المدينة]* : حالة الطقس\n` +
            `⚙️ *.n6* : معلومات عن نجمة 6 لنجمة 3\n\n` +
            `👤 *معلومات التواصل:* \n` +
            `👤 *.owner* : حسابات المطور\n` +
            `💻 *.services* : خدماتنا البرمجية\n\n` +
            `📥 *تحميل تلقائي:* غير صيف الرابط د يوتيوب وغادي نتيليشارجيه ليك!\n\n` +
            `🛠️ *تم التطوير من طرف حمزة اعمرني*`;
        return callSendAPI(sender_psid, { text: menu });
    }

    // --- COMMAND HANDLERS ---

    if (command === '.imagine' || command === '.رسم') {
        const prompt = args.slice(1).join(' ');
        if (!prompt) return callSendAPI(sender_psid, { text: "المرجو كتابة وصف الصورة. مثال: .imagine a cat in space" });
        callSendAPI(sender_psid, { text: "🎨 جاري رسم لوحتك... انتظر قليلاً." });
        const imgUrl = await generateAIImage(prompt);
        return callSendAPI(sender_psid, { text: `✅ *النتيجة لـ:* ${prompt}\n\n🔗 رابط الصورة:\n${imgUrl}` });
    }

    if (command === '.n6' || text.includes('نجمة 6') || text.includes('star 6')) {
        const n6Info = `📶 *معلومات تحويل نجمة 6 إلى نجمة 3* 📶\n\n` +
            `لتحويل انترنت نجمة 6 (Orange/Inwi) لكي تشتغل في المواقع الأخرى (نجمة 3)، تحتاج إلى:\n` +
            `1️⃣ تطبيق VPN (مثل HA Tunnel Plus أو Stark VPN).\n` +
            `2️⃣ ملفات (Configuration) خاصة ومحدثة.\n\n` +
            `💡 المطور *حمزة اعمرني* يوفر هذه الملفات والخدمات بشكل احترافي.\n` +
            `📩 تواصل معه مباشرة للحصول على الملفات: .owner`;
        return callSendAPI(sender_psid, { text: n6Info });
    }

    if (command === '.riwaya' || command === 'رواية' || command === 'قصة') {
        const story = await getHectormanuelAI(sender_psid, "Tell me a very short interesting creative story in Arabic.", "gpt-4o-mini")
            || "Sma7 lya, ma9dertch n-jib chi riwaya f had l-we9t.";
        return callSendAPI(sender_psid, { text: `📖 *رواية:* \n\n${story}\n\n*بواسطة حمزة اعمرني*` });
    }

    if (command === '.wiki') {
        const query = args.slice(1).join(' ');
        if (!query) return callSendAPI(sender_psid, { text: "مثال: .wiki غوكو" });
        const aiWiki = await getHectormanuelAI(sender_psid, `Give me a summary from Wikipedia about: ${query}`, "gpt-4o-mini");
        return callSendAPI(sender_psid, { text: aiWiki || "Sma7 lya, ma-l9itch ma3loumat." });
    }

    if (command === '.tr') {
        const langCode = args[1];
        const textToTr = args.slice(2).join(' ');
        if (!langCode || !textToTr) return callSendAPI(sender_psid, { text: "مثال: .tr ar Hello" });
        const aiTr = await getHectormanuelAI(sender_psid, `Translate this text to ${langCode}: ${textToTr}`, "gpt-4o-mini");
        return callSendAPI(sender_psid, { text: aiTr || "Sma7 lya, translation failed." });
    }

    if (command === '.weather') {
        const city = args.slice(1).join(' ');
        if (!city) return callSendAPI(sender_psid, { text: "مثال: .weather Casablanca" });
        try {
            const { data } = await axios.get(`https://api.maher-zubair.tech/details/weather?q=${encodeURIComponent(city)}`, { timeout: 10000 });
            if (data.status === 200) {
                const w = data.result;
                return callSendAPI(sender_psid, { text: `🌦️ *الطقس في ${city}:*\n\n🌡️ الحرارة: ${w.temperature}\n💧 الرطوبة: ${w.humidity}\n🌬️ الرياح: ${w.wind}\n📝 الوصف: ${w.description}` });
            }
        } catch (e) { return callSendAPI(sender_psid, { text: "Sma7 lya, malkitch weather d had lmdina." }); }
    }

    if (command === '.adhkar' || command === 'اذكار') {
        try {
            const { data } = await axios.get("https://api.maher-zubair.tech/details/adhkar", { timeout: 10000 });
            if (data.status === 200) return callSendAPI(sender_psid, { text: `🕋 *أذكار:*\n\n${data.result.arabic}\n\n_المصدر: ${data.result.reference}_` });
        } catch (e) { return callSendAPI(sender_psid, { text: "سبحان الله، الحمد لله، لا إله إلا الله، الله أكبر." }); }
    }

    if (command === '.quran' || command === 'قرآن') {
        const surah = args[1];
        if (!surah || isNaN(surah) || surah < 1 || surah > 114) return callSendAPI(sender_psid, { text: "مثال: .quran 1" });
        return callSendAPI(sender_psid, { text: `🕌 *سورة رقم ${surah}*\n\n🔗 رابط الاستماع:\nhttps://cdn.islamic.network/quran/audio-surah/128/ar.alafasy/${surah}.mp3` });
    }

    if (command === '.yts') {
        const query = args.slice(1).join(' ');
        if (!query) return callSendAPI(sender_psid, { text: "مثال: .yts song name" });
        try {
            const { videos } = await yts(query);
            let res = `🎥 *نتائج البحث:* ${query}\n\n`;
            videos.slice(0, 5).forEach((v, i) => res += `${i + 1}. *${v.title}*\n🔗 ${v.url}\n\n`);
            return callSendAPI(sender_psid, { text: res });
        } catch (e) { return callSendAPI(sender_psid, { text: "Error searching." }); }
    }

    if (command === '.ytmp3' || command === '.ytmp4') {
        const url = args[1];
        if (!url) return callSendAPI(sender_psid, { text: "المرجو وضع رابط الفيديو." });
        callSendAPI(sender_psid, { text: "⏳ جاري المعالجة... المرجو الانتظار." });
        const res = await savetube.download(url, command === '.ytmp3' ? 'mp3' : '720');
        if (res.status) {
            return callSendAPI(sender_psid, { text: `✅ *${res.result.title}*\n\n🔗 رابط التحميل:\n${res.result.download}` });
        } else { return callSendAPI(sender_psid, { text: "❌ فشلت العملية." }); }
    }

    if (command === '.owner' || command === 'مطور') {
        return callSendAPI(sender_psid, { text: `👤 *المطور:* ${config.ownerName}\n\n📸 Instagram: ${config.social.instagram}\n📺 YouTube: ${config.social.youtube}\n💼 Portfolio: ${config.social.portfolio}\n💬 WhatsApp: ${config.social.whatsapp}` });
    }

    if (command === '.services' || command === 'خدمات') {
        return callSendAPI(sender_psid, { text: `💻 *خدمات حمزة اعمرني:*\n\n` + config.services.map(s => `✔️ ${s}`).join('\n') + `\n\n📩 تواصل للطلب: ${config.social.whatsapp}` });
    }

    // 3. AI Fallback (Identifies as Hamza Amirni Bot)
    let aiReply = imageUrl ? await getGeminiResponse(sender_psid, text, imageUrl) : (await getLuminAIResponse(sender_psid, text) || await getHectormanuelAI(sender_psid, text));
    if (!aiReply) aiReply = imageUrl ? "Gemini key error." : "Sma7 lya, ma9dertch njawbk daba.";

    sendTypingAction(sender_psid, 'typing_off');
    callSendAPI(sender_psid, { text: aiReply });
}

function sendTypingAction(sender_psid, action) {
    axios.post(`https://graph.facebook.com/v19.0/me/messages?access_token=${config.PAGE_ACCESS_TOKEN}`, { recipient: { id: sender_psid }, sender_action: action }).catch(() => { });
}

function callSendAPI(sender_psid, response) {
    axios.post(`https://graph.facebook.com/v19.0/me/messages?access_token=${config.PAGE_ACCESS_TOKEN}`, { recipient: { id: sender_psid }, message: response })
        .catch(err => console.error(chalk.red('Error: ' + (err.response?.data?.error?.message || err.message))));
}

app.get('/health', (req, res) => res.status(200).send("OK"));
setInterval(() => {
    const url = config.publicUrl || (function () { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'server_url.json'))).url; } catch (e) { return null; } })();
    if (url) axios.get(url).catch(() => { });
}, 2 * 60 * 1000);

app.listen(process.env.PORT || 8080, () => console.log(chalk.cyan(`Bot starting...`)));
