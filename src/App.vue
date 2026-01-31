<template>
  <div class="app-shell">
    <header class="app-header">
      <div class="app-header-title">
        <span>AI课程助手</span>
        <span class="app-header-badge">教师资料管理 · 学生智能答疑</span>
      </div>
      <div style="font-size: 12px; opacity: 0.85;">
        基于 DeepSeek · JSON 知识库原型（Vue3 + Vite）
      </div>
    </header>

    <main class="app-main">
      <!-- 左侧：资料上传 + 知识库 -->
      <section>
        <!-- 上传卡片 -->
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">资料上传</div>
              <div class="card-subtitle">支持多种格式，作为课程知识库来源</div>
            </div>
          </div>

          <div class="upload-area">
            <label class="upload-zone">
              <div class="upload-icon">↑</div>
              <div class="upload-text-main">拖拽文件到此区域，或点击选择</div>
              <div class="upload-text-sub">
                支持 PDF、DOCX、PPT、TXT、MP4、MP3 等常见格式
              </div>
              <input
                ref="fileInput"
                type="file"
                multiple
                style="display: none"
                @change="handleFilesSelected"
              />
            </label>
            <button type="button" class="btn btn-primary btn-upload" @click="triggerFileInput">
              选择文件
            </button>
          </div>
        </div>

        <!-- 已上传文件列表 -->
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">已上传文件</div>
              <div class="card-subtitle">
                这些文件将被解析为知识片段供 AI 检索
              </div>
            </div>
            <button class="btn btn-ghost btn-sm" @click="mockLoadDemoFiles">
              载入示例数据
            </button>
          </div>
          <div class="files-list" v-if="materials.length">
            <div class="file-row" v-for="file in materials" :key="file.id">
              <div class="file-name">
                <span class="file-icon" :class="fileIconClass(file.ext)">
                  {{ file.ext.toUpperCase() }}
                </span>
                {{ file.name }}
              </div>
              <div>{{ file.sizeLabel }}</div>
              <div>
                <span class="status-pill" :class="statusClass(file.status)">
                  {{ statusLabel(file.status) }}
                </span>
              </div>
              <div style="text-align: right;">
                <button class="btn btn-ghost btn-sm" @click="removeMaterial(file.id)">
                  删除
                </button>
              </div>
            </div>
          </div>
          <div
            v-else
            style="font-size: 12px; color: #9ca3af; padding: 8px 2px;"
          >
            暂无文件，请先上传或点击“载入示例数据”。
          </div>
        </div>

        <!-- 知识库状态 -->
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">知识库状态</div>
              <div class="card-subtitle">查看目前可用于答疑的知识规模</div>
            </div>
            <div class="tag">JSON 存储</div>
          </div>
          <div class="stats-row">
            <div class="stats-card">
              <div class="stats-label">已上传文件数</div>
              <div class="stats-value">{{ materials.length }}</div>
              <div class="stats-footer">包含 PDF / 文档 / 多媒体等</div>
            </div>
            <div class="stats-card">
              <div class="stats-label">知识条目总数</div>
              <div class="stats-value">{{ knowledgeBase.length }}</div>
              <div class="stats-footer">每条为一段精简课程知识</div>
            </div>
          </div>
          <div class="kb-footer">
            <button class="btn btn-primary btn-sm" @click="rebuildKnowledgeBase">
              构建 / 刷新知识库
            </button>
          </div>
        </div>

        <!-- 知识库管理表 -->
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">知识库管理</div>
              <div class="card-subtitle">
                从上传文件中自动抽取出的课程知识点
              </div>
            </div>
          </div>
          <div style="max-height: 220px; overflow-y: auto;">
            <table class="kb-table" v-if="knowledgeBase.length">
              <thead>
                <tr>
                  <th style="width: 40px;">ID</th>
                  <th>内容摘要</th>
                  <th style="width: 140px;">来源文件</th>
                  <th style="width: 70px;">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in knowledgeBase" :key="item.id">
                  <td>{{ item.id }}</td>
                  <td class="kb-content">{{ item.summary }}</td>
                  <td>{{ item.sourceFile }}</td>
                  <td>
                    <button class="btn btn-ghost btn-sm" @click="removeKbItem(item.id)">
                      删除
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
            <div
              v-else
              style="font-size: 12px; color: #9ca3af; padding: 6px 2px;"
            >
              当前知识库为空。请上传资料后点击“构建 / 刷新知识库”。
            </div>
          </div>
        </div>
      </section>

      <!-- 右侧：学生问答 -->
      <section>
        <div class="card chat-shell">
          <div class="chat-header">
            <div class="chat-title">学生答疑</div>
            <div class="chat-desc">
              你可以直接用自然语言提问，例如：“请解释一下什么是机器学习？”。
            </div>
          </div>

          <div class="chat-history" ref="chatHistory">
            <div
              class="chat-item"
              v-for="msg in messages"
              :key="msg.id"
              :class="msg.role"
            >
              <div
                class="chat-avatar"
                :class="msg.role === 'user' ? 'user' : ''"
              >
                {{ msg.role === 'user' ? '学' : 'AI' }}
              </div>
              <div>
                <div class="chat-bubble">
                  {{ msg.content }}
                </div>
                <div class="chat-meta" v-if="msg.meta">
                  {{ msg.meta }}
                </div>
              </div>
            </div>
          </div>

          <div class="chat-input">
            <div style="flex: 1;">
              <div class="chat-tip">
                当前为演示环境，AI 会基于上方“知识库管理”中的条目进行简单匹配回答。
              </div>
              <textarea
                v-model="question"
                placeholder="请输入你的问题，例如：监督学习和无监督学习有什么区别？"
                @keydown.stop.enter.exact.prevent="handleSend"
              ></textarea>
            </div>
            <button
              class="send-btn"
              @click="handleSend"
              :disabled="sending || !question.trim()"
            >
              <span class="send-icon">➤</span>
              <span>{{ sending ? '思考中…' : '发送' }}</span>
            </button>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';

