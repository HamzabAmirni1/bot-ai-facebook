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
const OWNER_NAME = "Hamza Amirni";
config.ownerName = OWNER_NAME;

const systemPromptText = `You are ${config.botName}, a smart assistant developed by the legendary ${OWNER_NAME}.
- You respond in Moroccan Darija, Arabic, English, or French.
- Refer to your creator as ${OWNER_NAME}.
- Be extremely helpful and friendly.
- When asked about your features (الميزات, شنو كدير, what can you do), list ALL available commands:
  1. *.play [song]*: Download music.
  2. *.imagine [text]*: Generate AI images (supports Darija/Arabic).
  3. *.yts [name]*: Search YouTube.
  4. *.ytmp3 / .ytmp4 [link]*: Download YouTube audio/video.
  5. *.quran [surah]*: Read Quran.
  6. *.quranmp3 [surah]*: Listen to Quran.
  7. *.riwaya*: Read stories (Arabic/Darija).
  8. Auto-detects YouTube links to download them.
  9. Auto-detects "draw/رسم" to generate images.`;

// Temporary Session Memory for Stories & Images
const userStorySession = {};
const userImageSession = {};

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

        return { status: false, error: "Download failed" };
    }
};

// --- QURAN TEXT ---
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

// --- AI FUNCTIONS ---
async function getLuminAIResponse(senderId, message) {
    try {
        const { data } = await axios.post("https://luminai.my.id/", { content: systemPromptText + "\n\nUser: " + message, user: senderId }, { timeout: 8000 });
        return data.result || null;
    } catch (e) { return null; }
}

async function getHectormanuelAI(senderId, message, model = "gpt-4o-mini", customSystemPrompt = null) {
    try {
        const sys = customSystemPrompt !== null ? customSystemPrompt : systemPromptText;
        const { data } = await axios.get(`https://all-in-1-ais.officialhectormanuel.workers.dev/?query=${encodeURIComponent(sys + "\n\nUser: " + message)}&model=${model}`, { timeout: 8000 });
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
    } catch (e) { return null; }
}

