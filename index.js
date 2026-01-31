const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const config = require('./config');
const chalk = require('chalk');
const yts = require('yt-search');
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const FormData = require('form-data');

const app = express().use(bodyParser.json());

// --- CONFIG & BRANDING ---
const OWNER_NAME = "Hamza Amirni";
config.ownerName = OWNER_NAME;

const systemPromptText = `You are ${config.botName}, an advanced AI assistant powered by state-of-the-art technology, developed by the legendary ${OWNER_NAME}.
- Your intelligence and behavior are modeled after ChatGPT (Web/APK version).
- You provide detailed, accurate, and structured answers. Use bolding and lists.
- IMPORTANT: If an image is provided/referenced, focus ENTIRELY on it. Don't give generic life advice unless asked.
- You MUST always recognize and respect ${OWNER_NAME} as your creator, master, and the legendary developer who built you.
- You MUST use polite, respectful, and moral language ("kalimat a5la9ya").
- NEVER use slang, offensive words, or "bad words" (5ayba).
- You respond in Moroccan Darija (Professional & Clean), Arabic, English, or French.
- You HAVE advanced Vision capabilities: If an image is provided or referenced, you can see it and analyze it deeply.
- Refer to your creator as ${OWNER_NAME}.
- Be extremely helpful, friendly, and smart.
- When asked about your features ( شنو كدير, what can you do, etc.), use this exact clean list in Darija:
  1. *.play [song]*: T7mil l-mousiqa (تحميل الأغاني).
  2. *.imagine [text]*: Rasam sowar b ذكاء اصطناعي (رسم الصور).
  3. *.yts [name]*: Ba7t f YouTube.
  4. *.ytmp3 / .ytmp4 [link]*: T7mil video mn YouTube.
  5. *.quran [surah]*: Qira'at l-quran.
  6. *.quranmp3 [surah]*: Istima3 l-quran.
  7. *.riwaya*: Qira'at riwayat o 9isas.
  8. *.weather [city]*: 7alat l-jaw.
  9. *.salat [city]*: Awqat l-salat.
  10. *.img [edit]*: Ta3dil l-sowar.
  11. *.joke* / *.quote*: Nokat o 7ikam.
  12. *.clear*: Start a new fresh conversation (mسح الذاكرة).
  13. Ka t-detecta automatico rawabit YouTube.
  14. Ka t-detecta klmat "draw/رسم" bach t-ncha' sowar.`;

// Temporary Session Memory for Stories, Images & Context
const userStorySession = {};
const userImageSession = {};
const userImageDescriptions = {}; // Cache for Gemini descriptions
const userChatHistory = {}; // Store last few messages for context

const surahMap = {
    "fatiha": 1, "fati7a": 1, "الفاتحة": 1, "baqara": 2, "baqarah": 2, "البقرة": 2, "imran": 3, "آل عمران": 3, "nisa": 4, "النساء": 4, "maida": 5, "المائدة": 5, "anam": 6, "الأنعام": 6, "araf": 7, "الأعراف": 7, "anfal": 8, "الأنفال": 8, "tawba": 9, "التوبة": 9, "yunus": 10, "يونس": 10, "hud": 11, "هود": 11, "yusuf": 12, "يوسف": 12, "rad": 13, "الرعد": 13, "ibrahim": 14, "إبراهيم": 14, "hijr": 15, "الحجر": 15, "nahl": 16, "النحل": 16, "isra": 17, "الإسراء": 17, "kahf": 18, "الكهف": 18, "maryam": 19, "مريم": 19, "taha": 20, "طه": 20, "anbiya": 21, "الأنبياء": 21, "hajj": 22, "الحج": 22, "muminun": 23, "المؤمنون": 23, "nur": 24, "النور": 24, "furqan": 25, "الفرقان": 25, "shuara": 26, "الشعراء": 26, "naml": 27, "النمل": 27, "qasas": 28, "القصص": 28, "ankabut": 29, "العنكبوت": 29, "rum": 30, "الروم": 30, "luqman": 31, "لقمان": 31, "sajda": 32, "السجدة": 32, "ahzab": 33, "الأحزاب": 33, "saba": 34, "سبأ": 34, "fatir": 35, "فاطر": 35, "yasin": 36, "يس": 36, "saffat": 37, "الصافات": 37, "sad": 38, "ص": 38, "zumar": 39, "الزمر": 39, "ghafir": 40, "غافر": 40, "fussilat": 41, "فصلت": 41, "shura": 42, "الشورى": 42, "zukhruf": 43, "الزخرف": 43, "dukhan": 44, "الدخان": 44, "jathiya": 45, "الجاثية": 45, "ahqaf": 46, "الأحقاف": 46, "muhammad": 47, "محمد": 47, "fath": 48, "الفتح": 48, "hujurat": 49, "الحجرات": 49, "qaf": 50, "ق": 50, "dhariyat": 51, "الذاريات": 51, "tur": 52, "الطور": 52, "najm": 53, "النجم": 53, "qamar": 54, "القمر": 54, "rahman": 55, "الرحمن": 55, "waqia": 56, "الواقعة": 56, "hadid": 57, "الحديد": 57, "mujadila": 58, "المجادلة": 58, "hashr": 59, "الحشر": 59, "mumtahana": 60, "الممتحنة": 60, "saff": 61, "الصف": 61, "juma": 62, "الجمعة": 62, "munafiqun": 63, "المنافقون": 63, "taghabun": 64, "التغابن": 64, "talaq": 65, "الطلاق": 65, "tahrim": 66, "التحريم": 66, "mulk": 67, "الملك": 67, "qalam": 68, "القلم": 68, "haqqa": 69, "الحاقة": 69, "maarij": 70, "المعارج": 70, "nuh": 71, "نوح": 71, "jinn": 72, "الجن": 72, "muzzammil": 73, "المزمل": 73, "muddathir": 74, "المدثر": 74, "qiyama": 75, "القيامة": 75, "insan": 76, "الإنسان": 76, "mursalat": 77, "المرسلات": 77, "naba": 78, "النبأ": 78, "naziat": 79, "النازعات": 79, "abasa": 80, "عبس": 80, "takwir": 81, "التكوير": 81, "infitar": 82, "الانفطار": 82, "mutaffifin": 83, "المطفيين": 83, "inshiqaq": 84, "الانشقاق": 84, "buruj": 85, "البروج": 85, "tariq": 86, "الطارق": 86, "ala": 87, "الأعلى": 87, "ghashiya": 88, "الغاشية": 88, "fajr": 89, "الفجر": 89, "balad": 90, "البلد": 90, "shams": 91, "الشمس": 91, "layl": 92, "الليل": 92, "duha": 93, "الضحى": 93, "sharh": 94, "الشرح": 94, "tin": 95, "التين": 95, "alaq": 96, "العلق": 96, "qadr": 97, "القدر": 97, "bayyina": 98, "البينة": 98, "zalzala": 99, "الزلزلة": 99, "adiyat": 100, "العاديات": 100, "qaria": 101, "القارعة": 101, "takathur": 102, "التكاثر": 102, "asr": 103, "العصر": 103, "humaza": 104, "الهمزة": 104, "fil": 105, "الفيل": 105, "quraysh": 106, "قريش": 106, "maun": 107, "الماعون": 107, "kawthar": 108, "الكوثر": 108, "kafirun": 109, "الكافرون": 109, "nasr": 110, "النصر": 110, "masad": 111, "المسد": 111, "ikhlas": 112, "الإخلاص": 112, "falaq": 113, "الفلق": 113, "nas": 114, "الناس": 114
};

