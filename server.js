import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';

const app = express();
app.use(cors());
app.use(express.json());

// تهيئة Gemini باستخدام المفتاح الموجود في Render (تأكد أن اسمه GEMINI_API_KEY)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// health check
app.get('/', (req, res) => {
    res.send('سيرفر سند (Gemini) شغال ✅');
});

app.post('/api/chat', async (req, res) => {
    const { question, subject, history = [] } = req.body;

    if (!question || !subject) {
        return res.status(400).json({ reply: 'ناقص سؤال أو اسم مادة بالطلب.' });
    }

    try {
        const systemInstruction = `أنت "سند"، مساعد ذكاء اصطناعي ذكي وودود مخصص لطلاب التوجيهي في الأردن. 
مهمتك مساعدة الطالب بمادة: ${subject}.
القواعد: أجب بلهجة أردنية بسيطة وودودة، بشكل مختصر ومركز، وركز فقط على سؤال الطالب.`;

        // تحويل التاريخ (History) لتنسيق Gemini
        const chat = model.startChat({
            history: history.slice(-8).map(m => ({
                role: m.role === 'user' ? 'user' : 'model',
                parts: [{ text: m.content }],
            })),
            generationConfig: {
                maxOutputTokens: 500,
                temperature: 0.7,
            },
        });

        // دمج التعليمات مع السؤال
        const fullPrompt = `${systemInstruction}\n\nسؤال الطالب: ${question}`;

        const result = await chat.sendMessage(fullPrompt);
        const response = await result.response;
        const reply = response.text() || 'عذرًا، لم أستطع الرد الآن.';

        res.json({ reply });

    } catch (error) {
        console.error('خطأ في الاتصال بـ Gemini:', error);
        res.status(500).json({ reply: 'عذرًا، واجهت مشكلة في الاتصال بالسيرفر، حاول مرة ثانية 🙏' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`سيرفر سند يعمل الآن على http://localhost:${PORT}`);
});