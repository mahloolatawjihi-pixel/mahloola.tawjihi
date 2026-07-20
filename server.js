require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { HfInference } = require('@huggingface/inference');

const app = express(); 

app.use(cors());
app.use(express.json());

const hf = new HfInference(process.env.HF_API_KEY);

app.post('/api/chat', async (req, res) => {
    const { question, subject, history } = req.body;

    try {
        const chatHistory = history.map(m => `${m.role === 'user' ? 'الطالب' : 'سند'}: ${m.content}`).join('\n');

        const prompt = `أنت "سند"، مساعد ذكاء اصطناعي ذكي وودود مخصص لطلاب التوجيهي 2010 في الأردن.
        مهمتك مساعدة الطالب في مادة: ${subject}.
        
        القواعد:
        1. أجب بلهجة أردنية بسيطة وقريبة من الطالب.
        2. التزم بالمنهاج الوزاري الأردني.
        3. استخدم سجل المحادثة التالي لفهم سياق السؤال:
        ${chatHistory}
        
        سؤال الطالب الحالي: ${question}`;

        // التعديل هنا: استخدام chatCompletion بدلاً من textGeneration لضمان التوافق
        const result = await hf.chatCompletion({
            model: 'mistralai/Mistral-7B-Instruct-v0.2',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 500,
            temperature: 0.7
        });

        res.json({ reply: result.choices[0].message.content });

    } catch (error) {
        console.error("خطأ في السيرفر:", error);
        res.status(500).json({ reply: "عذرًا، واجهت مشكلة في الاتصال بالذكاء الاصطناعي، حاول مرة ثانية 🙏" });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`سيرفر سند يعمل الآن على http://localhost:${PORT}`);
});