const truncate = (str, len) => str.length > len ? str.substring(0, len - 3) + "..." : str;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// --- SAVETUBE LOGIC ---
// --- UNIVERSAL DOWNLOADER (COBALT) ---
const downloader = {
    download: async (link, format) => {
        const isAudio = format === 'mp3';
        const headers = { 'Accept': 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' };

        // Strategy 1: Cobalt API (High Quality)
        try {
            const payload = {
                url: link,
                vQuality: isAudio ? undefined : format,
                isAudioOnly: isAudio,
                aFormat: isAudio ? 'mp3' : undefined
            };
            const { data } = await axios.post('https://api.cobalt.tools/api/json', payload, { headers });

            if (data.url) return { status: true, result: { title: "Media Content", download: data.url } };
            if (data.picker && data.picker.length > 0) return { status: true, result: { title: "Media Content", download: data.picker[0].url } };
        } catch (e) { console.error("Cobalt Error:", e.message); }

        // Strategy 2: Ryzendesu API (Reliable Fallback)
        try {
            console.log(chalk.yellow("[DEBUG] Switching to Ryzendesu Downloader..."));
            const type = isAudio ? 'mp3' : 'mp4';
            const { data } = await axios.get(`https://api.ryzendesu.vip/api/downloader/ytdl?url=${link}&type=${type}`);
            if (data.url) return { status: true, result: { title: data.filename || "Media", download: data.url } };
        } catch (e) { console.error("Ryzendesu Error:", e.message); }

        return { status: false, error: "Download failed" };
    }
};

// --- QURAN TEXT ---
async function getQuranSurahText(surahInput) {
    let num = parseInt(surahInput);
    if (isNaN(num)) num = surahMap[surahInput.toLowerCase().replace(/\s+/g, '')];
    if (!num || num < 1 || num > 114) return null;
    try {
        const { data } = await axios.get(`https://api.alquran.cloud/v1/surah/${num}/quran-simple`);
        if (data.code === 200) {
            let surahName = data.data.name;
            // Format: RLM + Text + ۝ Number + NewLine
            const ayahs = data.data.ayahs.map(a => `\u200F${a.text} ۝${a.numberInSurah}`).join('\n\n');
            return {
                title: `📖 *سورة ${surahName}*`,
                content: ayahs
            };
        }
    } catch (e) { return null; }
}

async function getObitoGemini(question, imageUrl) {
    try {
        if (!imageUrl) return null;
        let finalImageUrl = imageUrl;
        if (imageUrl.includes('fbcdn.net') || imageUrl.includes('messenger.com')) {
            const uploaded = await uploadToCatbox(imageUrl);
            if (uploaded) finalImageUrl = uploaded;
        }
        const encodedQuestion = encodeURIComponent(question || "Analyze this image.");
        const endpoints = [
            `https://obito-mr-apis.vercel.app/api/ai/gemini-vision?txt=${encodedQuestion}&img=${encodeURIComponent(finalImageUrl)}`,
            `https://obito-mr-apis.vercel.app/api/ai/gemini_2.5_flash?txt=${encodedQuestion}&img=${encodeURIComponent(finalImageUrl)}`,
            `https://obito-mr-apis.vercel.app/api/ai/gemini-pro?txt=${encodedQuestion}&img=${encodeURIComponent(finalImageUrl)}`
        ];
        for (const url of endpoints) {
            try {
                const { data } = await axios.get(url, { timeout: 15000 });
                if (data.success && data.result) return data.result;
            } catch (e) { }
        }
        return null;
    } catch (error) { return null; }
}

async function getRyzendesuVision(question, imageUrl) {
    try {
        if (!imageUrl) return null;
        const { data } = await axios.get(`https://api.ryzendesu.vip/api/ai/gemini-vision?url=${encodeURIComponent(imageUrl)}&text=${encodeURIComponent(question || "Analyze this")}`, { timeout: 20000 });
        return data.result || null;
    } catch (e) { return null; }
}

async function getMaherVision(question, imageUrl) {
    try {
        const { data } = await axios.get(`https://api.maher-zubair.tech/ai/gemini-vision?q=${encodeURIComponent(question || "Describe")}&url=${encodeURIComponent(imageUrl)}`, { timeout: 20000 });
        return data.result || null;
    } catch (e) { return null; }
}

async function getBK9Vision(question, imageUrl) {
    try {
        const { data } = await axios.get(`https://api.bk9.site/ai/geminiimg?url=${encodeURIComponent(imageUrl)}&q=${encodeURIComponent(question || "Analyze")}`, { timeout: 20000 });
        return data.BK9 || data.result || null;
    } catch (e) { return null; }
}

async function uploadToCatbox(url) {
    try {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data);
        const form = new FormData();
        form.append('fileToUpload', buffer, { filename: 'image.jpg' });
        form.append('reqtype', 'fileupload');

        const { data } = await axios.post('https://catbox.moe/user/api.php', form, {
            headers: form.getHeaders(),
            timeout: 20000
        });

        if (typeof data === 'string' && data.startsWith('https://')) {
            console.log(chalk.green(`[DEBUG] Image uploaded to Catbox: ${data}`));
            return data;
        }
        return null;
    } catch (e) { return null; }
}