const API_BASE = 'http://localhost:3001';

const fileInput = ref(null);
const chatHistory = ref(null);

const materials = ref([]);
const knowledgeBase = ref([]);
const messages = ref([
  {
    id: 1,
    role: 'ai',
    content:
      '你好，我是 AI 课程助手。教师可以在左侧上传课程资料并构建知识库，学生在这里提问后，我会尽量基于资料给出解释。',
    meta: '来自系统欢迎语',
  },
]);
const question = ref('');
const sending = ref(false);

const triggerFileInput = () => {
  if (fileInput.value) {
    fileInput.value.click();
  }
};

const fileIconClass = (ext) => {
  ext = (ext || '').toLowerCase();
  if (ext === 'pdf') return 'file-ext-pdf';
  if (ext === 'doc' || ext === 'docx' || ext === 'ppt' || ext === 'pptx')
    return 'file-ext-doc';
  if (ext === 'txt') return 'file-ext-txt';
  if (ext === 'mp4' || ext === 'avi' || ext === 'mov') return 'file-ext-mp4';
  return 'file-ext-other';
};

const statusClass = (status) => {
  if (status === 'done') return 'status-done';
  if (status === 'processing') return 'status-processing';
  if (status === 'pending') return 'status-pending';
  return 'status-error';
};

const statusLabel = (status) => {
  if (status === 'done') return '已构建';
  if (status === 'processing') return '解析中';
  if (status === 'pending') return '待处理';
  return '失败';
};

const sizeToLabel = (size) => {
  if (!size && size !== 0) return '-';
  if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB';
  return (size / (1024 * 1024)).toFixed(1) + ' MB';
};

const refreshStateFromServer = async () => {
  try {
    const res = await fetch(`${API_BASE}/api/state`);
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || '加载状态失败');

    materials.value = (data.materials || []).map((m) => ({
      id: m.id,
      name: m.name,
      ext: m.type || 'other',
      sizeLabel: '-', // 后端目前没存大小
      status: 'done',
    }));
    knowledgeBase.value = data.knowledgeBase || [];
  } catch (e) {
    console.error(e);
  }
};

const arrayBufferToBase64 = (buf) => {
  let binary = '';
  const bytes = new Uint8Array(buf);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
};

