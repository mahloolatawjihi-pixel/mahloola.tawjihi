import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';

const app = express();
app.use(cors());
app.use(express.json());

// تهيئة Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-001" });

// مصفوفة لطابور الانتظار لمنع انهيار السيرفر عند الضغط
const requestQueue = [];
let isProcessing = false;

// دالة معالجة الطلبات بالترتيب (Queue)
async function processQueue() {
    if (isProcessing || requestQueue.length === 0) return;
    
    isProcessing = true;
    const { req, res } = requestQueue.shift();

    const { question, subject, history = [] } = req.body;

    if (!question || !subject) {
        res.status(400).json({ reply: 'ناقص سؤال أو اسم مادة بالطلب.' });
        isProcessing = false;
        processQueue();
        return;
    }

    try {
        const systemInstruction = `أنت "سند"، مساعد ذكاء اصطناعي ذكي وودود مخصص لطلاب التوجيهي في الأردن. 
مهمتك مساعدة الطالب بمادة: ${subject}.
القواعد: أجب بلهجة أردنية بسيطة وودودة، بشكل مختصر ومركز، وركز فقط على سؤال الطالب.`;

        const formattedHistory = history
            .filter(m => m.role === 'user' || m.role === 'assistant')
            .map(m => ({
                role: m.role === 'user' ? 'user' : 'model',
                parts: [{ text: m.content }],
            }));

        const validHistory = (formattedHistory.length > 0 && formattedHistory[0].role === 'model')
            ? formattedHistory.slice(1)
            : formattedHistory;

        const chat = model.startChat({
            history: validHistory,
            generationConfig: {
                maxOutputTokens: 500,
                temperature: 0.7,
            },
        });

        const finalPrompt = `${systemInstruction}\n\nسؤال الطالب: ${question}`;

        const result = await chat.sendMessage(finalPrompt);
        const response = await result.response;
        const reply = response.text() || 'عذرًا، لم أستطع الرد الآن.';

        res.json({ reply });

    } catch (error) {
        console.error('خطأ في الاتصال بـ Gemini:', error);
        res.status(500).json({ reply: 'عذرًا، واجهت ضغطاً على السيرفر، جاري المحاولة...' });
    } finally {
        isProcessing = false;
        processQueue(); // الانتقال للطلب التالي في الطابور
    }
}

app.get('/', (req, res) => {
    res.send('سيرفر سند (Gemini) شغال ✅');
});

app.post('/api/chat', (req, res) => {
    // إضافة الطلب إلى الطابور بدلاً من معالجته فوراً بشكل عشوائي
    requestQueue.push({ req, res });
    processQueue();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`سيرفر سند يعمل الآن على http://localhost:${PORT}`);
});