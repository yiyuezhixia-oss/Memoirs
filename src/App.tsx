import { useEffect, useMemo, useRef, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { BookOpen, Camera, ChevronLeft, ChevronRight, FileText, ImagePlus, Info, MessageCircle, Plus, Save, Send, Settings, Sparkles, WandSparkles } from 'lucide-react';
import aiOrganizeEntry from './assets/replica/ai-organize-entry.png';
import articleEntry from './assets/replica/entry-article.png';
import articlePaper from './assets/replica/article-paper.png';
import comicEntry from './assets/replica/entry-comic.png';
import comicResult from './assets/replica/comic-result.png';
import diaryEntry from './assets/replica/entry-diary.png';
import diaryResult from './assets/replica/diary-result.png';
import generateBanner from './assets/replica/generate-banner.png';
import heroFamily from './assets/replica/hero-family.png';
import mineProfile from './assets/replica/mine-profile.png';
import thumbBike from './assets/replica/thumb-bike.png';
import thumbGraduation from './assets/replica/thumb-graduation.png';
import thumbThanks from './assets/replica/thumb-thanks.png';
import { useAppStore } from './appStore';
import AdminPage from './Admin';
import { chatWithRole, loadApiConfig, prepareGeneration, prepareMemory, runGeneration } from './services/api';
import type { ArticleStyle, ChatMessage, DatePrecision, GenerationTask, GenerationType, TimelineEntry } from './types';
import { articleStyles } from './types';

type AppTab = 'timeline' | 'generate' | 'mine';

const typeLabels: Record<GenerationType, string> = { article: '文章', comic: '漫画', 'diary-card': '日记卡' };
const typeEntryImages: Record<GenerationType, string> = { article: articleEntry, comic: comicEntry, 'diary-card': diaryEntry };
const typeResultImages: Record<GenerationType, string> = { article: articlePaper, comic: comicResult, 'diary-card': diaryResult };

function imageForEntry(entry: TimelineEntry) {
  if (entry.imageDataUrls && entry.imageDataUrls[0]) return entry.imageDataUrls[0];
  if (entry.title.includes('毕业')) return thumbGraduation;
  if (entry.title.includes('自行车') || entry.title.includes('泡泡')) return thumbBike;
  if (entry.title.includes('谢谢')) return thumbThanks;
  return heroFamily;
}

async function compressImage(file: File, maxWidth = 900, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const ratio = Math.min(1, maxWidth / Math.max(image.width, image.height));
        const width = Math.round(image.width * ratio);
        const height = Math.round(image.height * ratio);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) { resolve(String(reader.result)); return; }
        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      image.onerror = reject;
      image.src = String(reader.result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatDate(date: string) {
  if (!date) return '时间待补';
  const parts = date.split('-');
  if (parts.length === 1) return `${parts[0]}年`;
  if (parts.length === 2) return `${parts[0]}年${Number(parts[1])}月`;
  return `${parts[0]}年${Number(parts[1])}月${Number(parts[2])}日`;
}

function Shell({ children, active, title, back, right, noNav = false }: { children: React.ReactNode; active: AppTab; title?: string; back?: boolean; right?: React.ReactNode; noNav?: boolean }) {
  const navigate = useNavigate();
  return <main className="app-shell">
    {(title || back) && <header className="topbar">
      {back ? <button className="icon-button" onClick={() => navigate(-1)} aria-label="返回"><ChevronLeft /></button> : <div />}
      <h1>{title}</h1>
      <div className="topbar-right">{right}</div>
    </header>}
    <div className={`page-content ${noNav ? 'no-nav' : ''}`}>{children}</div>
    {!noNav && <BottomNav active={active} />}
  </main>;
}

function BottomNav({ active }: { active: AppTab }) {
  const navigate = useNavigate();
  return <nav className="bottom-nav">
    <button className={active === 'timeline' ? 'active' : ''} onClick={() => navigate('/')}><BookOpen /><span>时间轴</span></button>
    <button className={`generate-nav ${active === 'generate' ? 'active' : ''}`} onClick={() => navigate('/generate')}><WandSparkles /><span>生成</span></button>
    <button className={active === 'mine' ? 'active' : ''} onClick={() => navigate('/mine')}><span className="user-icon" /><span>我的</span></button>
  </nav>;
}

function PrimaryButton({ children, onClick, disabled = false, secondary = false, type = 'button' }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; secondary?: boolean; type?: 'button' | 'submit' | 'reset' }) {
  return <button type={type} className={`primary bottom-action ${secondary ? 'secondary' : ''}`} onClick={onClick} disabled={disabled}>{children}</button>;
}

function FileComposer({ value, onChange, onSend, onImage, placeholder }: { value: string; onChange: (value: string) => void; onSend: () => void; onImage?: (files: FileList | null) => void; placeholder: string }) {
  return <div className="composer">
    <label className="composer-image" aria-label="添加图片"><ImagePlus /><input type="file" accept="image/*" multiple onChange={(event) => onImage?.(event.target.files)} /></label>
    <input value={value} onChange={(event) => onChange(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && onSend()} placeholder={placeholder} />
    <button className="send" onClick={onSend} aria-label="发送"><Send /></button>
  </div>;
}

function cleanDisplayText(text: string) {
  return text
    .replace(/^\s*---+\s*$/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/^[\-*+]\s+/gm, '')
    .replace(/^\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function ChatMessages({ messages, loading = false }: { messages: ChatMessage[]; loading?: boolean }) {
  return <section className="chat-area">{messages.map((message) => <div key={message.id} className={`chat-row ${message.role}`}>
    <div className="avatar"><span className={message.role === 'assistant' ? 'spirit-mark' : 'mom-avatar'}>{message.role === 'assistant' ? '书' : ''}</span></div>
    <div className="bubble"><p>{cleanDisplayText(message.content)}</p>{message.imageDataUrls.length > 0 && <div className="chat-images">{message.imageDataUrls.map((image) => <img key={image} src={image} alt="用户上传的回忆" />)}</div>}<small>{new Date(message.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</small></div>
  </div>)}{loading && <div className="chat-row assistant"><div className="avatar"><span className="spirit-mark">书</span></div><div className="bubble typing"><span /><span /><span /></div></div>}</section>;
}

function TimelinePage() {
  const { state } = useAppStore();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<TimelineEntry | null>(null);
  const [detail, setDetail] = useState<TimelineEntry | null>(null);
  const entries = useMemo(() => [...state.timelineEntries].sort((a, b) => b.startDate.localeCompare(a.startDate)), [state.timelineEntries]);
  return <Shell active="timeline"><div className="timeline-heading"><div><h1>时光书 <BookOpen size={19} /></h1><p>把今天留给以后</p></div><button className="outline-pill" onClick={() => navigate('/memory-chat')}><Sparkles /> AI整理</button></div>
    <section className="profile-banner"><img src={heroFamily} alt="亲子记录插画" /><div className="profile-copy"><h2>{state.childProfile.name}的时光书</h2><p>{state.childProfile.tagline}</p><strong>已记录 <em>{entries.length}</em> 段回忆</strong></div></section>
    <div className="section-line"><span>✿ 时间轴 <small>共 {entries.length} 段回忆</small></span><button>全部 ›</button></div>
    <div className="timeline-list">{entries.map((entry) => <TimelineCard key={entry.id} entry={entry} onGenerate={setSelected} onOpen={setDetail} />)}</div>
    <button className="fab" onClick={() => navigate('/entry/new')} aria-label="新增回忆"><Plus /></button>
    {selected && <TypeSelector entry={selected} onClose={() => setSelected(null)} />}
    {detail && <EntryDetailView entry={detail} onClose={() => setDetail(null)} onGenerate={(entry) => { setDetail(null); setSelected(entry); }} />}
  </Shell>;
}

function TimelineCard({ entry, onGenerate, onOpen }: { entry: TimelineEntry; onGenerate: (entry: TimelineEntry) => void; onOpen: (entry: TimelineEntry) => void }) {
  return <article className="timeline-card" onClick={() => onOpen(entry)}><div className="date-bookmark">{formatDate(entry.startDate)}</div><div className="card-thumb"><img src={imageForEntry(entry)} alt="回忆缩略图" />{entry.imageDataUrls.length > 1 && <span className="thumb-badge">+{entry.imageDataUrls.length}</span>}</div><div className="entry-detail"><div className="entry-title-row"><h2>{entry.title}</h2><span>♡</span></div><p>{entry.content}</p><small>{entry.source === 'ai-organized' ? '✦ AI整理' : '▣ 手动记录'}</small><div className="card-actions"><span>♡　⋯</span><button onClick={(event) => { event.stopPropagation(); onGenerate(entry); }}>☆ 用于生成</button></div></div></article>;
}

function EntryDetailView({ entry, onClose, onGenerate }: { entry: TimelineEntry; onClose: () => void; onGenerate: (entry: TimelineEntry) => void }) {
  const { updateTimelineEntry } = useAppStore();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title: entry.title, content: entry.content, tags: [...entry.tags], imageDataUrls: [...entry.imageDataUrls] });
  const [tagInput, setTagInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const images = draft.imageDataUrls.length ? draft.imageDataUrls : [imageForEntry(entry)];
  const galleryRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(1);
  const showArrows = images.length > 1;
  const scrollToPage = (nextPage: number) => {
    const el = galleryRef.current;
    if (!el || !showArrows) return;
    const clamped = Math.max(1, Math.min(nextPage, images.length));
    el.scrollTo({ left: el.clientWidth * (clamped - 1), behavior: 'smooth' });
    setPage(clamped);
  };
  useEffect(() => {
    const el = galleryRef.current;
    if (!el || !showArrows) return;
    const onScroll = () => {
      const next = Math.round(el.scrollLeft / el.clientWidth) + 1;
      setPage(Math.max(1, Math.min(next, images.length)));
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [images.length, showArrows]);
  const addTag = () => {
    const value = tagInput.trim().replace(/^#/, '');
    if (!value || draft.tags.includes(value)) return;
    setDraft((current) => ({ ...current, tags: [...current.tags, value] }));
    setTagInput('');
  };
  const removeTag = (index: number) => setDraft((current) => ({ ...current, tags: current.tags.filter((_, i) => i !== index) }));
  const addImages = async (files: FileList | null) => {
    if (!files || !files.length) return;
    const list = Array.from(files).slice(0, 9 - draft.imageDataUrls.length);
    if (!list.length) return;
    setUploading(true);
    const compressed = await Promise.all(list.map((file) => compressImage(file)));
    setUploading(false);
    setDraft((current) => ({ ...current, imageDataUrls: [...current.imageDataUrls, ...compressed].slice(0, 9) }));
  };
  const removeImage = (index: number) => setDraft((current) => ({ ...current, imageDataUrls: current.imageDataUrls.filter((_, i) => i !== index) }));
  const save = () => {
    updateTimelineEntry(entry.id, {
      title: draft.title.trim() || entry.title,
      content: draft.content,
      tags: draft.tags,
      imageDataUrls: draft.imageDataUrls,
    });
    setEditing(false);
  };
  const cancel = () => {
    setDraft({ title: entry.title, content: entry.content, tags: [...entry.tags], imageDataUrls: [...entry.imageDataUrls] });
    setEditing(false);
    setTagInput('');
  };
  return <div className="modal-backdrop" onClick={onClose}><div className="entry-detail-view" onClick={(event) => event.stopPropagation()}><button className="detail-close" onClick={onClose} aria-label="关闭">×</button><div className="detail-hero">{showArrows ? <div ref={galleryRef} className="detail-gallery">{images.map((image) => <img key={image} src={image} alt="回忆图片" />)}</div> : <img src={images[0]} alt="回忆图片" />}{showArrows && <><button className="detail-arrow detail-arrow-left" aria-label="上一张" onClick={(event) => { event.stopPropagation(); scrollToPage(page - 1); }}><ChevronLeft size={22} /></button><button className="detail-arrow detail-arrow-right" aria-label="下一张" onClick={(event) => { event.stopPropagation(); scrollToPage(page + 1); }}><ChevronRight size={22} /></button></>}{showArrows && <span className="detail-count">{page}/{images.length}</span>}<div className="detail-date">{formatDate(entry.startDate)}</div></div><div className="detail-body">{editing ? <><input className="detail-input detail-title-input" value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="标题" /><textarea className="detail-input detail-content-input" value={draft.content} onChange={(event) => setDraft((current) => ({ ...current, content: event.target.value }))} placeholder="写下这段回忆..." rows={6} /><div className="detail-tags-edit">{draft.tags.map((tag, index) => <span key={`${tag}-${index}`} className="tag-chip editable"><small>#{tag}</small><button onClick={() => removeTag(index)} aria-label="删除标签">×</button></span>)}<div className="tag-add-row"><input value={tagInput} onChange={(event) => setTagInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addTag(); } }} placeholder={draft.tags.length ? '添加标签' : '输入标签后回车'} /><button onClick={addTag} disabled={!tagInput.trim()}>添加</button></div></div><div className="detail-images-edit"><p>图片（{draft.imageDataUrls.length}/9）</p><div className="edit-thumb-row">{draft.imageDataUrls.map((url, index) => <div key={`${url}-${index}`} className="edit-thumb"><img src={url} alt="" /><button onClick={() => removeImage(index)} aria-label="删除图片">×</button></div>)}{draft.imageDataUrls.length < 9 && <label className="edit-thumb add-thumb">{uploading ? <span className="uploading-dot" /> : <><ImagePlus size={18} /><input type="file" accept="image/*" multiple onChange={(event) => addImages(event.target.files)} /></>}</label>}</div></div></> : <><h2>{entry.title}</h2><p className="detail-content">{entry.content}</p><div className="detail-meta">{entry.tags.map((tag) => <span key={tag} className="tag-chip">#{tag}</span>)}</div></>}</div><div className="detail-actions">{editing ? <><button className="ghost-button" onClick={cancel}>取消</button><button className="primary-button" onClick={save}>保存</button></> : <><button className="ghost-button" onClick={onClose}>关闭</button><button className="primary-button" onClick={() => onGenerate(entry)}>☆ 用于生成</button><button className="secondary-button" onClick={() => setEditing(true)}>编辑</button></>}</div></div></div>;
}

function TypeSelector({ entry, onClose }: { entry: TimelineEntry; onClose: () => void }) {
  const navigate = useNavigate();
  return <div className="modal-backdrop" onClick={onClose}><div className="type-sheet" onClick={(event) => event.stopPropagation()}><div className="sheet-handle" /><h2>把这段回忆变成什么？</h2><p>素材会带入创作工作台，还可以继续聊天补充。</p>{(['article', 'comic', 'diary-card'] as GenerationType[]).map((type) => <button key={type} onClick={() => navigate(`/generate/${type}?sourceEntryId=${entry.id}`)}><img src={typeEntryImages[type]} alt="" /><span><b>生成{typeLabels[type]}</b><small>{type === 'article' ? '写成温柔家书' : type === 'comic' ? '变成亲子氛围漫画' : '留下一张分享卡片'}</small></span><i>›</i></button>)}</div></div>;
}

function NewEntryPage() {
  const navigate = useNavigate();
  const { addTimelineEntry } = useAppStore();
  const [precision, setPrecision] = useState<DatePrecision>('day');
  const [date, setDate] = useState('2026-08-05');
  const [endDate, setEndDate] = useState('2026-08-06');
  const [content, setContent] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [tag, setTag] = useState('日常');
  const [uploading, setUploading] = useState(false);
  const acceptImages = async (files: FileList | null) => {
    if (!files || uploading) return;
    const room = 9 - images.length;
    if (room <= 0) return;
    setUploading(true);
    try {
      const next = await Promise.all([...files].slice(0, room).map((file) => compressImage(file)));
      setImages((current) => [...current, ...next]);
    } finally {
      setUploading(false);
    }
  };
  const removeImage = (target: string) => setImages((current) => current.filter((image) => image !== target));
  const save = () => { if (!content.trim() && images.length === 0) return; addTimelineEntry({ datePrecision: precision, startDate: date, endDate: precision === 'range' ? endDate : undefined, title: content.trim().slice(0, 14) || '一张珍贵的照片', content: content.trim() || '把这一刻好好留在时光书里。', imageDataUrls: images, tags: [tag], source: 'manual' }); navigate('/'); };
  return <Shell active="timeline" title="新增回忆" back><div className="hint-card"><span className="spirit-mark">书</span><div><b>记不清具体日期也没关系，</b><br />先把这一刻留下来。</div></div><section className="form-section"><h3>✿ 日期精度</h3><div className="segmented">{(['year', 'month', 'day', 'range'] as DatePrecision[]).map((item) => <button key={item} className={precision === item ? 'selected' : ''} onClick={() => setPrecision(item)}>{({ year: '年', month: '年月', day: '日期', range: '区间' })[item]}</button>)}</div><div className="date-input"><input aria-label="开始日期" type={precision === 'year' ? 'number' : precision === 'month' ? 'month' : 'date'} value={date} onChange={(event) => setDate(event.target.value)} />{precision === 'range' && <><span>至</span><input aria-label="结束日期" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></>}</div></section><section className="form-section"><h3>✿ 照片（最多 9 张）</h3><label className="upload-zone"><Camera /><span>{uploading ? '处理中…' : images.length ? `继续添加（已选 ${images.length} 张）` : '点击上传照片'}</span><input type="file" accept="image/*" multiple disabled={uploading} onChange={(event) => { acceptImages(event.target.files); event.target.value = ''; }} /></label>{images.length > 0 && <div className="thumb-row">{images.map((image) => <div key={image} className="thumb"><img src={image} alt="已上传照片" /><button type="button" className="thumb-remove" onClick={() => removeImage(image)} aria-label="移除">×</button></div>)}</div>}</section><section className="form-section"><h3>✿ 这段回忆</h3><textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="写下当时发生了什么，或者你现在想对孩子说的话..." maxLength={300} /><span className="counter">{content.length}/300</span></section><section className="form-section"><h3>✿ 场景标签</h3><div className="chips">{['日常', '生日', '毕业', '旅行', '第一次'].map((item) => <button key={item} className={tag === item ? 'selected' : ''} onClick={() => setTag(item)}>{item}</button>)}</div></section><PrimaryButton disabled={!content.trim() && images.length === 0} onClick={save}><Save /> 保存到时间轴</PrimaryButton></Shell>;
}

function MemoryChatPage() {
  const navigate = useNavigate();
  const store = useAppStore();
  const [sessionId, setSessionId] = useState<string>();
  const [input, setInput] = useState('');
  const [draftOpen, setDraftOpen] = useState(false);
  const [draft, setDraft] = useState<{ datePrecision: DatePrecision; startDate: string; title: string; content: string; imageDataUrls: string[] }>();
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [chatError, setChatError] = useState('');
  useEffect(() => { setSessionId(store.getOrCreateSession('memory').id); }, [store]);
  const session = store.state.chatSessions.find((item) => item.id === sessionId);
  const pendingCount = session?.messages.filter((message) => message.role === 'user' && message.processStatus === 'pending').length || 0;
  const send = async () => { if (!sessionId || !input.trim() || busy) return; setBusy(true); setChatError(''); const content = input.trim(); const outgoing = { role: 'user' as const, content, imageDataUrls: images }; const messages = [...(session?.messages || []), { id: 'local', ...outgoing, createdAt: new Date().toISOString(), processStatus: 'pending' as const }]; store.addMessage(sessionId, outgoing); setInput(''); setImages([]); try { const role = store.roles.find((item) => item.id === 'memory-organizer')!; const response = await chatWithRole(role, messages.map(({ role: messageRole, content: messageContent, imageDataUrls }) => ({ role: messageRole, content: messageContent, imageDataUrls }))); store.appendAssistant(sessionId, response.text); } catch (error) { setChatError(error instanceof Error ? error.message : '对话接口调用失败'); } finally { setBusy(false); } };
  const prepareDraft = async () => { if (!session || pendingCount === 0 || busy) return; setBusy(true); setChatError(''); try { const role = store.roles.find((item) => item.id === 'memory-organizer')!; const result = await prepareMemory(session.messages.map(({ role: messageRole, content }) => ({ role: messageRole, content })), session.messages.flatMap((message) => message.imageDataUrls), role); setDraft(result.draft); } catch (error) { setChatError(error instanceof Error ? error.message : '整理接口调用失败'); } finally { setDraftOpen(true); setBusy(false); } };
  const confirmDraft = () => { if (!sessionId || !draft) return; store.organizeSession(sessionId, { ...draft, tags: ['AI整理'], source: 'ai-organized' }); setDraftOpen(false); navigate('/'); };
  return <Shell active="generate" title="AI整理回忆" back right={<span className="status-pill">仅本次整理</span>}><ApiModeHint /><div className="chat-intro"><span className="spirit-mark">书</span><div><b>慢慢说，我会帮你<br />整理成一页时光书。</b><small>可以发照片，也可以先讲故事。</small></div></div><ChatMessages messages={session?.messages || []} loading={busy} />{chatError && <div className="chat-error">{chatError}<button onClick={() => setChatError('')}>知道了</button></div>}<FileComposer value={input} onChange={setInput} onSend={send} onImage={(files) => { if (!files) return; [...files].slice(0, 3).forEach((file) => { const reader = new FileReader(); reader.onload = () => setImages((current) => [...current, String(reader.result)]); reader.readAsDataURL(file); }); }} placeholder={busy ? '正在连接对话助手…' : '慢慢说，细节越小越珍贵...'} /><PrimaryButton disabled={pendingCount === 0 || busy} onClick={prepareDraft}><WandSparkles /> {busy ? '正在思考...' : `整理 ${pendingCount} 条新回答`}</PrimaryButton>{draftOpen && draft && <DraftSheet draft={draft} onChange={setDraft} onClose={() => setDraftOpen(false)} onConfirm={confirmDraft} />}</Shell>;
}

function DraftSheet({ draft, onChange, onClose, onConfirm }: { draft: { datePrecision: DatePrecision; startDate: string; title: string; content: string; imageDataUrls: string[] }; onChange: (draft: { datePrecision: DatePrecision; startDate: string; title: string; content: string; imageDataUrls: string[] }) => void; onClose: () => void; onConfirm: () => void }) {
  return <div className="modal-backdrop"><section className="draft-sheet"><div className="sheet-handle" /><h2>整理好了，看看像不像这段回忆</h2><p>日期和文字都可以修改</p><label><span>日期</span><input type="month" value={draft.startDate.slice(0, 7)} onChange={(event) => onChange({ ...draft, startDate: event.target.value })} /></label><label><span>标题</span><input value={draft.title} onChange={(event) => onChange({ ...draft, title: event.target.value })} /></label><label><span>正文</span><textarea value={draft.content} onChange={(event) => onChange({ ...draft, content: event.target.value })} /></label>{draft.imageDataUrls.length > 0 && <div className="thumb-row">{draft.imageDataUrls.map((image) => <img key={image} src={image} alt="回忆照片" />)}</div>}<div className="split-actions"><button onClick={onClose}>返回修改</button><button className="primary" onClick={onConfirm}>写入时间轴</button></div></section></div>;
}

function GenerateHomePage() {
  const navigate = useNavigate();
  const { state } = useAppStore();
  const recent = state.generationTasks.slice(0, 2);
  return <Shell active="generate" title="生成" right={<button className="info-button"><Info /> 作品说明</button>}><button className="generate-hero"><img src={generateBanner} alt="把一段回忆变成一件作品" /></button><button className="memory-entry" onClick={() => navigate('/memory-chat')}><img src={aiOrganizeEntry} alt="AI整理回忆" /></button><div className="create-title">✿ 把回忆变成作品 ✦</div><div className="generation-cards">{(['article', 'comic', 'diary-card'] as GenerationType[]).map((type) => <button key={type} onClick={() => navigate(`/generate/${type}`)}><img src={typeEntryImages[type]} alt={`生成${typeLabels[type]}`} /><span>›</span></button>)}</div><div className="recent-heading"><b>✿ 最近创作</b><button>查看全部 ›</button></div><div className="recent-list">{recent.length ? recent.map((task) => <div key={task.id}><img src={typeResultImages[task.type]} alt="作品缩略图" /><span><b>{task.result?.title || '未完成的创作'}</b><small>{task.status === 'saved' ? '已保存' : '继续创作'}</small></span><button onClick={() => navigate(`/generate/${task.type}?taskId=${task.id}`)}>继续创作</button></div>) : <p>新的创作会保存在这里</p>}</div></Shell>;
}

const prompts: Record<GenerationType, string[]> = {
  article: ['这篇文章想写给孩子本人，还是给家人一起看？', '你最想让他记住哪一句，或者最想表达的一个感受是什么？', '文风想更像温柔家书，还是故事散文？还有没有特别想保留的细节？'],
  comic: ['这段回忆里，你最想变成漫画的是哪一幕？', '画面里的人物是什么动作和表情？希望整体是什么情绪？', '有没有想保留的对白、场景细节或分镜数量？'],
  'diary-card': ['这张卡片最想保留哪一句话？', '标题想温柔一点，还是纪念感强一点？', '主图之外，还有天气、地点或当时的心情想写进卡片吗？'],
};

function ApiModeHint() {
  const { mode } = loadApiConfig();
  const text = mode === 'mock' ? '当前：本地 Mock（未连接真实大模型）' : mode === 'llm' ? '当前：直连大模型（AI整理已真实调用）' : '当前：Coze 工作流（生成已真实调用）';
  return <div className={`api-mode-hint mode-${mode}`}>{text} · 配置已内置，无需手动切换</div>;
}

function StyleSelector({ value, onChange, disabled }: { value: ArticleStyle; onChange: (style: ArticleStyle) => void; disabled?: boolean }) {
  return <div className="style-selector"><span className="style-label">选择文风</span><div className="style-options">{articleStyles.map((item) => <button key={item} type="button" className={value === item ? 'active' : ''} disabled={disabled} onClick={() => onChange(item)}>{item}</button>)}</div></div>;
}

function GenerationWorkspacePage() {
  const { type = 'article' } = useParams<{ type: GenerationType }>();
  const generationType = (type in typeLabels ? type : 'article') as GenerationType;
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const store = useAppStore();
  const sourceEntryId = search.get('sourceEntryId') || undefined;
  const taskId = search.get('taskId');
  const [sessionId, setSessionId] = useState<string>();
  const [taskIdState, setTaskIdState] = useState<string | undefined>(taskId || undefined);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [chatError, setChatError] = useState('');
  const [style, setStyle] = useState<ArticleStyle>('通用');
  useEffect(() => {
    if (taskId) {
      const existing = store.state.generationTasks.find((item) => item.id === taskId);
      if (existing) {
        setTaskIdState(existing.id);
        setSessionId(existing.chatSessionId);
        if (existing.style) setStyle(existing.style);
        return;
      }
    }
    setSessionId(store.createSession(generationType, sourceEntryId).id);
  }, [store, generationType, sourceEntryId, taskId]);
  useEffect(() => {
    if (!sessionId || taskIdState) return;
    const newTask = store.createTask(generationType, sessionId, sourceEntryId, generationType === 'article' ? style : undefined);
    setTaskIdState(newTask.id);
    if (!taskId) {
      const params = new URLSearchParams();
      params.set('taskId', newTask.id);
      if (sourceEntryId) params.set('sourceEntryId', sourceEntryId);
      navigate(`/generate/${generationType}?${params.toString()}`, { replace: true });
    }
  }, [store, generationType, sessionId, sourceEntryId, taskIdState, taskId, navigate, style]);
  const task = store.state.generationTasks.find((item) => item.id === (taskIdState || taskId));
  const session = store.state.chatSessions.find((item) => item.id === (task?.chatSessionId || sessionId));
  const source = store.state.timelineEntries.find((entry) => entry.id === (task?.sourceEntryId || sourceEntryId));
  const preview = task?.status === 'completed' || task?.status === 'saved';
  const send = async () => { if (!session?.id || !input.trim() || busy) return; setBusy(true); setChatError(''); const content = input.trim(); const outgoing = { role: 'user' as const, content, imageDataUrls: [] as string[] }; const messages = [...session.messages, { id: 'local', ...outgoing, createdAt: new Date().toISOString(), processStatus: 'pending' as const }]; store.addMessage(session.id, outgoing); setInput(''); try { const roleId = generationType === 'article' ? 'article-writer' : generationType === 'comic' ? 'comic-director' : 'diary-card-designer'; const role = store.roles.find((item) => item.id === roleId)!; const response = await chatWithRole(role, messages.map(({ role: messageRole, content: messageContent, imageDataUrls }) => ({ role: messageRole, content: messageContent, imageDataUrls }))); store.appendAssistant(session.id, response.text); } catch (error) { setChatError(error instanceof Error ? error.message : '对话接口调用失败'); } finally { setBusy(false); } };
  const generate = async () => { if (!task || !session || busy) return; setBusy(true); setChatError(''); store.updateTask(task.id, { status: 'generating', style }); try { const roleId = generationType === 'article' ? 'article-writer' : generationType === 'comic' ? 'comic-director' : 'diary-card-designer'; const role = store.roles.find((item) => item.id === roleId)!; const prepared = await prepareGeneration(generationType, session.messages.map(({ role: messageRole, content }) => ({ role: messageRole, content })), source?.content || '', session.messages.flatMap((message) => message.imageDataUrls), role, undefined, generationType === 'article' ? style : undefined); const completed = await runGeneration(generationType, prepared); store.updateTask(task.id, { status: 'completed', result: completed.result }); } catch (error) { store.updateTask(task.id, { status: 'failed', errorMessage: error instanceof Error ? error.message : String(error) }); setChatError(error instanceof Error ? error.message : '生成接口调用失败'); } finally { setBusy(false); } };
  const regenerate = () => { if (task) store.updateTask(task.id, { status: 'draft' }); };
  const save = () => { if (task) store.saveTask(task.id); };
  return <Shell active="generate" title={`生成${typeLabels[generationType]}`} back right={<span className="status-pill">创作中</span>}><ApiModeHint /><div className="stepper"><span className={!preview ? 'active' : ''}>1 聊聊想法</span><i>→</i><span className={preview ? 'active' : ''}>2 {generationType === 'article' ? '查看文章' : typeLabels[generationType]}</span><i>→</i><span>3 保存作品</span></div><SourceCard entry={source} variant={generationType === 'article' ? 'article' : 'default'} />{task?.status === 'generating' ? <div className="loading-card"><Sparkles size={48} /><h2>正在把这段回忆变成{typeLabels[generationType]}</h2><p>正在整理你的想法，请稍等一下。</p><div className="loading-bar"><i /></div></div> : preview && task ? <GenerationPreview task={task} source={source} onRegenerate={regenerate} onSave={save} /> : <><div className="workspace-chat"><ChatMessages messages={session?.messages || []} loading={busy} /></div>{chatError && <div className="chat-error">{chatError}<button onClick={() => setChatError('')}>知道了</button></div>}<FileComposer value={input} onChange={setInput} onSend={send} placeholder={busy ? '正在连接对话助手…' : '补充你的想法，细节越小越珍贵。'} />{generationType === 'comic' && <p className="safety-note">提示：不承诺真人还原，会生成亲子氛围插画。</p>}{generationType === 'article' && <StyleSelector value={style} onChange={setStyle} disabled={busy} />}<PrimaryButton type="button" disabled={busy} onClick={generate}><WandSparkles /> {busy ? '正在处理…' : `确认生成${typeLabels[generationType]}`}</PrimaryButton></>}</Shell>;
}

function SourceCard({ entry, variant = 'default' }: { entry?: TimelineEntry; variant?: 'default' | 'article' }) {
  if (variant !== 'article' && !entry) {
    return <div className="source-empty"><Sparkles /><div><b>还没有带入回忆</b><p>没关系，可以直接在下面聊天补充素材。</p></div></div>;
  }
  const isArticle = variant === 'article';
  const image = entry ? imageForEntry(entry) : thumbGraduation;
  const title = entry?.title ?? '毕业那天的拥抱';
  const date = entry ? formatDate(entry.startDate) : '2026年6月';
  const content = entry?.content || '他从人群里跑过来抱住我，我开心，也有一点舍不得...';
  return (
    <section className={`source-card ${isArticle ? 'source-card-article' : ''}`}>
      <span className="source-card-flower" aria-hidden>✿</span>
      <div className="source-card-pic"><img src={image} alt="" /></div>
      <div className="source-card-info">
        <span className="source-card-tag">已带入回忆</span>
        <h3>{title}</h3>
        <p className="source-card-date">{date}</p>
        <p className="source-card-desc">{content}</p>
        {entry && <button className="source-card-change" type="button">更换素材</button>}
      </div>
    </section>
  );
}

function GenerationPreview({ task, source, onRegenerate, onSave }: { task: GenerationTask; source?: TimelineEntry; onRegenerate: () => void; onSave: () => void }) {
  const isPlaceholder = !task.result?.imageUrls?.[0];
  const resultImage = task.result?.imageUrls?.[0] || typeResultImages[task.type];
  const [showRaw, setShowRaw] = useState(false);
  const rawOutput = task.result?.rawOutput && <div className="raw-output"><button className="raw-toggle" onClick={() => setShowRaw((value) => !value)}>{showRaw ? '隐藏' : '查看'}原始返回</button>{showRaw && <pre>{task.result.rawOutput}</pre>}</div>;

  if (task.type === 'article') {
    const articleText = task.result?.text || '';
    const articleLines = articleText.split('\n').filter((line) => line.trim());
    return <div className="preview-page article-preview-page">
      <article className="article-page">
        <span className="article-tape" />
        <span className="article-bookmark" />
        <span className="article-flower-left" aria-hidden>✿</span>
        <span className="article-flower-right" aria-hidden>✦</span>
        <h2>{task.result?.title || '写给这段回忆的你'}</h2>
        <div className="article-divider"><i /><b>♡</b><i /></div>
        <div className="article-body">
          {articleLines.length ? articleLines.map((line, index) => <p key={`${line}-${index}`}>{line}</p>) : <p>文章正在整理中，请返回聊天补充更多想法后重新生成。</p>}
        </div>
        <div className="article-corner-art" aria-hidden><span>✉</span><span>✒</span></div>
      </article>
      <section className="article-adjust-panel">
        <small>接下来你可以</small>
        <div>
          <button type="button" onClick={onRegenerate}><MessageCircle />继续补充想法<br />重新生成</button>
          <button type="button" onClick={onRegenerate}><WandSparkles />微调文章内容</button>
          <button type="button" onClick={onRegenerate}><BookOpen />换个文风试试</button>
        </div>
      </section>
      <div className="preview-actions article-actions"><button onClick={onRegenerate}>返回聊天</button><button className="primary" onClick={onSave}><Save size={18} />{task.status === 'saved' ? '已保存作品' : '保存作品'}</button></div>
      <p className="article-save-note">作品会保存在「我的」中，方便随时查看和分享</p>
    </div>;
  }

  return <div className="preview-page">{source && <SourceCard entry={source} />}<section className={`result-image ${task.type}`}><img src={resultImage} alt={`${typeLabels[task.type]}预览`} />{isPlaceholder && <span className="placeholder-badge">占位预览</span>}</section><div className="preview-actions"><button onClick={onRegenerate}>继续聊想法<br />再调整细节</button><button className="primary" onClick={onSave}>{task.status === 'saved' ? '已保存作品' : '保存作品'}</button></div>{rawOutput}</div>;
}

function MyWorksPage() {
  const { state } = useAppStore();
  const navigate = useNavigate();
  const [tab, setTab] = useState<GenerationType>('article');
  const saved = state.generationTasks.filter((task) => task.status === 'saved');
  const works = saved.filter((task) => task.type === tab);
  return <Shell active="mine" title="我的" right={<span className="top-icons"><Settings /></span>}><section className="mine-profile"><img src={mineProfile} alt="作品集" /></section><div className="mine-tabs">{(['article', 'comic', 'diary-card'] as GenerationType[]).map((type) => <button className={tab === type ? 'active' : ''} key={type} onClick={() => setTab(type)}>{typeLabels[type]}</button>)}</div><div className="work-list">{works.length ? works.map((task) => { const source = state.timelineEntries.find((entry) => entry.id === task.sourceEntryId); return <button className="work-card" key={task.id} onClick={() => navigate(`/generate/${task.type}?taskId=${task.id}`)}><img src={task.result?.imageUrls?.[0] || typeResultImages[task.type]} alt="作品预览" /><div><small>{typeLabels[task.type]}</small><h3>{task.result?.title || '未命名作品'}</h3><p>来自：{source?.title || '生成页聊天'}</p><span>{task.savedAt ? new Date(task.savedAt).toLocaleDateString('zh-CN') : ''}</span></div><span>›</span></button>; }) : <div className="empty-work"><FileText /><h3>还没有保存的作品</h3><p>去生成页创作后会出现在这里</p></div>}</div></Shell>;
}

export default function App() {
  return <Routes><Route path="/" element={<TimelinePage />} /><Route path="/entry/new" element={<NewEntryPage />} /><Route path="/memory-chat" element={<MemoryChatPage />} /><Route path="/generate" element={<GenerateHomePage />} /><Route path="/generate/:type" element={<GenerationWorkspacePage />} /><Route path="/mine" element={<MyWorksPage />} /><Route path="/admin/roles" element={<AdminPage />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes>;
}