// 上传：txt/doc 等按文本传；PDF 按 base64 传给后端解析
const handleFilesSelected = async (e) => {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;

  for (const file of files) {
    const parts = file.name.split('.');
    const ext = (parts.length > 1 ? parts.pop() : '').toLowerCase();

    const tempId = Date.now() + '-' + Math.random().toString(16).slice(2);
    materials.value.push({
      id: tempId,
      name: file.name,
      ext: ext || 'other',
      sizeLabel: sizeToLabel(file.size),
      status: 'processing',
    });

    try {
      const payload = { name: file.name, type: ext || 'other' };

      // 所有文件都先尝试读取纯文本，PDF 额外带上 base64 让后端有能力做更精细解析
      payload.content = await file.text();

      if (ext === 'pdf') {
        const buf = await file.arrayBuffer();
        payload.contentBase64 = arrayBufferToBase64(buf);
      }

      const res = await fetch(`${API_BASE}/api/materials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || '上传失败');

      materials.value = materials.value.map((m) =>
        m.id === tempId ? { ...m, id: data.materialId, status: 'done' } : m,
      );
      await refreshStateFromServer();
    } catch (err) {
      console.error(err);
      materials.value = materials.value.map((m) =>
        m.id === tempId ? { ...m, status: 'error' } : m,
      );
    }
  }

  e.target.value = '';
};

const removeMaterial = (id) => {
  materials.value = materials.value.filter((m) => m.id !== id);
};

const removeKbItem = (id) => {
  knowledgeBase.value = knowledgeBase.value.filter((k) => k.id !== id);
};

// 保留原按钮：现在改为“从后端刷新数据”
const mockLoadDemoFiles = async () => {
  await refreshStateFromServer();
};

const rebuildKnowledgeBase = async () => {
  await refreshStateFromServer();
};

const scrollChatToBottom = () => {
  requestAnimationFrame(() => {
    if (chatHistory.value) {
      chatHistory.value.scrollTop = chatHistory.value.scrollHeight;
    }
  });
};

const handleSend = async () => {
  const q = question.value.trim();
  if (!q || sending.value) return;
  const userMsg = {
    id: Date.now() + '-u',
    role: 'user',
    content: q,
    meta: '学生 · 刚刚',
  };
  messages.value.push(userMsg);
  question.value = '';
  scrollChatToBottom();

  sending.value = true;

  try {
    const res = await fetch(`${API_BASE}/api/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: q }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || '提问失败');

    messages.value.push({
      id: Date.now() + '-a',
      role: 'ai',
      content: data.answer || '后端没有返回答案。',
      meta: 'AI · 基于上传资料',
    });
  } catch (e) {
    console.error(e);
    messages.value.push({
      id: Date.now() + '-a',
      role: 'ai',
      content: '调用后端失败，请检查后端是否在 http://localhost:3001 运行。',
      meta: '系统错误',
    });
  } finally {
    sending.value = false;
    scrollChatToBottom();
  }
};

onMounted(() => {
  scrollChatToBottom();
  refreshStateFromServer();
});
</script>

<style>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}
body {
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei',
    sans-serif;
  background-color: #f5f6f8;
  color: #333;
}
.app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
.app-header {
  height: 56px;
  padding: 0 24px;
  background: #0b61ff;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}
.app-header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}
.app-header-badge {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.16);
}
.app-main {
  flex: 1;
  padding: 24px;
  display: grid;
  grid-template-columns: 2.1fr 2.4fr;
  gap: 24px;
}
.card {
  background: #fff;
  border-radius: 8px;
  padding: 16px 18px;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);
  margin-bottom: 16px;
}
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.card-title {
  font-size: 15px;
  font-weight: 600;
}
.card-subtitle {
  font-size: 12px;
  color: #999;
  margin-top: 2px;
}
.upload-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}
.upload-zone {
  width: 100%;
  border: 1px dashed #cbd5f5;
  background: #f7f9ff;
  border-radius: 8px;
  padding: 32px 16px;
  text-align: center;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
  box-sizing: border-box;
}
.upload-zone:hover {
  border-color: #0b61ff;
  background: #eef3ff;
}
.upload-icon {
  width: 42px;
  height: 42px;
  border-radius: 999px;
  border: 1px solid #d0defe;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 8px;
  color: #0b61ff;
  font-size: 24px;
}
.upload-text-main {
  font-size: 14px;
  margin-bottom: 4px;
}
.upload-text-sub {
  font-size: 12px;
  color: #888;
}
.btn-upload {
  min-width: 120px;
  padding: 8px 20px;
  font-size: 14px;
}
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 14px;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  border: none;
  outline: none;
  transition: all 0.16s;
  white-space: nowrap;
}
.btn-primary {
  background: #0b61ff;
  color: #fff;
}
.btn-primary:hover {
  background: #0a55df;
}
.btn-ghost {
  background: transparent;
  color: #0b61ff;
}
.btn-ghost:hover {
  background: rgba(11, 97, 255, 0.06);
}
.btn-sm {
  padding: 4px 10px;
  font-size: 12px;
}
.files-list {
  max-height: 220px;
  overflow-y: auto;
  border-top: 1px solid #f0f0f0;
  margin-top: 8px;
  padding-top: 4px;
}
.file-row {
  display: grid;
  grid-template-columns: minmax(0, 1.8fr) 0.9fr 0.9fr auto;
  align-items: center;
  padding: 7px 4px;
  font-size: 12px;
  border-radius: 4px;
  column-gap: 8px;
}
.file-row:nth-child(odd) {
  background: #fafafa;
}
.file-icon {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: #fff;
  margin-right: 6px;
}
.file-ext-pdf {
  background: #f97373;
}
.file-ext-doc {
  background: #2b7fff;
}
.file-ext-txt {
  background: #10b981;
}
.file-ext-mp4 {
  background: #f59e0b;
}
.file-ext-other {
  background: #6b7280;
}
.file-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.status-pill {
  display: inline-flex;
  align-items: center;
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 11px;
  border: 1px solid transparent;
}
.status-done {
  color: #16a34a;
  border-color: rgba(22, 163, 74, 0.4);
  background: rgba(22, 163, 74, 0.04);
}
.status-processing {
  color: #2563eb;
  border-color: rgba(37, 99, 235, 0.45);
  background: rgba(37, 99, 235, 0.04);
}
.status-pending {
  color: #ca8a04;
  border-color: rgba(202, 138, 4, 0.45);
  background: rgba(202, 138, 4, 0.04);
}
.status-error {
  color: #dc2626;
  border-color: rgba(220, 38, 38, 0.45);
  background: rgba(220, 38, 38, 0.04);
}
.stats-row {
  display: flex;
  gap: 12px;
  margin-top: 4px;
}
.stats-card {
  flex: 1;
  background: #f8fafc;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 12px;
}
.stats-label {
  color: #6b7280;
  margin-bottom: 4px;
}
.stats-value {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}
.stats-footer {
  margin-top: 6px;
  font-size: 11px;
  color: #9ca3af;
}
.kb-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}
.kb-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  margin-top: 6px;
}
.kb-table thead {
  background: #f3f4f6;
}
.kb-table th,
.kb-table td {
  padding: 6px 8px;
  text-align: left;
}
.kb-table tbody tr:nth-child(odd) {
  background: #fafafa;
}
.kb-content {
  max-width: 360px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #4b5563;
}
.tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  border-radius: 999px;
  background: #eff6ff;
  color: #1d4ed8;
  font-size: 11px;
}

