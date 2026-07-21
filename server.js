import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { Groq } from 'groq-sdk';

const app = express();
app.use(cors());
app.use(express.json());

// تهيئة Groq باستخدام المفتاح الجديد
const groq = new Groq({ apiKey: process.env.GEMINI_API_KEY }); // سيبقى اسم المتغير نفسه لسهولة الإعدادات

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

        // تجهيز التاريخ لـ Groq (يتوافق مع نظام OpenAI القياسي)
        const formattedHistory = [
            { role: "system", content: systemInstruction },
            ...history.filter(m => m.role === 'user' || m.role === 'assistant')
                      .map(m => ({ role: m.role, content: m.content })),
            { role: "user", content: question }
        ];

        const completion = await groq.chat.completions.create({
            messages: formattedHistory,
            model: "llama-3.3-70b-versatile", // نموذج صاروخي وذكي جداً من Groq
            temperature: 0.7,
            max_tokens: 500,
        });

        const reply = completion.choices[0]?.message?.content || 'عذرًا، لم أستطع الرد الآن.';
        res.json({ reply });

    } catch (error) {
        console.error('خطأ في الاتصال بـ Groq:', error);
        res.status(500).json({ reply: 'عذرًا، واجهت ضغطاً على السيرفر، جاري المحاولة...' });
    } finally {
        isProcessing = false;
        processQueue(); // الانتقال للطلب التالي في الطابور
    }
}

app.get('/', (req, res) => {
    res.send('سيرفر سند (Groq) شغال ✅');
});

app.post('/api/chat', (req, res) => {
    requestQueue.push({ req, res });
    processQueue();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`سيرفر سند يعمل الآن على http://localhost:${PORT}`);
});