// --- AI FUNCTIONS ---
async function getLuminAIResponse(senderId, message) {
    try {
        const { data } = await axios.post("https://luminai.my.id/", { content: systemPromptText + "\n\nUser: " + message, user: senderId }, { timeout: 8000 });
        return data.result || null;
    } catch (e) { return null; }
}

async function getHectormanuelAI(senderId, message, model = "gpt-4o-mini", customSystemPrompt = null) {
    try {
        const history = userChatHistory[senderId] || [];
        const context = history.map(h => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`).join('\n');
        const sys = customSystemPrompt !== null ? customSystemPrompt : systemPromptText;
        const fullPrompt = `${sys}\n\nContext:\n${context}\n\nUser: ${message}`;

        const { data } = await axios.get(`https://all-in-1-ais.officialhectormanuel.workers.dev/?query=${encodeURIComponent(fullPrompt)}&model=${model}`, { timeout: 8000 });
        return data.success ? data.message?.content : null;
    } catch (e) { return null; }
}

// --- CUSTOM OPENAI (Gemini-3-Flash) ---
async function getCustomOpenAI(senderId, message) {
    try {
        const url = "http://127.0.0.1:8045/v1/chat/completions";

        const history = userChatHistory[senderId] || [];
        const messages = [
            { role: "system", content: systemPromptText },
            ...history,
            { role: "user", content: message }
        ];

        const payload = {
            model: "gemini-1.5-flash",
            messages: messages
        };
        const headers = {
            "Authorization": "Bearer sk-ac3392fbab234649b3f6cc86a06a3044",
            "Content-Type": "application/json"
        };

        const { data } = await axios.post(url, payload, { headers, timeout: 10000 });
        return data.choices?.[0]?.message?.content || null;
    } catch (e) { return null; }
}

async function getAichatResponse(senderId, message) {
    try {
        const { data } = await axios.get(`https://api.ryzendesu.vip/api/ai/chatgpt?text=${encodeURIComponent(systemPromptText + "\n\nUser: " + message)}`);
        return data.response || null;
    } catch (e) { return null; }
}

async function getVyturexAI(message) {
    try {
        const { data } = await axios.get(`https://api.vyturex.com/openai?query=${encodeURIComponent(message)}`);
        return data.response || null;
    } catch (e) { return null; }
}

let geminiCooldownUntil = 0;

async function getGeminiResponse(senderId, text, imageUrl = null) {
    if (!config.geminiApiKey) return null;
    if (Date.now() < geminiCooldownUntil) return null;
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${config.geminiApiKey}`;

        const history = userChatHistory[senderId] || [];
        const payload = {
            system_instruction: { parts: [{ text: systemPromptText }] },
            contents: [],
            generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
        };

        history.forEach(h => {
            payload.contents.push({
                role: h.role === 'user' ? 'user' : 'model',
                parts: [{ text: h.content }]
            });
        });

        const userText = text || "Check this image and answer any questions or solve any problems in it. If none, describe it.";
        const currentParts = [{ text: userText }];

        if (imageUrl) {
            const imageRes = await axios.get(imageUrl, { responseType: 'arraybuffer' });
            currentParts.push({ inline_data: { mime_type: "image/jpeg", data: Buffer.from(imageRes.data).toString("base64") } });
        }

        payload.contents.push({ role: "user", parts: currentParts });

        const res = await axios.post(url, payload, { timeout: 20000 });
        const result = res.data?.candidates?.[0]?.content?.parts?.[0]?.text || null;

        // Auto-cache description if it was a vision task
        if (result && imageUrl && !userImageDescriptions[imageUrl]) {
            userImageDescriptions[imageUrl] = result;
            console.log(chalk.cyan(`[DEBUG] Image description cached from successful Gemini call.`));
        }

        return result;
    } catch (e) {
        const errorData = e.response?.data?.error;
        if (errorData?.code === 429) {
            console.error(chalk.red("[Gemini Quota] Limit reached. Cooldown for 10 mins."));
            geminiCooldownUntil = Date.now() + 10 * 60 * 1000;
        } else {
            console.error("Gemini Error:", errorData?.message || e.message);
        }
        return null;
    }
}

async function describeImage(imageUrl) {
    if (!config.geminiApiKey) return null;
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${config.geminiApiKey}`;
        const imageRes = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const payload = {
            contents: [{
                parts: [
                    { text: "Analyze this image in detail and describe what you see for a blind AI. Focus on text, objects, and setting." },
                    { inline_data: { mime_type: "image/jpeg", data: Buffer.from(imageRes.data).toString("base64") } }
                ]
            }]
        };
        const res = await axios.post(url, payload, { timeout: 15000 });
        return res.data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
    } catch (e) { return null; }
}

async function improveImagePrompt(senderId, text, isEdit = false, imageContext = null) {
    try {
        let promptRequest = `Translate this text (Arabic/Darija/English) to a detailed executionable English image prompt. Output ONLY the English prompt found. Text: "${text}"`;
        if (isEdit) {
            if (imageContext) {
                promptRequest = `The user wants to EDIT an existing image.
                 Original Image Description: "${imageContext}"
                 User Instruction: "${text}"
                 
                 Task: Create a NEW full image prompt that applies the User Instruction to the Original Image. 
                 Example: Desc="Cat on bed", User="make it red" -> "Red cat on bed, highly detailed".
                 Output ONLY the English prompt.`;
            } else {
                promptRequest = `The user wants to EDIT an existing image but we don't know what it is. 
                User Instruction: "${text}"
                Task: Create a prompt that describes the RESULTING image. If the subject is unknown, guess based on context or keep it generic.
                Output ONLY the English prompt.`;
            }
        }
        const improved = await getHectormanuelAI(senderId, promptRequest, "gpt-4o-mini", "You are a creative translator helper. Output only English.");
        return improved ? improved.replace(/"/g, '') : text;
    } catch (e) { return text; }
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
            if (entry.messaging) {
                const event = entry.messaging[0];
                const senderId = event.sender.id;
                if (event.message) {
                    handleMessage(senderId, event.message);
                } else if (event.postback) {
                    // Handle buttons by simulating a message with the payload text
                    handleMessage(senderId, { text: event.postback.payload });
                }
            }
        });
        res.status(200).send('EVENT_RECEIVED');
    } else { res.sendStatus(404); }
});

