import { BookHeart, Check, ChevronRight, CircleHelp, Flower2, ImagePlus, LoaderCircle, MessageCircleMore, PenLine, RotateCcw, Save, Sparkles, WandSparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AppShell, ChatPanel, DecorativeTitle, EmptyState, FloatingAdd, MemoryArtwork, PrimaryButton, SourceMemoryCard, Spirit, TimelineCard, TopBar, TypeIcon, TypeSelector, formatDate } from './components';
import type { DatePrecision, GenerationTask, GenerationType, TimelineEntry } from './domain';
import { useAppStore } from './store';

export function TimelinePage() {
  const { state } = useAppStore();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<TimelineEntry>();
  const entries = [...state.timelineEntries].sort((a, b) => b.startDate.localeCompare(a.startDate));
  return <AppShell withNav>
    <section className="timeline-page page-pad">
      <header className="brand-header"><h1>时光书 <span>▤</span></h1><button onClick={() => navigate('/memory-chat')}><Sparkles size={16}/> AI整理</button></header>
      <section className="profile-hero paper-card"><MemoryArtwork variant="family"/><div><h2>{state.childName}的时光书</h2><p>把今天留给以后</p><span>已记录 <b>{entries.length}</b> 段回忆</span><button onClick={() => navigate('/entry/new')}>＋ 新增回忆</button></div><Spirit size="small"/></section>
      <div className="timeline-section-title"><b>✿ 时光轴</b><span>共 {entries.length} 段回忆</span><button>全部⌄</button></div>
      <section className="timeline-list">{entries.map((entry) => <TimelineCard key={entry.id} entry={entry} onGenerate={setSelected}/>)}</section>
      <FloatingAdd onClick={() => navigate('/entry/new')}/>
    </section>
    {selected && <TypeSelector onClose={() => setSelected(undefined)} onSelect={(type) => navigate(`/generate/${type}?sourceEntryId=${selected.id}`)}/>} 
  </AppShell>;
}

export function NewEntryPage() {
  const navigate = useNavigate();
  const { addEntry } = useAppStore();
  const [precision, setPrecision] = useState<DatePrecision>('day');
  const [date, setDate] = useState('2026-08-05');
  const [endDate, setEndDate] = useState('2026-08-06');
  const [content, setContent] = useState('');
  const [tag, setTag] = useState('日常');
  const [images, setImages] = useState<string[]>([]);
  const acceptImages = (files: FileList | null) => {
    if (!files) return;
    [...files].slice(0, 3 - images.length).forEach((file) => { const reader = new FileReader(); reader.onload = () => setImages((current) => [...current, String(reader.result)]); reader.readAsDataURL(file); });
  };
  const save = () => {
    if (!content.trim() && images.length === 0) return;
    addEntry({ datePrecision: precision, startDate: date, endDate: precision === 'range' ? endDate : undefined, title: content.trim().slice(0, 14) || '一张珍贵的照片', content: content.trim(), imageDataUrls: images, tags: [tag], source: 'manual' });
    navigate('/');
  };
  return <AppShell><TopBar title="新增回忆" back={() => navigate(-1)}/><div className="page-pad form-page">
    <section className="tip-banner"><Spirit/><div><b>记不清具体日期也没关系，</b><br/>先把这一刻留下来。</div></section>
    <FormTitle>日期精度</FormTitle><div className="segmented">{(['year','month','day','range'] as DatePrecision[]).map((item) => <button className={precision === item ? 'active' : ''} onClick={() => setPrecision(item)} key={item}>{({year:'年',month:'年月',day:'日期',range:'区间'})[item]}</button>)}</div>
    <div className="date-inputs"><input type={precision === 'year' ? 'number' : precision === 'month' ? 'month' : 'date'} value={date} onChange={(e) => setDate(e.target.value)}/>{precision === 'range' && <><span>至</span><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}/></>}</div>
    <FormTitle>照片</FormTitle><label className="upload-box"><ImagePlus/><b>点击上传照片</b><input type="file" accept="image/*" multiple onChange={(e) => acceptImages(e.target.files)}/></label>{images.length > 0 && <div className="image-preview-list">{images.map((image, index) => <div key={image}><img src={image}/><button onClick={() => setImages(images.filter((_, i) => i !== index))}>×</button></div>)}</div>}
    <FormTitle>这段回忆</FormTitle><div className="notepad"><textarea maxLength={300} value={content} onChange={(e) => setContent(e.target.value)} placeholder="写下当时发生了什么，或者你现在想对孩子说的话…"/><small>{content.length}/300</small></div>
    <FormTitle>场景标签 <small>（可多选）</small></FormTitle><div className="chips">{['日常','生日','毕业','旅行','第一次'].map((item) => <button className={tag === item ? 'active' : ''} onClick={() => setTag(item)} key={item}>{item}</button>)}</div>
    <PrimaryButton disabled={!content.trim() && images.length === 0} onClick={save}><Save size={18}/> 保存到时间轴</PrimaryButton>
  </div></AppShell>;
}

