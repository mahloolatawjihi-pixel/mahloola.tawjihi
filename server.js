import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { Groq } from 'groq-sdk';
import rateLimit from 'express-rate-limit'; // 1. استيراد حزمة الحماية

const app = express();
app.use(cors());
app.use(express.json());

// 2. إعداد حدود الطلبات (أقصى حد 20 طلب لكل دقيقة لكل آيبيه لحماية الرصيد)
const chatLimiter = rateLimit({
    windowMs: 60 * 1000, // دقيقة وحدة
    max: 20,
    message: { reply: "طلبات كثيرة جداً، يرجى المحاولة بعد قليل ⏳" }
});

// تهيئة Groq باستخدام المفتاح
const groq = new Groq({ apiKey: process.env.GEMINI_API_KEY }); // اسم المتغير قديم بس القيمة مفتاح Groq

const APOLOGY_TEXT = "عذرًا، ما بقدر أجاوبك على هذا السؤال 🙏 جرّب ترجع للكتب الوزارية الأربعة، وبإذن الله تلاقي الجواب فيها.";

app.get('/', (req, res) => {
    res.send('سيرفر سند (Groq) شغال ✅');
});

// 3. إضافة chatLimiter هنا كمتوسط حماية لمسار الـ API
app.post('/api/chat', chatLimiter, async (req, res) => {
    const { question, subject, history = [], context = '' } = req.body;

    if (!question || !subject) {
        return res.status(400).json({ reply: 'ناقص سؤال أو اسم مادة بالطلب.' });
    }

    // ما في مقاطع من الكتاب متعلقة بالسؤال -> اعتذار مباشر من غير ما نستدعي Groq أصلاً
    if (!context || !context.trim()) {
        return res.json({ reply: APOLOGY_TEXT });
    }

    try {
        const systemInstruction = `
أنت "سند"، مساعد تعليمي ذكي وودود جداً لطلاب التوجيهي والمرحلة الثانوية في الأردن.
أسلوبك في الكلام:
1. تفاعلي، مرن، وفيه "أخذ وعطى" (يعني غير جامد ولا جاف)، وتستخدم عبارات تشجيعية لطيفة مثل "يا هلا فيك"، "خطوة ممتازة"، "ركز معي شوي وهسا بتوضح".
2. مصدرك الأساسي هو المنهاج والكتب الوزارية الأربعة (عربي، رياضيات، تاريخ أردن، تربية إسلامية).
3. لكن لو الطالب سألك عن سؤال حسابي بحت (مثل 50 * 50) أو معادلة رياضية سريعة تخدم فهمه، **لا تعتذر أبداً**، بل جاوب عليها ببساطة ووضح له طريقتها بأسلوب ممتع ولطيف، واكتفي بربطها بقواعد المنهاج إن وجد.
4. إذا كان السؤال بعيد كلياً عن المنهاج أو التعليم (مثل أسئلة عامة مالها علاقة بالدراسة)، اعتذر بلطف ووجهه للمنهاج.
`;

        // تجهيز التاريخ لـ Groq (يتوافق مع نظام OpenAI القياسي)
        const formattedHistory = [
            { role: "system", content: systemInstruction },
            ...history.filter(m => m.role === 'user' || m.role === 'assistant')
                .slice(-3)
                .map(m => ({ role: m.role, content: m.content })),
            { role: "user", content: question }
        ];

        const completion = await groq.chat.completions.create({
            messages: formattedHistory,
            model: "openai/gpt-oss-120b",
            temperature: 0.4,
            max_tokens: 500,
        });

        const reply = completion.choices[0]?.message?.content || APOLOGY_TEXT;
        res.json({ reply });

    } catch (error) {
        console.error('خطأ في الاتصال بـ Groq:', error);
        res.status(500).json({ reply: 'عذرًا، صار خطأ بالاتصال بالذكاء الاصطناعي، جرّب كمان مرة 🙏' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`سيرفر سند يعمل الآن على http://localhost:${PORT}`);
});