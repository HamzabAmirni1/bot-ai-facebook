const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const config = require('./config');
const chalk = require('chalk');

const app = express().use(bodyParser.json());

// --- AI FUNCTIONS (Ported from original bot) ---

async function getLuminAIResponse(senderId, message) {
    try {
        const { data } = await axios.post("https://luminai.my.id/", {
            content: message,
            user: senderId,
        }, { timeout: 12000 });
        return data.result || null;
    } catch (error) {
        return null;
    }
}

async function getPollinationsResponse(senderId, message) {
    try {
        const { data } = await axios.post("https://text.pollinations.ai/openai", {
            messages: [{ role: "user", content: message }],
            model: "openai",
            seed: Math.floor(Math.random() * 1000000),
        }, { timeout: 15000 });
        return data.choices?.[0]?.message?.content || (typeof data === "string" ? data : null);
    } catch (error) {
        return null;
    }
}

// --- FACEBOOK MESSENGER LOGIC ---

// Webhook Verification (GET)
app.get('/webhook', (req, res) => {
    let mode = req.query['hub.mode'];
    let token = req.query['hub.verify_token'];
    let challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === config.VERIFY_TOKEN) {
            console.log(chalk.green('WEBHOOK_VERIFIED'));
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    }
});

// Message Handling (POST)
app.post('/webhook', (req, res) => {
    let body = req.body;

    if (body.object === 'page') {
        body.entry.forEach(function (entry) {
            let webhook_event = entry.messaging[0];
            console.log(webhook_event);

            let sender_psid = webhook_event.sender.id;
            if (webhook_event.message && webhook_event.message.text) {
                handleMessage(sender_psid, webhook_event.message);
            }
        });
        res.status(200).send('EVENT_RECEIVED');
    } else {
        res.sendStatus(404);
    }
});

async function handleMessage(sender_psid, received_message) {
    let response;
    const text = received_message.text;

    console.log(chalk.blue(`[FB-BOT] Message from ${sender_psid}: ${text}`));

    // Call AI
    let aiReply = await getLuminAIResponse(sender_psid, text) || await getPollinationsResponse(sender_psid, text);

    if (!aiReply) {
        aiReply = "Afwan, m9dertch njawb 3la had l-message f had l-we9t. Jaraib mara okhra!";
    }

    response = { "text": aiReply };
    callSendAPI(sender_psid, response);
}

function callSendAPI(sender_psid, response) {
    let request_body = {
        "recipient": { "id": sender_psid },
        "message": response
    };

    axios.post(`https://graph.facebook.com/v19.0/me/messages?access_token=${config.PAGE_ACCESS_TOKEN}`, request_body)
        .then(() => {
            console.log(chalk.green('Message sent!'));
        })
        .catch(err => {
            console.error(chalk.red('Unable to send message: ' + err));
        });
}

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(chalk.cyan(`Facebook Bot Webhook is listening on port ${PORT}`)));