function FormTitle({ children }: { children: React.ReactNode }) { return <h3 className="form-title">✿ {children}</h3>; }

export function MemoryChatPage() {
  const navigate = useNavigate();
  const { state, addMemoryExchange, organizeMemory } = useAppStore();
  const [draftOpen, setDraftOpen] = useState(false);
  const pending = state.memoryChat.messages.filter((message) => message.role === 'user' && message.processStatus === 'pending');
  return <AppShell><TopBar title="AI整理回忆" back={() => navigate(-1)} action={<span className="status-pill">仅本次整理</span>}/><div className="chat-page">
    <section className="interview-banner"><Spirit/><div><h2>慢慢说，我会帮你<br/>整理成一页时光书。</h2><p>可以发照片，也可以先讲故事。</p></div></section>
    <ChatPanel messages={state.memoryChat.messages} onSend={addMemoryExchange} placeholder="慢慢说，细节越小越珍贵～"/>
    <div className="sticky-action"><PrimaryButton disabled={pending.length === 0} onClick={() => setDraftOpen(true)}><WandSparkles size={20}/> 整理 {pending.length} 条新回答</PrimaryButton></div>
  </div>{draftOpen && <DraftSheet onClose={() => setDraftOpen(false)} onConfirm={(draft) => { if (organizeMemory(draft)) navigate('/'); }}/>}</AppShell>;
}

function DraftSheet({ onClose, onConfirm }: { onClose: () => void; onConfirm: (draft: { date: string; title: string; content: string }) => void }) {
  const [date, setDate] = useState('2026-06'); const [title, setTitle] = useState('毕业那天的拥抱'); const [content, setContent] = useState('他从人群里跑过来抱住我，我开心，也有一点舍不得。那一刻，我突然觉得他真的长大了。');
  return <div className="modal-backdrop"><section className="draft-sheet"><div className="sheet-handle"/><DecorativeTitle>整理好了，看看像不像这段回忆</DecorativeTitle><p className="center-muted">日期和文字都可以修改</p><label><span>▣ 日期</span><input type="month" value={date} onChange={(e) => setDate(e.target.value)}/><i>AI推测</i></label><label><span>✎ 标题</span><input value={title} onChange={(e) => setTitle(e.target.value)}/></label><label className="draft-content"><span>▤ 正文</span><textarea value={content} maxLength={300} onChange={(e) => setContent(e.target.value)}/><small>{content.length}/300</small></label><div className="draft-photos"><span>▧ 照片</span><MemoryArtwork variant="graduation" compact/><MemoryArtwork variant="graduation" compact/><button>＋<small>添加照片</small></button></div><button className="raw-chat">◉ 查看原始聊天记录 <ChevronRight/></button><div className="split-actions"><PrimaryButton secondary onClick={onClose}>返回修改</PrimaryButton><PrimaryButton onClick={() => onConfirm({date,title,content})}><Save size={18}/> 写入时间轴</PrimaryButton></div></section></div>;
}