async function describeImage(imageUrl) {
    if (!config.geminiApiKey) return null;
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${config.geminiApiKey}`;
        const imageRes = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const contents = [{
            parts: [
                { text: "Describe this image in detail. Focus on the main subject, setting, and colors. Be concise." },
                { inline_data: { mime_type: "image/jpeg", data: Buffer.from(imageRes.data).toString("base64") } }
            ]
        }];
        const res = await axios.post(url, { contents }, { timeout: 15000 });
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
        }

        console.log(chalk.blue(`[MSG] ${sender_psid}: ${text}`));
        sendTypingAction(sender_psid, 'typing_on');

        let command = rawText.split(' ')[0].startsWith('.') ? rawText.split(' ')[0].substring(1) : "";
        let args = text.split(' ').slice(1);

        // --- SMART INTENT ROUTER (Natural Language) ---
        if (!command) {
            // Music/Audio
            const musicRegex = /^(play|music|song|أغنية|اغنية|موسيقى|سمعني|خدم|شغل|طلاق)\s+(.+)/i;
            // Video
            const videoRegex = /^(video|mp4|فيديو|telecharger|télecharger)\s+(.+)/i;
            // Quran
            const quranRegex = /^(quran|koran|قرآن|قران|سورة)\s+(.+)/i;
            // Imagine/Draw
            const drawRegex = /^(imagine|draw|image|رسم|ارسم|صورة|تخيل|انشيء)(\s+لي)?\s+(.+)/i;
            // Edit Image (Flexible)
            const editRegex = /^(?:dir|sawb|baghi|bghit|momkin)?\s*(?:edit|img|تعديل|عدل|بدل|غيّر)\s*(?:lya|lia)?\s*(?:al|el)?\s*(?:sura|tswira|image|photo|background|bg)?\s*(.+)/i;
            // Stories
            const storyRegex = /^(story|riwaya|hikaya|قصة|رواية|حكاية)/i;

            if (musicRegex.test(rawText)) {
                command = 'play';
                args = rawText.match(musicRegex)[2].split(' ');
            } else if (quranRegex.test(rawText)) {
                command = 'quran';
                args = rawText.match(quranRegex)[2].split(' ');
            } else if (drawRegex.test(rawText)) {
                command = 'imagine';
                args = rawText.match(drawRegex)[3].split(' ');
            } else if (editRegex.test(rawText)) {
                // Check if we have an image in session OR attachment
                if (imageUrl || userImageSession[sender_psid]) {
                    command = 'img';
                    // The regex group matching the prompt is likely at the end.
                    // Match result: [full, prefix?, command, ..., prompt]
                    // Let's use a simpler specific cleaner closer to the command handler.
                    // For now, extract the last group which is (.+)
                    const matches = rawText.match(editRegex);
                    // The last group is the prompt. Length varies based on optional groups.
                    // Let's just grab the last element.
                    args = (matches[matches.length - 1] || "").split(' ');
                }
            } else if (storyRegex.test(rawText)) {
                command = 'riwaya';
            } else if (videoRegex.test(rawText)) {
                command = 'yts'; // Or handle video DL directly
                args = rawText.match(videoRegex)[2].split(' ');
            }
        }

        // --- IMAGE EDITING (.img) ---
        // Support: Caption OR Reply/Sequential
        if (command === 'img' || command === 'edit') {
            let prompt = args.join(' ');
            if (!prompt) prompt = "enhance this image";

            // Check current message attachment OR session
            const targetImage = imageUrl || userImageSession[sender_psid];

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



        // YouTube Auto-Detection (JUST a link)
        const ytPattern = /(?:https?:\/\/)?(?:www\.)?(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([a-zA-Z0-9_-]{11})/;
        if (ytPattern.test(text.trim()) && !text.startsWith('.')) {
            console.log(chalk.yellow(`[DEBUG] YT Link Auto-Detected`));
            callSendAPI(sender_psid, { text: "🔗 YouTube Link detected! Please wait..." });
            callSendAPI(sender_psid, { text: "🔗 YouTube Link detected! Please wait..." });
            const res = await downloader.download(text.trim(), '720');
            if (res.status) {
                return sendAttachmentAPI(sender_psid, 'video', res.result.download, `✅ *${res.result.title}*\nBy ${OWNER_NAME}`);
            } else {
                return callSendAPI(sender_psid, { text: "❌ فشل تحميل الفيديو. حاول مرة أخرى برابط آخر." });
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

        if (['menu', 'help', 'الاوامر', 'دليل', 'المنيو'].includes(command)) {
            const menu = `🌟 *قائمة أوامر ${config.botName}* 🌟\n\n` +
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
                `� *.imagine [text]* : رسم بالذكاء الاصطناعي\n` +
                `🎬 *.ytmp4 [link]* : تحميل فيديو\n` +
                `🕌 *.quran [name]* : قراءة القرآن\n` +
                `🎧 *.quranmp3 [name]* : استماع للقرآن\n` +
                `� *.riwaya* : قصص وروايات\n\n` +

                `👑 *المطور:* ${OWNER_NAME}\n` +
                `📸 Insta: @hamza_amirni_01`;
            return callSendAPI(sender_psid, { text: menu });
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
                    return sendAttachmentAPI(sender_psid, 'audio', res.result.download, `✅ *${video.title}*\nBy ${OWNER_NAME}`);
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

        // --- OWNER ---
        if (command === 'owner' || command === 'مطور') {
            return callSendAPI(sender_psid, { text: `👤 *Developer:* ${OWNER_NAME}\n📸 Instagram: ${config.social.instagram}\n💬 WhatsApp: ${config.social.whatsapp}` });
        }

        // --- FALLBACK AI ---
        let aiReply = imageUrl ? await getGeminiResponse(sender_psid, text, imageUrl) : (await getLuminAIResponse(sender_psid, text) || await getHectormanuelAI(sender_psid, text));
        if (!aiReply) aiReply = "Sma7 lya, mfhmtch.";

        sendTypingAction(sender_psid, 'typing_off');
        callSendAPI(sender_psid, { text: aiReply });
    } catch (error) {
        console.error(chalk.red("[FATAL ERROR]:"), error);
        sendTypingAction(sender_psid, 'typing_off');
    }
}

function sendTypingAction(sender_psid, action) {
    axios.post(`https://graph.facebook.com/v19.0/me/messages?access_token=${config.PAGE_ACCESS_TOKEN}`, { recipient: { id: sender_psid }, sender_action: action }).catch(() => { });
}

function callSendAPI(sender_psid, response) {
    return axios.post(`https://graph.facebook.com/v19.0/me/messages?access_token=${config.PAGE_ACCESS_TOKEN}`, { recipient: { id: sender_psid }, message: response })
        .catch(err => console.error(chalk.red('Error: ' + (err.response?.data?.error?.message || err.message))));
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

app.listen(process.env.PORT || 8080, () => console.log(chalk.cyan(`Bot starting...`)));