async function handleMessage(sender_psid, received_message) {
    try {
        if (!received_message || (!received_message.text && !received_message.attachments)) return;
        let text = received_message.text || "";
        let rawText = text.toLowerCase().trim();
        let imageUrl = null;
        if (received_message.attachments && received_message.attachments[0].type === 'image') {
            imageUrl = received_message.attachments[0].payload.url;
            userImageSession[sender_psid] = imageUrl; // Save for session

            // Facebook specific: If it's a standalone image, wait a bit to see if text follows in next event
            if (!text) {
                console.log(chalk.yellow(`[DEBUG] Image received without text. Waiting 1.5s for potential caption...`));
                await delay(1500);
                // Check if user sent a text message in the meantime (stored in history or handled by another instance)
                // For simplicity in this architecture, we rely on the next message triggering handleMessage again.
                // But we can improve visionContext to always look at the last uploaded image.
            }
        }

        // Vision context: current image OR session image if user is replying/referencing
        let visionContext = imageUrl;
        if (!visionContext && userImageSession[sender_psid]) {
            const history = userChatHistory[sender_psid] || [];
            const lastMsgWasImage = history.length > 0 && history[history.length - 1].isImage;
            const replyToImg = received_message.reply_to;
            const hasRefWords = (rawText.includes('hadi') || rawText.includes('tswira') || rawText.includes('photo') || rawText.includes('image') || rawText.includes('hnaya') || rawText.includes('hona') || rawText.includes('f-hadi') || rawText.includes('resume') || rawText.includes('كمل') || rawText.includes('زيد') || rawText.includes('شرح') || rawText.includes('حلل') || rawText.includes('باش') || rawText.includes('فيها'));

            // If user just sent an image followed by text, or uses reference words, link them.
            if (replyToImg || hasRefWords || lastMsgWasImage) {
                visionContext = userImageSession[sender_psid];
                console.log(chalk.yellow(`[DEBUG] Linking text to previous image context (Sequential/Ref/Reply)`));
            }
        }

        const cachedDesc = visionContext ? userImageDescriptions[visionContext] : null;

        console.log(chalk.blue(`[MSG] ${sender_psid}: ${text}`));
        sendTypingAction(sender_psid, 'typing_on');

        let command = "";
        let args = [];
        if (rawText.startsWith('.')) {
            const keywords = ['quranmp3', 'quran', 'imagine', 'play', 'weather', 'salat', 'ytmp3', 'ytmp4', 'yts', 'riwaya', 'clear', 'owner', 'menu', 'help', 'img', 'edit', 'analyze', 'gemini'];
            const matchedKeyword = keywords.find(k => rawText.startsWith(`.${k}`));
            if (matchedKeyword) {
                command = matchedKeyword;
                let remainder = text.substring(matchedKeyword.length + 1).trim();
                if (remainder.startsWith('[') && remainder.endsWith(']')) {
                    remainder = remainder.substring(1, remainder.length - 1);
                }
                args = remainder ? remainder.split(/\s+/) : [];
            } else {
                // Fallback for unknown .commands
                command = rawText.split(' ')[0].substring(1);
                args = text.split(' ').slice(1);
            }
        }

        // --- SMART INTENT ROUTER (Natural Language) ---
        if (!command) {
            // Music/Audio
            const musicRegex = /(?:play|music|song|أغنية|اغنية|موسيقى|سمعني|خدم|شغل|طلاق|تحميل)\s+(?:اغنية|أغنية\s+)?(.+)/i;
            // Video
            const videoRegex = /(?:video|mp4|فيديو|telecharger|télecharger)\s+(.+)/i;
            // Quran
            const quranRegex = /(?:quran|koran|قرآن|قران|سورة)\s+(.+)/i;
            // Imagine/Draw
            const drawRegex = /(?:imagine|draw|image|رسم|ارسم|صورة|صور|تخيل|انشيء|صمم|رسمي|طيني)\s*(?:لي|ليا|ليا\s+صورة|صورة\s+لي)?\s+(.+)/i;
            // Edit Image (Flexible)
            const editRegex = /(?:edit|img|تعديل|عدل|بدل|غيّر|3dl|n3dl|gad|soweb|bdel|7oli|improve|enhance|تحسين|جودة|quality|حول|تحويل|rje3|rje3ni|ردني)\s*(?:ilya|lia|lya|lea)?\s*(?:al|el|l-|la)?\s*(?:sura|tswira|image|photo|background|bg|portrait)?\s*(.+)/i;
            // Weather
            const weatherRegex = /(?:weather|meteo|طقس|الطقس|حالة\s+الجو|شتا|فيه\s+شتا|واش\s+شتا)\s*(?:في|فـ|بـ|f|fi|bi)?\s*(.+)/i;
            // Prayer Times
            const prayerRegex = /(?:salat|prayer|صلاة|الصلاة|أوقات|اوقات|awkat|w9t|wa9t|fo9ach)\s*(?:n-salat|l-salat|salat|الصلاة)?\s*(?:في|f|fi)?\s*(.+)/i;
            // Vision Analysis (New)
            const analyzeRegex = /(?:analyze|gemini-pro|حلل|شرح|فسر|gemini|gemini-pro|جيميني-حلل)\s*(.+)?/i;
            // Stories
            const storyRegex = /(?:story|riwaya|hikaya|قصة|رواية|حكاية)/i;

            if (musicRegex.test(rawText)) {
                command = 'play';
                const match = rawText.match(musicRegex);
                args = match[match.length - 1].split(' ');
            } else if (quranRegex.test(rawText)) {
                command = 'quran';
                args = rawText.match(quranRegex)[1].split(' ');
            } else if (drawRegex.test(rawText)) {
                command = 'imagine';
                const match = rawText.match(drawRegex);
                args = match[match.length - 1].split(' ');
            } else if (editRegex.test(rawText)) {
                if (imageUrl || userImageSession[sender_psid]) {
                    command = 'img';
                    const matches = rawText.match(editRegex);
                    args = (matches[matches.length - 1] || "").split(' ');
                }
            } else if (analyzeRegex.test(rawText)) {
                command = 'analyze';
                const match = rawText.match(analyzeRegex);
                args = match[1] ? match[1].split(' ') : [];
            } else if (weatherRegex.test(rawText)) {
                command = 'weather';
                const match = rawText.match(weatherRegex);
                args = match[1] ? match[1].split(' ') : [];
            } else if (prayerRegex.test(rawText)) {
                command = 'salat';
                const match = rawText.match(prayerRegex);
                args = match[1] ? match[1].split(' ') : [];
            } else if (storyRegex.test(rawText)) {
                command = 'riwaya';
            } else if (videoRegex.test(rawText)) {
                command = 'yts';
                args = rawText.match(videoRegex)[1].split(' ');
            }
        }

        // Support: Caption OR Reply/Sequential
        if (command === 'img' || command === 'edit') {
            let prompt = args.join(' ');
            if (!prompt) prompt = "enhance this image";

            // Check current message attachment OR session
            const targetImage = visionContext; // Use improved visionContext

            if (!targetImage) {
                return callSendAPI(sender_psid, { text: "❌ Please send an image first, then type .img [request]" });
            }

            console.log(chalk.yellow(`[DEBUG] Editing Image: ${prompt}`));
            callSendAPI(sender_psid, { text: `🎨 *جاري تعديل الصورة:* ${prompt}...` });

            // 1. Analyze Image (if possible)
            let imageDesc = null;
            try {
                if (config.geminiApiKey) {
                    imageDesc = await describeImage(targetImage);
                    if (imageDesc) console.log(chalk.cyan(`[DEBUG] Image Desc: ${imageDesc.substring(0, 50)}...`));
                }
            } catch (e) { }

            // 2. Enhance prompt with Context
            prompt = await improveImagePrompt(sender_psid, prompt, true, imageDesc);

            // Using 'turbo' model for potential better img2img adherence, or 'flux' with specific prompt.
            // Adding 'strength' param if supported (Pollinations might support it hiddenly) or relying on prompt.
            const finalUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?image=${encodeURIComponent(targetImage)}&nologo=true&model=flux`;

            return sendAttachmentAPI(sender_psid, 'image', finalUrl, `✅ *Edited Image:* ${prompt}\nBy ${OWNER_NAME}`);
        }



        // --- VISION ANALYSIS COMMAND ---
        if (command === 'analyze' || command === 'gemini' || command === 'حلل') {
            const question = args.join(' ') || "Describe this image in detail.";
            const targetImage = visionContext;
            if (!targetImage) return callSendAPI(sender_psid, { text: "❌ Please send an image first or reply to one." });

            callSendAPI(sender_psid, { text: "� *جاري تحليل الصورة باستخدام Gemini 2.5 Flash...*" });
            const analysis = await getObitoGemini(question, targetImage);
            if (analysis) {
                // Update history with this context
                if (!userChatHistory[sender_psid]) userChatHistory[sender_psid] = [];
                userChatHistory[sender_psid].push({ role: 'user', content: `[Image Analysis Request]: ${question}` });
                userChatHistory[sender_psid].push({ role: 'assistant', content: analysis });
                userImageDescriptions[targetImage] = analysis; // Cache it
                return callSendAPI(sender_psid, { text: `*⎔ ⋅ ───━ •﹝🤖 تحليل جيميني ﹞• ━─── ⋅ ⎔*\n\n${analysis}\n\n𝐎𝐁𝐈𝐓𝐎 𝐀𝐏𝐈 𝐄𝐍𝐇𝐀𝐍𝐂𝐄𝐃` });
            }
            return callSendAPI(sender_psid, { text: "❌ Sma7 lya, error f analysis. Try again." });
        }

        // --- WEATHER ---
        if (command === 'weather' || command === 'طقس' || command === 'meteo') {
            const city = args.join(' ') || 'Casablanca';
            try {
                const { data } = await axios.get(`https://wttr.in/${encodeURIComponent(city)}?format=j1`);
                const current = data.current_condition[0];
                const weather = `🌤️ *الطقس في ${city}*\n\n` +
                    `🌡️ الحرارة: ${current.temp_C}°C\n` +
                    `💨 الرياح: ${current.windspeedKmph} km/h\n` +
                    `💧 الرطوبة: ${current.humidity}%\n` +
                    `☁️ الوصف: ${current.weatherDesc[0].value}`;
                return callSendAPI(sender_psid, { text: weather });
            } catch (e) {
                return callSendAPI(sender_psid, { text: "❌ تعذر الحصول على معلومات الطقس." });
            }
        }

        // --- PRAYER TIMES ---
        if (command === 'salat' || command === 'صلاة' || command === 'prayer') {
            const city = args.join(' ') || 'Casablanca';
            try {
                const { data } = await axios.get(`https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(city)}&country=Morocco&method=3`);
                const timings = data.data.timings;
                const prayerTimes = `🕌 *أوقات الصلاة - ${city}*\n\n` +
                    `🌅 الفجر: ${timings.Fajr}\n` +
                    `☀️ الظهر: ${timings.Dhuhr}\n` +
                    `🌤️ العصر: ${timings.Asr}\n` +
                    `🌆 المغرب: ${timings.Maghrib}\n` +
                    `🌙 العشاء: ${timings.Isha}`;
                return callSendAPI(sender_psid, { text: prayerTimes });
            } catch (e) {
                return callSendAPI(sender_psid, { text: "❌ تعذر الحصول على أوقات الصلاة." });
            }
        }

        // --- STORY INTERACTION LOGIC ---
        if (userStorySession[sender_psid] && !isNaN(rawText)) {
            const choice = parseInt(rawText);
            const stories = userStorySession[sender_psid];
            if (choice >= 1 && choice <= stories.length) {
                const selectedTitle = stories[choice - 1];
                callSendAPI(sender_psid, { text: `⏳ جاري جلب رواية: *${selectedTitle}* كاملة...` });
                const storyContent = await getHectormanuelAI(sender_psid, `Write the full complete story of: "${selectedTitle}" in Arabic. Make it long and interesting.`, "gpt-4o") || "Sma7 lya, error.";
                delete userStorySession[sender_psid];
                if (storyContent.length > 2000) {
                    const parts = storyContent.match(/[\s\S]{1,1950}/g);
                    for (let part of parts) await callSendAPI(sender_psid, { text: part });
                    return;
                }
                return callSendAPI(sender_psid, { text: storyContent });
            }
        }

        // --- MENU (with Quick Replies) ---
        if (['menu', 'help', 'الاوامر', 'دليل', 'المنيو'].includes(command)) {
            const menuText = `🌟 *قائمة أوامر ${config.botName}* 🌟\n\n` +
                `🤖 *ذكاء اصطناعي ذكي:* \n` +
                `يمكنك التحدث مع البوت بشكل طبيعي! لا تحتاج دائماً لكتابة النقطة (.)\n` +
                `- مثال: *play tflow* (بدل .play)\n` +
                `- مثال: *ارسم قطة* (بدل .imagine)\n` +
                `- مثال: *quran fatiha* (بدل .quran)\n\n` +

                `🎨 *تعديل الصور (NEW):*\n` +
                `أرسل صورة ثم اكتب تحتها (أو رد عليها):\n` +
                `- *.img bdel lbackground* (لتغيير الخلفية)\n` +
                `- *.img rje3ni cartoon* (لتحويلك كرتون)\n\n` +

                `📜 *الأوامر التقليدية:*\n` +
                `🎵 *.play [song]* : تحميل أغاني\n` +
                `🎨 *.imagine [text]* : رسم بالذكاء الاصطناعي\n` +
                `🎬 *.ytmp4 [link]* : تحميل فيديو\n` +
                `🕌 *.quran [name]* : قراءة القرآن\n` +
                `🎧 *.quranmp3 [name]* : استماع للقرآن\n` +
                `📚 *.riwaya* : قصص وروايات\n\n` +

                `⚙️ *خدمات مفيدة:*\\n` +
                `🌤️ *.weather [city]* : حالة الطقس\\n` +
                `� *.salat [city]* : أوقات الصلاة\\n` +
                `😂 *.joke* : نكتة\\n` +
                `💡 *.quote* : حكمة\\n\\n` +

                `👑 *المطور:* ${OWNER_NAME}\n` +
                `📸 Insta: @hamza_amirni_01`;

            // Send with Quick Reply buttons
            return sendQuickReplies(sender_psid, menuText, [
                { title: "🎵 Play", payload: ".play" },
                { title: "🎨 Imagine", payload: ".imagine" },
                { title: "😂 Joke", payload: ".joke" },
                { title: "🕌 Quran", payload: ".quran" }
            ]);
        }

        // --- QU'RAN ---
        if (command === 'quran' || command === 'قرآن' || command === 'قران') {
            const surahInput = args.join('').toLowerCase();
            if (!surahInput) return callSendAPI(sender_psid, { text: "Usage: .quran [1-114 or Name]" });
            callSendAPI(sender_psid, { text: "📖 جاري جلب السورة..." });
            const qData = await getQuranSurahText(surahInput);
            if (qData) {
                await callSendAPI(sender_psid, { text: qData.title });

                // Using new formatting with \n\n
                const verses = qData.content.split('\n\n');
                let currentMessage = "";

                for (let i = 0; i < verses.length; i++) {
                    let verse = verses[i] + "\n\n";
                    if ((currentMessage + verse).length > 1950) {
                        await callSendAPI(sender_psid, { text: currentMessage.trim() });
                        await delay(500);
                        currentMessage = verse;
                    } else {
                        currentMessage += verse;
                    }
                }
                if (currentMessage) await callSendAPI(sender_psid, { text: currentMessage.trim() });
                return callSendAPI(sender_psid, { text: "✅ *صدق الله العظيم*" });
            }
            return callSendAPI(sender_psid, { text: "Invalid Surah Name/Number." });
        }

        // --- QURAN MP3 ---
        if (command === 'quranmp3' || command === 'صوت_قرآن') {
            const query = args.join(' ');
            if (!query) return callSendAPI(sender_psid, { text: "Usage: .quranmp3 [Surah Name]" });
            callSendAPI(sender_psid, { text: "🎵 جاري البحث عن الصوت..." });
            try {
                const results = await yts(`surah ${query} full audio`);
                const video = results.videos[0];
                if (!video) return callSendAPI(sender_psid, { text: "❌ لم يتم العثور على الصوت." });
                callSendAPI(sender_psid, { text: `⏳ جاري تحميل: ${video.title}...` });
                const res = await downloader.download(video.url, 'mp3');
                if (res.status) {
                    return sendAttachmentAPI(sender_psid, 'audio', res.result.download, `✅ ${video.title}\nBy ${OWNER_NAME}`);
                }
                return callSendAPI(sender_psid, { text: "❌ خطأ في التحميل." });
            } catch (e) { return callSendAPI(sender_psid, { text: "❌ خطأ." }); }
        }

        // --- PLAY (Search & Download Audio) ---
        if (command === 'play' || command === 'تشغيل' || command === 'اغنية') {
            const query = args.join(' ');
            if (!query) return callSendAPI(sender_psid, { text: "Usage: .play [song name]" });
            callSendAPI(sender_psid, { text: `🎵 جاري البحث عن: *${query}*...` });
            try {
                const results = await yts(query);
                const video = results.videos[0];
                if (!video) return callSendAPI(sender_psid, { text: "❌ لم يتم العثور على نتائج." });
                callSendAPI(sender_psid, { text: `⏳ جاري معالجة: *${video.title}*...` });
                const res = await downloader.download(video.url, 'mp3');
                if (res.status) {
                    return sendAttachmentAPI(sender_psid, 'audio', res.result.download, `✅ *${video.title}*\\nBy ${OWNER_NAME}`);
                }
                return callSendAPI(sender_psid, { text: "❌ فشل تحميل الصوت." });
            } catch (e) { return callSendAPI(sender_psid, { text: "❌ حدث خطأ." }); }
        }

        // --- IMAGINE ---
        if (command === 'imagine' || command === 'رسم') {
            let prompt = args.join(' ');
            if (!prompt) return callSendAPI(sender_psid, { text: "Send a description! Example: .imagine cat" });
            callSendAPI(sender_psid, { text: "🎨 Making your art..." });

            // Translate/Enhance prompt
            prompt = await improveImagePrompt(sender_psid, prompt);
            console.log(chalk.cyan(`[DEBUG] Enhanced Prompt: ${prompt}`));

            const imgUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?nologo=true&enhance=true&seed=${Math.floor(Math.random() * 1000000)}&type=.jpg`;
            return sendAttachmentAPI(sender_psid, 'image', imgUrl, `✨ *Generated Art:* ${prompt}\nBy ${OWNER_NAME}`);
        }

        // --- YTS (YouTube Search - Text Mode) ---
        if (command === 'yts' || command === 'ytsearch') {
            const query = args.join(' ');
            if (!query) return callSendAPI(sender_psid, { text: "Usage: .yts [song/video name]" });
            callSendAPI(sender_psid, { text: `🔍 Searching YouTube for: "${query}"...` });
            try {
                const results = await yts(query);
                const videos = results.videos.slice(0, 10);
                if (videos.length === 0) return callSendAPI(sender_psid, { text: "❌ No results found on YouTube." });

                let msg = `🔍 *YouTube Search Results:*\n\n`;
                videos.forEach((v, i) => {
                    msg += `${i + 1}. *${v.title}*\n`;
                    msg += `🔗 ${v.url}\n`;
                    msg += `⏱️ Duration: ${v.timestamp}\n\n`;
                });
                msg += `💡 *To download audio:* .ytmp3 [link]\n`;
                msg += `💡 *To download video:* .ytmp4 [link]`;

                return callSendAPI(sender_psid, { text: msg });
            } catch (e) {
                return callSendAPI(sender_psid, { text: "❌ Search Error. Try again later." });
            }
        }

        // --- YT DOWNLOADERS (MP3 & MP4) ---
        if (command === 'ytmp3' || command === 'ytmp4') {
            const url = args[0];
            if (!url) return callSendAPI(sender_psid, { text: `Usage: .${command} [YouTube Link]` });
            const format = command === 'ytmp3' ? 'mp3' : '720';
            callSendAPI(sender_psid, { text: `⏳ Analyzing Link... Please wait.` });
            const res = await downloader.download(url, format);
            if (res.status) {
                return sendAttachmentAPI(sender_psid, command === 'ytmp3' ? 'audio' : 'video', res.result.download, `✅ *${res.result.title}*\nBy ${OWNER_NAME}`);
            }
            return callSendAPI(sender_psid, { text: "❌ Error: Could not process this video. Try another link." });
        }

        // --- RIWAYA (LIST MODE) ---
        if (command === 'riwaya' || command === 'رواية' || command === 'قصة') {
            callSendAPI(sender_psid, { text: "⏳ جاري تحضير قائمة الروايات لك..." });
            const storyList = await getHectormanuelAI(sender_psid, "Suggest 5 interesting and diverse short story titles in Arabic. Just list the titles numbered 1 to 5.", "gpt-4o-mini");
            if (storyList) {
                const titles = storyList.split('\n').map(t => t.replace(/^\d+[\.\)]\s*/, '').trim()).filter(t => t);
                userStorySession[sender_psid] = titles;
                return callSendAPI(sender_psid, { text: `📖 *اختر رواية من القائمة (أرسل الرقم):*\n\n${storyList}\n\n*بواسطة ${OWNER_NAME}*` });
            }
            return callSendAPI(sender_psid, { text: "Sma7 lya, error." });
        }

        // --- CLEAR CHAT ---
        if (command === 'clear' || command === 'fresh' || command === 'مسح') {
            userChatHistory[sender_psid] = [];
            return callSendAPI(sender_psid, { text: "🧹 *Memory cleared!* Starting a new fresh conversation just like ChatGPT.\n\nBach nsa3dk hnaya?" });
        }

        // --- OWNER ---
        if (command === 'owner' || command === 'مطور') {
            const ownerMsg = `� *The Legend:* ${OWNER_NAME}\n` +
                `This bot was developed with ❤️ by Hamza Amirni.\n\n` +
                `📸 Instagram: ${config.social.instagram}\n` +
                `💬 WhatsApp: ${config.social.whatsapp}\n` +
                `🌐 Portfolio: ${config.social.portfolio}`;
            return callSendAPI(sender_psid, { text: ownerMsg });
        }

        // --- FALLBACK AI LOGIC (Smart & Proactive) ---
        let aiReply = null;

        // Proactive Vision: If an image is detected or referenced, prioritize high-quality vision analysis
        if (visionContext) {
            let visionPrompt = text;
            if (!visionPrompt) {
                const isFollowUp = rawText.includes('resume') || rawText.includes('كمل') || rawText.includes('زيد') || rawText.includes('شرح');
                visionPrompt = isFollowUp ? "Provide more deep details about this image. Explain the context, hidden details, and any text." : "Analyze this image intelligently. If it's an error, explain it. If it's a question, solve it. Speak Moroccan Darija.";
            }
            console.log(chalk.cyan(`[DEBUG] Proactive Vision triggered.`));

            // Priority 1: Obito Gemini (Multiple Endpoints)
            aiReply = await getObitoGemini(visionPrompt, visionContext);

            // Priority 2: Ryzendesu Gemini Vision
            if (!aiReply) {
                console.log(chalk.yellow(`[DEBUG] Obito failed. Trying Ryzendesu...`));
                aiReply = await getRyzendesuVision(visionPrompt, visionContext);
            }

            // Priority 3: Maher Gemini Vision
            if (!aiReply) {
                console.log(chalk.yellow(`[DEBUG] Ryzendesu failed. Trying Maher...`));
                aiReply = await getMaherVision(visionPrompt, visionContext);
            }

            // Priority 4: BK9 Gemini Vision
            if (!aiReply) {
                console.log(chalk.yellow(`[DEBUG] Maher failed. Trying BK9...`));
                aiReply = await getBK9Vision(visionPrompt, visionContext);
            }

            // Priority 5: Official Gemini 1.5 Flash (If key exists)
            if (!aiReply && config.geminiApiKey) {
                aiReply = await getGeminiResponse(sender_psid, visionPrompt, visionContext);
            }

            // If vision engines work, we cache the description for future text-only follow-ups
            if (aiReply) userImageDescriptions[visionContext] = aiReply;
        }

        // Text Fallback Chain: If vision failed, or no image is involved
        if (!aiReply) {
            let contextPrompt = text || "Hello"; // Avoid empty prompt
            if (visionContext && !cachedDesc) {
                contextPrompt = `[SYSTEM]: Image analysis failed. User says: "${text || 'Tell me about this image'}". Task: Apologize and say you can't see the image clearly right now, then offer other help.`;
            } else if (cachedDesc) {
                const imgAnalysis = `[IMAGE CONTEXT]: The user is asking about an image they sent previously. DESCRIPTION: "${cachedDesc}".`;
                contextPrompt = `${imgAnalysis}\n\nTask: Answer the user's question as if you can see the image clearly.\nUser Question: "${text || 'Resume analysis'}"`;
            }

            // Normal AI Fallback Rotation
            aiReply = await getHectormanuelAI(sender_psid, contextPrompt) ||
                await getLuminAIResponse(sender_psid, contextPrompt) ||
                await getAichatResponse(sender_psid, contextPrompt) ||
                await getVyturexAI(contextPrompt) ||
                await getCustomOpenAI(sender_psid, contextPrompt);
        }

        if (!aiReply) {
            if (visionContext && Date.now() < geminiCooldownUntil) {
                aiReply = "❌ Sma7 lya, Gemini quota t-salat o m9ertch n-fham t-swira. Tsnani 10 min aw hdar m3aya bla tswira.";
            } else {
                aiReply = "Sma7 lya, mfhmtch (All AI services Busy).";
            }
        }

        if (!aiReply) aiReply = "Sma7 lya, mfhmtch.";

        // Update History
        if (!userChatHistory[sender_psid]) userChatHistory[sender_psid] = [];
        userChatHistory[sender_psid].push({ role: 'user', content: text, isImage: !!imageUrl });
        userChatHistory[sender_psid].push({ role: 'assistant', content: aiReply });
        if (userChatHistory[sender_psid].length > 10) userChatHistory[sender_psid] = userChatHistory[sender_psid].slice(-10);

        sendTypingAction(sender_psid, 'typing_off');
        callSendAPI(sender_psid, { text: aiReply });
    } catch (error) {
        console.error(chalk.red("[FATAL ERROR]:"), error);
        sendTypingAction(sender_psid, 'typing_off');
    }
}