export function GenerateHomePage() {
  const navigate = useNavigate();
  const { state } = useAppStore();
  const recent = state.generationTasks.slice(0, 2);
  const cards: { type: GenerationType; title: string; description: string }[] = [
    { type: 'article', title: '生成文章', description: '适合生日、毕业、写给孩子的一封信' },
    { type: 'comic', title: '生成漫画', description: '通过聊天确认想画哪一幕' },
    { type: 'diary-card', title: '生成日记卡', description: '适合保存和分享一页回忆' },
  ];
  return <AppShell withNav><div className="page-pad generate-home"><header className="simple-header"><h1>生成</h1><button><CircleHelp size={16}/> 作品说明</button></header><section className="generate-hero"><div><h2>把一段回忆<br/>变成一件<span>作品</span></h2><p>可以先带入时间轴回忆，<br/>也可以直接聊天补充素材。</p></div><MemoryArtwork variant="family"/><Spirit size="small"/></section><button className="memory-entry" onClick={() => navigate('/memory-chat')}><Spirit/><div><span>推荐</span><h2>AI整理回忆 ✦</h2><p>和我聊聊，把故事<br/>整理进时间轴</p></div><i>›</i></button><DecorativeTitle>把回忆变成作品</DecorativeTitle><div className="generation-grid">{cards.map((card) => <button key={card.type} className={`generation-card ${card.type}`} onClick={() => navigate(`/generate/${card.type}`)}><div><h3>{card.title} ✦</h3><p>{card.description}</p></div><div className="entry-art"><TypeIcon type={card.type}/><span>›</span></div></button>)}</div><div className="recent-title"><h3>✿ 最近创作</h3><button>查看全部 ›</button></div>{recent.length ? recent.map((task) => <button className="recent-work" key={task.id} onClick={() => navigate(`/generate/${task.type}?taskId=${task.id}`)}><TypeIcon type={task.type}/><div><b>{task.result?.title || '未完成的创作'}</b><small>{task.status === 'saved' ? '已保存' : '继续创作'}</small></div><span>继续创作</span></button>) : <div className="recent-placeholder">新的创作会保存在这里</div>}</div></AppShell>;
}

const typeCopy = {
  article: { title: '生成文章', confirm: '确认生成文章', placeholder: '补充你想表达的话' },
  comic: { title: '生成漫画', confirm: '确认生成漫画草稿', placeholder: '描述画面、动作或情绪…' },
  'diary-card': { title: '生成日记卡', confirm: '确认生成日记卡草稿', placeholder: '补充卡片上想写的话…' },
};

export function GenerationWorkspacePage() {
  const { type = 'article' } = useParams();
  const generationType = type as GenerationType;
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const store = useAppStore();
  const sourceEntryId = search.get('sourceEntryId') || undefined;
  const taskId = search.get('taskId');
  const source = store.state.timelineEntries.find((entry) => entry.id === sourceEntryId);
  const initial = store.state.generationTasks.find((item) => item.id === taskId) || store.getOrCreateTask(generationType, sourceEntryId);
  const [task, setTask] = useState<GenerationTask>(initial);
  const copy = typeCopy[generationType];
  const send = (content: string) => setTask(store.addTaskExchange(task, content));
  const generate = async () => setTask(await store.generateTask(task));
  const save = () => { setTask(store.saveTask(task)); };
  const preview = task.status === 'completed' || task.status === 'saved';
  return <AppShell><TopBar title={copy.title} back={() => navigate(-1)} action={<span className="status-pill"><Sparkles size={13}/>{preview ? '已生成' : '创作中'}</span>}/><div className={`workspace ${preview ? 'preview-mode' : ''}`}><div className="progress-steps"><b className={!preview ? 'active' : 'done'}>{preview ? '✓' : '①'} 聊聊想法</b><span>→</span><b className={preview ? 'active' : ''}>② {generationType === 'article' ? '查看文章' : generationType === 'comic' ? '生成漫画' : '生成日记卡'}</b><span>→</span><b>③ 保存作品</b></div><SourceMemoryCard entry={source}/>{task.status === 'generating' ? <Generating type={generationType}/> : preview ? <GenerationPreview task={task} onRegenerate={() => setTask({...task,status:'draft'})} onSave={save}/> : <><section className="workspace-intro"><Spirit/><p>{generationType === 'comic' ? '先和我聊聊你想要的漫画内容吧。' : generationType === 'diary-card' ? '先和我聊聊你想要的内容吧。' : '我会先和你聊聊写给谁、想表达什么，再帮你写成一篇文章。'}</p></section>{generationType === 'comic' && <p className="safety-note">提示：不承诺真人还原，会生成亲子氛围插画。</p>}<ChatPanel messages={task.messages} onSend={send} placeholder={copy.placeholder}/><div className="sticky-action"><PrimaryButton onClick={generate} disabled={!source && task.messages.filter((message) => message.role === 'user').length === 0}><WandSparkles size={20}/> {copy.confirm}</PrimaryButton><small>想法越具体，生成的作品越贴合你的心意～</small></div></>}</div></AppShell>;
}

function Generating({ type }: { type: GenerationType }) { return <div className="generating-state"><LoaderCircle className="spin"/><h2>正在把这段回忆变成{type === 'article' ? '文章' : type === 'comic' ? '漫画' : '日记卡'}</h2><p>小精灵正在认真整理，请稍等一下……</p></div>; }

