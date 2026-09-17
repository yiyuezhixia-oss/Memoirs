import { BookOpen, Bot, Feather, Home, Image as ImageIcon, Plus, Send, Sparkles, UserRound, WandSparkles } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import type { ChatMessage, GenerationType, TimelineEntry } from './domain';

export function AppShell({ children, withNav = false }: { children: ReactNode; withNav?: boolean }) {
  return <main className={`app-shell ${withNav ? 'with-nav' : ''}`}>{children}{withNav && <BottomNav />}</main>;
}

export function TopBar({ title, back, action }: { title: string; back?: () => void; action?: ReactNode }) {
  return <header className="top-bar">
    <button className={`icon-button ${back ? '' : 'invisible'}`} onClick={back} aria-label="返回">‹</button>
    <h1>{title}</h1>
    <div className="top-action">{action}</div>
  </header>;
}

function BottomNav() {
  const location = useLocation();
  const items = [
    { to: '/', label: '时间轴', icon: BookOpen, match: location.pathname === '/' },
    { to: '/generate', label: '生成', icon: WandSparkles, match: location.pathname.startsWith('/generate') },
    { to: '/mine', label: '我的', icon: UserRound, match: location.pathname.startsWith('/mine') },
  ];
  return <nav className="bottom-nav">{items.map(({ to, label, icon: Icon, match }) =>
    <NavLink key={to} to={to} className={match ? 'active' : ''}><Icon size={22}/><span>{label}</span></NavLink>)}</nav>;
}

export function Spirit({ mood = 'happy', size = 'normal' }: { mood?: 'happy' | 'thinking'; size?: 'small' | 'normal' | 'large' }) {
  return <div className={`spirit spirit-${size}`} aria-label="时光书小精灵">
    <span className="wing left">♡</span><div className="spirit-book"><span>{mood === 'thinking' ? '•ᴗ•' : '◕‿◕'}</span><i /></div><span className="wing right">♡</span>
  </div>;
}

export function MemoryArtwork({ variant = 'family', compact = false }: { variant?: 'family' | 'graduation' | 'bike' | 'thanks'; compact?: boolean }) {
  const copy = { family: ['妈妈', '安安'], graduation: ['🎓', '拥抱'], bike: ['🚲', '第一次'], thanks: ['💌', '谢谢'] }[variant];
  return <div className={`memory-art art-${variant} ${compact ? 'compact' : ''}`}><span className="sun"/><div className="people"><b>{copy[0]}</b><em>♡</em><b>{copy[1]}</b></div><i className="flower">✿</i></div>;
}

export function TimelineCard({ entry, onGenerate }: { entry: TimelineEntry; onGenerate: (entry: TimelineEntry) => void }) {
  const variant = entry.title.includes('毕业') ? 'graduation' : entry.title.includes('自行车') ? 'bike' : entry.title.includes('谢谢') ? 'thanks' : 'family';
  return <article className="timeline-card paper-card">
    <div className="date-ribbon">{formatDate(entry.startDate)}</div>
    <MemoryArtwork variant={variant} compact />
    <div className="timeline-copy"><h3>{entry.title}</h3><p>{entry.content}</p><small>{entry.source === 'ai-organized' ? '✦ AI整理' : '▣ 手动记录'}</small></div>
    <button className="outline-button generate-entry" onClick={() => onGenerate(entry)}>☆ 用于生成</button>
  </article>;
}

export function ChatPanel({ messages, onSend, placeholder }: { messages: ChatMessage[]; onSend: (value: string) => void; placeholder: string }) {
  const [value, setValue] = useState('');
  const submit = () => { if (!value.trim()) return; onSend(value.trim()); setValue(''); };
  return <>
    <section className="chat-list">{messages.map((message) => <div key={message.id} className={`message-row ${message.role}`}>
      {message.role === 'assistant' && <Spirit size="small" />}
      <div className="bubble">{message.content}<small>{new Date(message.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</small></div>
      {message.role === 'user' && <div className="user-avatar">妈</div>}
    </div>)}</section>
    <div className="chat-composer"><button aria-label="添加图片"><ImageIcon size={20}/></button><input value={value} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && submit()} placeholder={placeholder}/><button className="send-button" onClick={submit}><Send size={18}/><span>发送</span></button></div>
  </>;
}

export function SourceMemoryCard({ entry }: { entry?: TimelineEntry }) {
  if (!entry) return <div className="source-empty"><Sparkles size={19}/><div><b>还没有带入回忆</b><p>没关系，可以直接在下面聊天补充素材。</p></div></div>;
  const variant = entry.title.includes('自行车') ? 'bike' : 'graduation';
  return <section className="source-card paper-card"><MemoryArtwork variant={variant} compact/><div><span>已带入回忆</span><h3>{entry.title}</h3><small>▣ {formatDate(entry.startDate)}</small><p>{entry.content}</p></div><button>更换素材</button></section>;
}

export function TypeIcon({ type }: { type: GenerationType }) {
  if (type === 'article') return <Feather />;
  if (type === 'comic') return <ImageIcon />;
  return <Home />;
}

export function TypeSelector({ onSelect, onClose }: { onSelect: (type: GenerationType) => void; onClose: () => void }) {
  return <div className="modal-backdrop" onClick={onClose}><div className="type-sheet" onClick={(event) => event.stopPropagation()}><div className="sheet-handle"/><h2>把这段回忆变成什么？</h2><p>素材会带入创作工作台，还可以继续聊天补充。</p>{(['article', 'comic', 'diary-card'] as GenerationType[]).map((type) => <button key={type} onClick={() => onSelect(type)}><TypeIcon type={type}/><span><b>{type === 'article' ? '生成文章' : type === 'comic' ? '生成漫画' : '生成日记卡'}</b><small>{type === 'article' ? '写成温柔家书' : type === 'comic' ? '变成亲子氛围漫画' : '留下一张分享卡片'}</small></span><i>›</i></button>)}</div></div>;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="empty-state"><Bot size={38}/><h3>{title}</h3><p>{description}</p></div>;
}

export function PrimaryButton({ children, onClick, disabled = false, secondary = false }: { children: ReactNode; onClick?: () => void; disabled?: boolean; secondary?: boolean }) {
  return <button className={`primary-button ${secondary ? 'secondary' : ''}`} onClick={onClick} disabled={disabled}>{children}</button>;
}

export function FloatingAdd({ onClick }: { onClick: () => void }) {
  return <button className="floating-add" onClick={onClick} aria-label="新增回忆"><Plus/></button>;
}

export function formatDate(date: string) {
  if (!date) return '时间待补';
  const parts = date.split('-');
  if (parts.length === 1) return `${parts[0]}年`;
  if (parts.length === 2) return `${parts[0]}年${Number(parts[1])}月`;
  return `${parts[0]}年${Number(parts[1])}月${Number(parts[2])}日`;
}

export function DecorativeTitle({ children }: { children: ReactNode }) {
  return <div className="decorative-title"><span>✿</span><h2>{children}</h2><span>✦</span></div>;
}
