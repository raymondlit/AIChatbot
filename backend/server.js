// 简单后端：负责调用 DeepSeek，并用 JSON 文件维护材料库和知识库
// 需要 Node.js 18+（自带 fetch）

const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const dotenv = require('dotenv');
const pdfParse = require('pdf-parse');

dotenv.config();

const app = express();
app.use(cors());
// PDF base64 会比较大，这里把 JSON body 限制调高
app.use(express.json({ limit: '100mb' }));

const DATA_DIR = path.join(process.cwd(), 'data');
const MATERIALS_FILE = path.join(DATA_DIR, 'materials.json');
const KB_FILE = path.join(DATA_DIR, 'knowledge_base.json');

// 确保 data 目录和 json 文件存在
async function ensureDataFiles() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    try {
      await fs.access(MATERIALS_FILE);
    } catch {
      await fs.writeFile(MATERIALS_FILE, '[]', 'utf-8');
    }
    try {
      await fs.access(KB_FILE);
    } catch {
      await fs.writeFile(KB_FILE, '[]', 'utf-8');
    }
  } catch (e) {
    console.error('init data dir error:', e);
  }
}

async function readJson(file, fallback = []) {
  try {
    const text = await fs.readFile(file, 'utf-8');
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

async function writeJson(file, data) {
  await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf-8');
}

// 简单分段：按句子长度粗略切成 1~3 句话一段
function simpleChunk(text, maxLen = 300) {
  const sentences = text
    .split(/[\n。！？!?]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const chunks = [];
  let buf = '';
  for (const s of sentences) {
    if ((buf + s).length > maxLen) {
      chunks.push(buf);
      buf = s + '。';
    } else {
      buf += s + '。';
    }
  }
  if (buf.trim()) chunks.push(buf);
  return chunks;
}

// 调 DeepSeek，把一小段原文压缩成 1~2 句摘要（知识点）
async function summarizeWithDeepSeek(rawText) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const base = process.env.DEEPSEEK_API_BASE || 'https://api.deepseek.com';
  const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY 未配置（.env）');
  }

  const res = await fetch(`${base}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content:
            '你是一个严谨的教材整理助手，只需把输入内容压缩为 1~2 句中文知识点摘要，不要发挥，不要加入额外解释。',
        },
        {
          role: 'user',
          content: rawText.slice(0, 2000),
        },
      ],
      temperature: 0.1,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('DeepSeek summarize error:', text);
    throw new Error('DeepSeek summarize failed');
  }

  const data = await res.json();
  return data.choices[0].message.content.trim();
}

// 教师上传资料：
// - 文本类：前端把已经读取好的 content 文本发过来
// - PDF：前端把文件以 base64 发送在 contentBase64 字段里
// body: { name, type, content?, contentBase64? }
app.post('/api/materials', async (req, res) => {
  try {
    const { name, type, content, contentBase64 } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'name 必填' });
    }

    const materials = await readJson(MATERIALS_FILE);
    const id = Date.now().toString();

    materials.push({
      id,
      name,
      type: type || 'text',
      createdAt: new Date().toISOString(),
    });
    await writeJson(MATERIALS_FILE, materials);

    // 准备要解析的原始文本
    let finalText = content || '';

    // 如果是 PDF 并且有 base64 内容，则在后端解析为文本
    if ((type || '').toLowerCase() === 'pdf' && contentBase64) {
      try {
        const buffer = Buffer.from(contentBase64, 'base64');
        const pdfData = await pdfParse(buffer);
        finalText = pdfData.text || '';
      } catch (err) {
        console.error('PDF 解析失败，将尝试直接使用原始 content：', err);
      }
    }

    if (!finalText) {
      return res.status(400).json({ error: '未获取到可解析的文本内容' });
    }

    // 把文本切段，并为每段生成知识条目
    const chunks = simpleChunk(finalText);
    const kb = await readJson(KB_FILE);

    for (const [index, chunk] of chunks.entries()) {
      let summary;
      try {
        summary = await summarizeWithDeepSeek(chunk);
      } catch (e) {
        console.error('summarize error, fallback raw:', e);
        summary = chunk.slice(0, 200);
      }

      kb.push({
        id: kb.length + 1,
        materialId: id,
        sourceFile: name,
        index,
        raw: chunk,
        summary,
      });
    }

    await writeJson(KB_FILE, kb);

    res.json({ ok: true, materialId: id, addedChunks: chunks.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'upload failed' });
  }
});

// 学生提问：严格基于知识库回答
// body: { question }
app.post('/api/ask', async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) {
      return res.status(400).json({ error: 'question 必填' });
    }

    const kb = await readJson(KB_FILE);
    if (!kb.length) {
      return res.json({
        answer:
          '当前知识库为空，请先上传课程资料并完成解析，我才能基于资料进行回答。',
      });
    }

    // 非常粗糙的关键词匹配，拿到若干最相关片段
    const qLower = question.toLowerCase();
    const scored = kb
      .map((item) => {
        const text = (item.summary + ' ' + item.raw).toLowerCase();
        let score = 0;
        qLower.split(/[\s，,。]/).forEach((w) => {
          if (!w) return;
          if (text.includes(w)) score += 1;
        });
        return { item, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .filter((s) => s.score > 0);

    const selected = scored.length ? scored.map((s) => s.item) : kb.slice(0, 3);

    const context = selected
      .map(
        (i, idx) =>
          `【片段${idx + 1}，来源：${i.sourceFile}】\n原文：${i.raw}\n摘要：${i.summary}`,
      )
      .join('\n\n');

    const apiKey = process.env.DEEPSEEK_API_KEY;
    const base = process.env.DEEPSEEK_API_BASE || 'https://api.deepseek.com';
    const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

    if (!apiKey) {
      throw new Error('DEEPSEEK_API_KEY 未配置（.env）');
    }

    const dsRes = await fetch(`${base}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content:
              '你是一名严格遵守资料的教学助教。你必须只根据提供的资料片段回答问题：\n' +
              '1. 如果资料中包含答案，用清晰的中文讲解，但不要引入资料外的新知识。\n' +
              '2. 如果资料不足以回答，就明确说明“根据目前课程资料无法确定答案”。\n' +
              '3. 可以引用片段编号帮助学生定位原文。',
          },
          {
            role: 'user',
            content:
              `学生问题：${question}\n\n` +
              '以下是与问题相关的课程资料片段：\n\n' +
              context +
              '\n\n请严格基于这些资料回答。',
          },
        ],
        temperature: 0.1,
      }),
    });

    if (!dsRes.ok) {
      const text = await dsRes.text();
      console.error('DeepSeek ask error:', text);
      return res.status(500).json({ error: 'DeepSeek 调用失败' });
    }

    const data = await dsRes.json();
    const answer = data.choices[0].message.content.trim();

    res.json({ answer, usedChunks: selected.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'ask failed' });
  }
});

// 给前端初始化用：获取当前材料列表和知识库内容
app.get('/api/state', async (req, res) => {
  const materials = await readJson(MATERIALS_FILE);
  const kb = await readJson(KB_FILE);
  res.json({ materials, knowledgeBase: kb });
});

// 启动服务
const port = process.env.PORT || 3001;

ensureDataFiles().then(() => {
  app.listen(port, () => {
    console.log(`Backend listening on http://localhost:${port}`);
  });
});