function GenerationPreview({ task, onRegenerate, onSave }: { task: GenerationTask; onRegenerate: () => void; onSave: () => void }) {
  if (task.status === 'failed') return <div className="preview-content"><div className="generating-state error"><h2>生成失败了</h2><p>{task.error || '请稍后重试'}</p><button className="reset" onClick={onRegenerate}>返回聊天重试</button></div></div>;
  const imageUrls = task.result?.imageUrls || [];
  return <div className="preview-content">{task.type === 'article' ? <article className="article-page"><span className="tape"/><h2>{task.result?.title}</h2>{task.result?.text?.split('\n').map((line, index) => line ? <p key={index}>{line}</p> : <br key={index}/>) }<div className="letter-end">妈妈爱你，永远爱你。 ♡</div></article> : task.type === 'comic' ? <ComicPreview imageUrls={imageUrls}/> : <DiaryPreview imageUrl={imageUrls[0]}/>}<div className="adjust-panel"><small>接下来你可以</small><div><button onClick={onRegenerate}><MessageCircleMore/>继续补充想法<br/>重新生成</button><button><PenLine/>微调作品内容</button><button><BookHeart/>换个文风试试</button></div></div><div className="split-actions"><PrimaryButton secondary onClick={onRegenerate}>返回聊天</PrimaryButton><PrimaryButton onClick={onSave} disabled={task.status === 'saved'}><Save size={18}/>{task.status === 'saved' ? ' 已保存到我的' : ' 保存作品'}</PrimaryButton></div></div>;
}

function ComicPreview({ imageUrls }: { imageUrls: string[] }) {
  if (!imageUrls.length) return <section className="comic-preview"><p className="preview-caption">暂未获取到漫画图片</p></section>;
  return <section className="comic-preview"><div className="preview-heading"><h3>漫画预览 <small>共 {imageUrls.length} 格</small></h3></div><div className="comic-grid">{imageUrls.map((url, index) => <div className="comic-panel" key={url}><span>{index + 1}</span><img src={url} alt={`漫画第 ${index + 1} 格`} loading="lazy" /></div>)}</div><p className="preview-caption">漫画为 AI 生成草稿，点击任意格子可调整画面或文字</p></section>;
}

function DiaryPreview({ imageUrl }: { imageUrl?: string }) {
  return <section className="diary-preview"><div className="preview-heading"><h3>日记卡预览</h3></div>{imageUrl ? <img className="diary-img" src={imageUrl} alt="日记卡" loading="lazy" /> : <p className="preview-caption">暂未获取到日记卡图片</p>}</section>;
}

export function MyWorksPage() {
  const { state } = useAppStore(); const navigate = useNavigate(); const [tab,setTab] = useState<GenerationType>('article');
  const saved = useMemo(() => state.generationTasks.filter((task) => task.status === 'saved'), [state.generationTasks]); const works = saved.filter((task) => task.type === tab);
  return <AppShell withNav><div className="page-pad mine-page"><header className="mine-header"><h1>我的</h1><span>♧　⚙</span></header><section className="mine-profile"><div className="big-avatar">妈</div><div><h2>小暖的创作日记 <small>LV.3</small></h2><p>记录生活的小确幸，创作温暖的回忆～</p></div><Spirit/><div className="stats"><b>{saved.filter(t=>t.type==='article').length}<small>文章</small></b><b>{saved.filter(t=>t.type==='comic').length}<small>漫画</small></b><b>{saved.filter(t=>t.type==='diary-card').length}<small>日记卡</small></b></div></section><div className="works-tabs">{(['article','comic','diary-card'] as GenerationType[]).map((type) => <button key={type} className={tab === type ? 'active' : ''} onClick={() => setTab(type)}>{type === 'article' ? '文章' : type === 'comic' ? '漫画' : '日记卡'}</button>)}</div><section className="works-list">{works.length ? works.map((task) => { const source = state.timelineEntries.find((entry) => entry.id === task.sourceEntryId); return <button key={task.id} className="work-row" onClick={() => navigate(`/generate/${task.type}?taskId=${task.id}`)}><div className={`work-thumb ${task.type}`}><TypeIcon type={task.type}/></div><div><span>{task.type === 'article' ? '文章' : task.type === 'comic' ? '漫画' : '日记卡'}</span><h3>{task.result?.title}</h3><p>来自：{source?.title || '生成页聊天'}</p><small>{task.savedAt ? new Date(task.savedAt).toLocaleDateString('zh-CN') : ''}</small></div><i>•••</i></button>; }) : <EmptyState title="还没有保存的作品" description="去生成页创作后会出现在这里"/>}</section></div></AppShell>;
}
