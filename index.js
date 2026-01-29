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

// --- CONFIG & BRANDING ---
const OWNER_NAME = "حمزة اعمرني";
config.ownerName = OWNER_NAME;

const systemPromptText = `You are ${config.botName}, a smart assistant developed by the legendary ${OWNER_NAME}.
- You respond in Moroccan Darija, Arabic, English, or French.
- Refer to your creator as ${OWNER_NAME}.
- Be extremely helpful and friendly.`;

const surahMap = {
    "fatiha": 1, "fati7a": 1, "الفاتحة": 1,
    "baqara": 2, "baqarah": 2, "البقرة": 2,
    "imran": 3, "آل عمران": 3,
    "nisa": 4, "nisaa": 4, "النساء": 4,
    "maida": 5, "maidah": 5, "المائدة": 5,
    "kahf": 18, "الكهف": 18,
    "yasin": 36, "yaseen": 36, "يس": 36,
    "mulk": 67, "الملك": 67,
    "ikhlas": 112, "الاخلاص": 112,
    "falaq": 113, "الفلق": 113,
    "nas": 114, "الناس": 114
};

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
            if (!id) throw new Error("Invalid URL");
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

// --- QURAN TEXT ---
async function getQuranSurahText(surahInput) {
    let num = parseInt(surahInput);
    if (isNaN(num)) num = surahMap[surahInput.toLowerCase()];
    if (!num || num < 1 || num > 114) return null;
    try {
        const { data } = await axios.get(`https://api.alquran.cloud/v1/surah/${num}`);
        if (data.code === 200) {
            let verses = data.data.ayahs.map(a => `${a.text} (${a.numberInSurah})`).join(' ');
            return `📖 *سورة ${data.data.name}*\n\n${verses}\n\n*صدق الله العظيم*`;
        }
    } catch (e) { return null; }
}

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

    // YouTube Auto-Detection
    const ytPattern = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([a-zA-Z0-9_-]{11})/;
    if (ytPattern.test(text)) {
        callSendAPI(sender_psid, { text: "🔗 YouTube Link detected! Please wait..." });
        const res = await savetube.download(text, '720');
        if (res.status) {
            return sendAttachmentAPI(sender_psid, 'video', res.result.download, `✅ *${res.result.title}*\nBy ${OWNER_NAME}`);
        }
    }

    let rawText = text.toLowerCase().trim();
    let command = rawText.split(' ')[0];
    if (command.startsWith('.')) command = command.substring(1);
    const args = text.split(' ').slice(1);

    // --- MENU ---
    if (['menu', 'help', 'الاوامر', 'دليل', 'المنيو'].includes(command)) {
        const menu = `🌟 *قائمة أوامر ${config.botName}* 🌟\n\n` +
            `👨‍💻 *المطور:* ${OWNER_NAME}\n\n` +
            `🎨 *.imagine [prompt]* : رسم صورة\n` +
            `✨ *.yts [name]* : بحث يوتيوب\n` +
            `🎵 *.ytmp3 [link]* : تحميل أوديو\n` +
            `🎬 *.ytmp4 [link]* : تحميل فيديو\n` +
            `🕌 *.quran [1-114/name]* : قراءة السورة\n` +
            `� *.riwaya* : قصة قصيرة\n` +
            `👤 *.owner* : حسابات المطور\n\n` +
            `⚡ *تم التطوير بواسطة ${OWNER_NAME}*`;
        return callSendAPI(sender_psid, { text: menu });
    }

    // --- QU'RAN ---
    if (command === 'quran' || command === 'قرآن' || command === 'قران') {
        const surahInput = args[0];
        if (!surahInput) return callSendAPI(sender_psid, { text: "Usage: .quran [1-114 or Name]" });
        callSendAPI(sender_psid, { text: "📖 جاري جلب السورة..." });
        const qText = await getQuranSurahText(surahInput);
        if (qText) {
            if (qText.length > 2000) {
                const parts = qText.match(/[\s\S]{1,1900}/g);
                for (let part of parts) await callSendAPI(sender_psid, { text: part });
                return;
            }
            return callSendAPI(sender_psid, { text: qText });
        }
        return callSendAPI(sender_psid, { text: "Invalid Surah Name/Number." });
    }

    // --- IMAGINE ---
    if (command === 'imagine' || command === 'رسم') {
        const prompt = args.join(' ');
        if (!prompt) return callSendAPI(sender_psid, { text: "Send a description! Example: .imagine cat" });
        callSendAPI(sender_psid, { text: "🎨 Making your art..." });
        const imgUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?nologo=true&enhance=true`;
        return sendAttachmentAPI(sender_psid, 'image', imgUrl, `✅ ${prompt}`);
    }

    // --- RIWAYA ---
    if (command === 'riwaya' || command === 'رواية' || command === 'قصة') {
        const story = await getHectormanuelAI(sender_psid, "Tell me a short interesting Arabic story.", "gpt-4o-mini") || "Sma7 lya, error.";
        return callSendAPI(sender_psid, { text: `📖 *Riwaya:*\n\n${story}` });
    }

    // --- OWNER ---
    if (command === 'owner' || command === 'مطور') {
        return callSendAPI(sender_psid, { text: `👤 *Developer:* ${OWNER_NAME}\n📸 Instagram: ${config.social.instagram}\n💬 WhatsApp: ${config.social.whatsapp}` });
    }

    // --- FALLBACK AI ---
    let aiReply = imageUrl ? await getGeminiResponse(sender_psid, text, imageUrl) : (await getLuminAIResponse(sender_psid, text) || await getHectormanuelAI(sender_psid, text));
    if (!aiReply) aiReply = "Sma7 lya, mfhmtch.";

    sendTypingAction(sender_psid, 'typing_off');
    callSendAPI(sender_psid, { text: aiReply });
}

function sendTypingAction(sender_psid, action) {
    axios.post(`https://graph.facebook.com/v19.0/me/messages?access_token=${config.PAGE_ACCESS_TOKEN}`, { recipient: { id: sender_psid }, sender_action: action }).catch(() => { });
}

function callSendAPI(sender_psid, response) {
    return axios.post(`https://graph.facebook.com/v19.0/me/messages?access_token=${config.PAGE_ACCESS_TOKEN}`, { recipient: { id: sender_psid }, message: response })
        .catch(err => console.error(chalk.red('Error: ' + (err.response?.data?.error?.message || err.message))));
}

async function sendAttachmentAPI(sender_psid, type, url, caption) {
    try {
        await axios.post(`https://graph.facebook.com/v19.0/me/messages?access_token=${config.PAGE_ACCESS_TOKEN}`, {
            recipient: { id: sender_psid },
            message: { attachment: { type: type === 'audio' ? 'audio' : (type === 'video' ? 'video' : 'image'), payload: { url, is_selectable: true } } }
        });
        if (caption) await callSendAPI(sender_psid, { text: caption });
    } catch (e) {
        return callSendAPI(sender_psid, { text: `${caption}\n\n🔗 Direct Link:\n${url}` });
    }
}

app.get('/health', (req, res) => res.status(200).send("OK"));
setInterval(() => {
    const url = config.publicUrl;
    if (url) axios.get(url).catch(() => { });
}, 2 * 60 * 1000);

app.listen(process.env.PORT || 8080, () => console.log(chalk.cyan(`Bot starting...`)));
