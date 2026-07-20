require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/chat', async (req, res) => {
    const { question, subject, history } = req.body;

    try {
        const chatHistory = history.map(m => `${m.role === 'user' ? 'الطالب' : 'سند'}: ${m.content}`).join('\n');

        const prompt = `أنت "سند"، مساعد ذكاء اصطناعي ذكي وودود مخصص لطلاب التوجيهي 2010 في الأردن. 
        مهمتك مساعدة الطالب في مادة: ${subject}.
        القواعد: أجب بلهجة أردنية بسيطة. سجل المحادثة:
        ${chatHistory}
        سؤال الطالب: ${question}`;

        // اتصال مباشر عبر fetch لتجاوز قيود المكتبة
        const response = await fetch("https://api-inference.huggingface.co/models/HuggingFaceH4/zephyr-7b-beta", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.HF_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                inputs: prompt,
                parameters: { max_new_tokens: 500, temperature: 0.7 }
            })
        });

        const data = await response.json();
        
        // استخراج النص من رد Hugging Face
        const reply = data[0]?.generated_text ? data[0].generated_text.split("سؤال الطالب:")[1] || data[0].generated_text : "عذرًا، لم أستطع الرد الآن.";

        res.json({ reply: reply.trim() });

    } catch (error) {
        console.error("خطأ في السيرفر:", error);
        res.status(500).json({ reply: "عذرًا، واجهت مشكلة في الاتصال بالذكاء الاصطناعي، حاول مرة ثانية 🙏" });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`سيرفر سند يعمل الآن على http://localhost:${PORT}`);
});