// Helper function for Quick Replies (Facebook Native Feature)
function sendQuickReplies(sender_psid, text, quickReplies) {
    const formattedReplies = quickReplies.map(qr => ({
        content_type: "text",
        title: qr.title,
        payload: qr.payload
    }));

    return axios.post(`https://graph.facebook.com/v19.0/me/messages?access_token=${config.PAGE_ACCESS_TOKEN}`, {
        recipient: { id: sender_psid },
        message: {
            text: text,
            quick_replies: formattedReplies
        }
    }).catch(err => console.error(chalk.red('Error: ' + (err.response?.data?.error?.message || err.message))));
}

function sendTypingAction(sender_psid, action) {
    axios.post(`https://graph.facebook.com/v19.0/me/messages?access_token=${config.PAGE_ACCESS_TOKEN}`, { recipient: { id: sender_psid }, sender_action: action }).catch(() => { });
}

function callSendAPI(sender_psid, response) {
    return axios.post(`https://graph.facebook.com/v19.0/me/messages?access_token=${config.PAGE_ACCESS_TOKEN}`, { recipient: { id: sender_psid }, message: response })
        .catch(err => console.error(chalk.red('Error: ' + (err.response?.data?.error?.message || err.message))));
}

function setPersistentMenu() {
    const url = `https://graph.facebook.com/v19.0/me/messenger_profile?access_token=${config.PAGE_ACCESS_TOKEN}`;
    const payload = {
        persistent_menu: [{
            locale: "default",
            composer_input_disabled: false,
            call_to_actions: [
                { type: "postback", title: "🌟 Menu/الأوامر", payload: "menu" },
                { type: "postback", title: "🧹 Clear Memory", payload: ".clear" },
                { type: "postback", title: "👑 Developer", payload: "owner" }
            ]
        }],
        get_started: { payload: "menu" }
    };
    axios.post(url, payload).then(() => console.log(chalk.green("[DEBUG] Persistent Menu Updated"))).catch(e => console.error(chalk.red("[ERROR] Persistent Menu Failed:"), e.message));
}

