# Facebook Messenger Bot (Hamza Amirni)

هذا بوت مخصص لصفحات فيسبوك (Facebook Pages) مدمج مع الذكاء الاصطناعي.

## طريقة الإعداد (Setup):

1. **إنشاء تطبيق فيسبوك**:
   - اذهب إلى [Facebook Developers](https://developers.facebook.com/).
   - أنشئ تطبيقاً جديداً (Create App) من نوع "Business" أو "Other".
   - أضف منتج "Messenger" إلى التطبيق.

2. **إعدادات Messenger**:
   - اربط التطبيق بصفحتك على فيسبوك.
   - قم بتوليد **Page Access Token** وضعه في ملف `config.js`.

3. **إعداد Webhook**:
   - قم برفع هذا البوت على سيرفر (مثلاً Koyeb أو Render).
   - في إعدادات Messenger، اضغط على "Configure" في قسم Webhooks.
   - الـ Callback URL سيكون: `https://your-server-url.com/webhook`
   - الـ Verify Token هو الموجود في `config.js` (الافتراضي هو `HAMZA_BOT_VERIFY_TOKEN`).
   - اختر اشتراكات (Subscribed Fields): `messages`, `messaging_postbacks`.

4. **تشغيل البوت**:
   ```bash
   cd facebook-bot
   npm install
   npm start
   ```

## المميزات:
- الرد التوضيحي بالذكاء الاصطناعي (LuminAI & Pollinations).
- خفيف وسريع.
- يدعم الدارجة المغربية.
