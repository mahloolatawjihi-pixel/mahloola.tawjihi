import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { Groq } from 'groq-sdk';

const app = express();
app.use(cors());
app.use(express.json());

// تهيئة Groq باستخدام المفتاح
const groq = new Groq({ apiKey: process.env.GEMINI_API_KEY }); // اسم المتغير قديم بس القيمة مفتاح Groq

const APOLOGY_TEXT = "عذرًا، ما بقدر أجاوبك على هذا السؤال 🙏 جرّب ترجع للكتب الوزارية الأربعة، وبإذن الله تلاقي الجواب فيها.";

// مصفوفة لطابور الانتظار لمنع انهيار السيرفر عند الضغط
const requestQueue = [];
let isProcessing = false;

// دالة معالجة الطلبات بالترتيب (Queue)
async function processQueue() {
    if (isProcessing || requestQueue.length === 0) return;

    isProcessing = true;
    const { req, res } = requestQueue.shift();

    const { question, subject, history = [], context = '' } = req.body;

    if (!question || !subject) {
        res.status(400).json({ reply: 'ناقص سؤال أو اسم مادة بالطلب.' });
        isProcessing = false;
        processQueue();
        return;
    }

    // ما في مقاطع من الكتاب متعلقة بالسؤال -> اعتذار مباشر من غير ما نستدعي Groq أصلاً
    if (!context || !context.trim()) {
        res.json({ reply: APOLOGY_TEXT });
        isProcessing = false;
        processQueue();
        return;
    }

    try {
        const systemInstruction = `أنت "سند"، مساعد ذكاء اصطناعي داخل موقع "محلولة" لطلاب توجيهي 2010 (المسار الأكاديمي).
مهمتك تساعد الطالب بس بمادة ${subject}، بالاعتماد حصرًا على المقاطع المرفقة تحت من الكتاب المدرسي الوزاري الأردني.

قواعد صارمة يجب اتباعها دايمًا:
- ما تجاوب إلا من المعلومات الموجودة بالمقاطع تحت. ممنوع تستخدم أي معلومة من معرفتك العامة أو من برا المنهاج، حتى لو كنت متأكد منها.
- إذا سؤال الطالب برا نطاق المقاطع المرفقة، أو مش موجود جوابه فيها، لازم تجاوب بالضبط بهاد النص ولا كلمة زيادة:
"${APOLOGY_TEXT}"
- احكي بلهجة أردنية بسيطة وودودة، متل ما صاحبك الفاهم بيشرحلك، من غير تعقيد أو حشو.
- خلي الشرح مختصر ومركز، وجاوب بس عالسؤال يلي انسأل.

المقاطع من الكتاب الوزاري (${subject}):
---
${context}
---`;

        // تجهيز التاريخ لـ Groq (يتوافق مع نظام OpenAI القياسي)
        const formattedHistory = [
            { role: "system", content: systemInstruction },
            ...history.filter(m => m.role === 'user' || m.role === 'assistant')
                .slice(-8)
                .map(m => ({ role: m.role, content: m.content })),
            { role: "user", content: question }
        ];

        const completion = await groq.chat.completions.create({
            messages: formattedHistory,
            model: "llama-3.3-70b-versatile", // نموذج صاروخي وذكي جداً من Groq
            temperature: 0.4,
            max_tokens: 500,
        });

        const reply = completion.choices[0]?.message?.content || APOLOGY_TEXT;
        res.json({ reply });

    } catch (error) {
        console.error('خطأ في الاتصال بـ Groq:', error);
        res.status(500).json({ reply: 'عذرًا، واجهت ضغطاً على السيرفر، جرّب كمان شوي 🙏' });
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