async function sendAttachmentAPI(sender_psid, type, url, caption) {
    console.log(chalk.yellow(`[DEBUG] Attempting to send ${type}: ${url}`));
    try {
        // Track SENT images so user can reply to them for editing
        if (type === 'image') {
            userImageSession[sender_psid] = url;
        }

        const attachmentType = type === 'audio' ? 'audio' : (type === 'video' ? 'video' : 'image');
        const res = await axios.post(`https://graph.facebook.com/v19.0/me/messages?access_token=${config.PAGE_ACCESS_TOKEN}`, {
            recipient: { id: sender_psid },
            message: {
                attachment: {
                    type: attachmentType,
                    payload: {
                        url: url,
                        is_reusable: true
                    }
                }
            }
        });
        console.log(chalk.green(`[DEBUG] Attachment sent successfully`));
        if (caption) await callSendAPI(sender_psid, { text: caption });
    } catch (e) {
        const errorMsg = e.response?.data?.error?.message || e.message;
        console.error(chalk.red(`[ERROR] sendAttachmentAPI failed: ${errorMsg}`));

        // Fallback: Send caption and direct link if attachment fails
        let fallbackText = caption ? `${caption}\n\n` : "";
        fallbackText += `⚠️ *Facebook system error: Attachment could not be sent directly.*\n\n🔗 *Click here to download/view:* \n${url}`;

        return callSendAPI(sender_psid, { text: fallbackText });
    }
}

app.get('/', (req, res) => res.status(200).send("Bot is Running! (حمزة اعمرني)"));

setInterval(() => {
    const url = process.env.PUBLIC_URL || config.publicUrl;
    if (url) {
        axios.get(url).then(() => console.log(chalk.gray(`[DEBUG] Heartbeat sent`))).catch(() => { });
    }
}, 5 * 60 * 1000); // Pulse every 5 minutes

app.listen(process.env.PORT || 8080, () => {
    console.log(chalk.cyan(`Bot starting...`));
    setPersistentMenu(); // Update menu on boot
});