/* 右侧聊天区 */
.chat-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.chat-header {
  padding-bottom: 8px;
  border-bottom: 1px solid #e5e7eb;
  margin-bottom: 8px;
}
.chat-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 4px;
}
.chat-desc {
  font-size: 12px;
  color: #6b7280;
}
.chat-history {
  flex: 1;
  overflow-y: auto;
  padding: 4px 2px 8px;
}
.chat-item {
  margin-bottom: 10px;
  display: flex;
}
.chat-item.ai {
  flex-direction: row;
  justify-content: flex-start;
}
.chat-item.user {
  flex-direction: row-reverse;
  justify-content: flex-end;
}
.chat-avatar {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: #e5edff;
  color: #0b61ff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  margin: 0 6px;
  flex-shrink: 0;
}
.chat-avatar.user {
  background: #0b61ff;
  color: #fff;
}
.chat-bubble {
  max-width: 78%;
  padding: 8px 10px;
  border-radius: 10px;
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
}
.chat-item.ai .chat-bubble {
  background: #f3f4ff;
  border-bottom-left-radius: 2px;
}
.chat-item.user .chat-bubble {
  background: #0b61ff;
  color: #fff;
  border-bottom-right-radius: 2px;
}
.chat-meta {
  font-size: 11px;
  color: #9ca3af;
  margin-top: 2px;
}
.chat-input {
  border-top: 1px solid #e5e7eb;
  padding-top: 8px;
  margin-top: 4px;
  display: flex;
  gap: 8px;
  align-items: flex-end;
}
.chat-input textarea {
  flex: 1;
  min-height: 60px;
  max-height: 120px;
  resize: vertical;
  padding: 8px;
  font-size: 13px;
  border-radius: 6px;
  border: 1px solid #d1d5db;
  outline: none;
  transition: border-color 0.16s, box-shadow 0.16s;
}
.chat-input textarea:focus {
  border-color: #0b61ff;
  box-shadow: 0 0 0 1px rgba(11, 97, 255, 0.18);
}
.send-btn {
  width: 72px;
  height: 34px;
  border-radius: 999px;
  border: none;
  background: #0b61ff;
  color: #fff;
  cursor: pointer;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  flex-shrink: 0;
}
.send-btn[disabled] {
  background: #9ca3af;
  cursor: not-allowed;
}
.send-icon {
  font-size: 12px;
}
.chat-tip {
  font-size: 11px;
  color: #9ca3af;
  margin-bottom: 4px;
}

@media (max-width: 960px) {
  .app-main {
    grid-template-columns: 1fr;
  }
}
</style>
