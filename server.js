import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { InferenceClient } from '@huggingface/inference';

const app = express();
app.use(cors());
app.use(express.json());

const client = new InferenceClient(process.env.HF_API_KEY);

// health check - يفيدك تتأكد إن السيرفر شغال (افتح الرابط بالمتصفح)
app.get('/', (req, res) => {
    res.send('سيرفر سند شغال ✅');
});

app.post('/api/chat', async (req, res) => {
    const { question, subject, history = [] } = req.body;

    if (!question || !subject) {
        return res.status(400).json({ reply: 'ناقص سؤال أو اسم مادة بالطلب.' });
    }

    try {
        const systemPrompt = `أنت "سند"، مساعد ذكاء اصطناعي ذكي وودود مخصص لطلاب توجيهي 2010 في الأردن (المسار الأكاديمي).
مهمتك مساعدة الطالب بمادة: ${subject}.
القواعد: أجب بلهجة أردنية بسيطة وودودة، بشكل مختصر ومركز، وركز فقط على سؤال الطالب.`;

        const messages = [
            { role: 'system', content: systemPrompt },
            ...history.slice(-8).map(m => ({
                role: m.role === 'user' ? 'user' : 'assistant',
                content: m.content
            })),
            { role: 'user', content: question }
        ];

        // نستخدم Inference Providers الجديدة (القديمة api-inference.huggingface.co صارت متوقفة تمامًا)
        const completion = await client.chatCompletion({
            model: 'meta-llama/Llama-3.1-8B-Instruct',
            provider: 'auto',
            messages,
            max_tokens: 500,
            temperature: 0.7
        });

        const reply = completion.choices?.[0]?.message?.content?.trim()
            || 'عذرًا، لم أستطع الرد الآن.';

        res.json({ reply });

    } catch (error) {
        console.error('خطأ في السيرفر:', error);
        res.status(500).json({ reply: 'عذرًا، واجهت مشكلة في الاتصال بالذكاء الاصطناعي، حاول مرة ثانية 🙏' });
    }
});

// مهم: Render بيحدد البورت هو بنفسه عبر process.env.PORT، لازم نستخدمه
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`سيرفر سند يعمل الآن على http://localhost:${PORT}`);
});
