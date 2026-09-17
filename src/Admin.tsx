import { useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, RotateCcw, Save, Settings2, ShieldCheck, TestTube2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from './appStore';
import { runApiSelfTest } from './services/api';
import type { RoleConfig, RoleId } from './types';

const roleOrder: RoleId[] = ['memory-organizer', 'article-writer', 'comic-director', 'diary-card-designer'];

export default function AdminPage() {
  const navigate = useNavigate();
  const store = useAppStore();
  const [selectedId, setSelectedId] = useState<RoleId>('memory-organizer');
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState<Array<{ name: string; ok: boolean; detail: string }>>([]);
  const selected = store.roles.find((role) => role.id === selectedId) || store.roles[0];
  const [draft, setDraft] = useState<RoleConfig>(selected);
  const current = useMemo(() => store.roles.find((role) => role.id === selectedId) || selected, [selected, selectedId, store.roles]);

  const choose = (id: RoleId) => { setSelectedId(id); setDraft(store.roles.find((role) => role.id === id) || current); setSaved(false); };
  const update = <K extends keyof RoleConfig>(key: K, value: RoleConfig[K]) => setDraft((valueBefore) => ({ ...valueBefore, [key]: value }));
  const save = () => { store.updateRole(selectedId, { name: draft.name, description: draft.description, systemPrompt: draft.systemPrompt, conversationGoal: draft.conversationGoal, outputFormat: draft.outputFormat, downstream: draft.downstream, enabled: draft.enabled }); setSaved(true); };
  const reset = () => { store.resetRole(selectedId); const next = store.roles.find((role) => role.id === selectedId); if (next) setDraft(next); setSaved(false); };
  const test = async () => { setTesting(true); setTestResults(await runApiSelfTest()); setTesting(false); };

  return <main className="admin-shell"><header className="admin-topbar"><button onClick={() => navigate('/')}><ArrowLeft /> 返回产品</button><div><span>时光书</span><h1>后台控制台</h1></div><button onClick={() => navigate('/admin/roles')}><Settings2 /> 角色管理</button></header><section className="admin-intro"><div><span className="admin-kicker">CONTROL ROOM / V1</span><h2>让每个生成入口<br /><em>知道自己要成为什么。</em></h2><p>这里管理入口角色的职责、系统提示词、对话目标和最终产出。配置保存在本机；大模型 API 已内置生产配置，无需手动接入。</p></div><div className="admin-status"><ShieldCheck /><b>LOCAL CONFIG</b><span>本地保存</span></div></section>

<div className="admin-layout"><aside className="role-list"><div className="admin-section-label">入口角色 <span>{store.roles.length}</span></div>{roleOrder.map((id) => { const role = store.roles.find((item) => item.id === id)!; return <button key={id} className={id === selectedId ? 'selected' : ''} onClick={() => choose(id)}><span className="role-index">0{roleOrder.indexOf(id) + 1}</span><div><b>{role.entryLabel}</b><small>{role.name}</small></div><i>{role.enabled ? 'ON' : 'OFF'}</i></button>; })}<button className="api-test-link" onClick={test}><TestTube2 /> {testing ? '测试中…' : '运行 API 自检'}</button></aside><section className="role-editor"><div className="editor-heading"><div><span className="admin-kicker">ROLE SPECIFICATION / {selected.entryLabel}</span><h2>{draft.name}</h2><p>{draft.description}</p></div><label className="toggle"><input type="checkbox" checked={draft.enabled} onChange={(event) => update('enabled', event.target.checked)} /><span />启用角色</label></div><div className="editor-grid"><EditorField label="角色名称" value={draft.name} onChange={(value) => update('name', value)} /><EditorField label="入口职责" value={draft.description} onChange={(value) => update('description', value)} /><EditorField label="对话目标" value={draft.conversationGoal} onChange={(value) => update('conversationGoal', value)} wide /><EditorField label="最终产出形式" value={draft.outputFormat} onChange={(value) => update('outputFormat', value)} wide /><EditorField label="下游调用" value={draft.downstream} onChange={(value) => update('downstream', value)} wide /></div><div className="prompt-editor"><div className="prompt-header"><div><span className="admin-kicker">SYSTEM PROMPT / 可编辑</span><h3>系统提示词</h3></div><span>{draft.systemPrompt.length} chars</span></div><textarea value={draft.systemPrompt} onChange={(event) => update('systemPrompt', event.target.value)} /><div className="prompt-note">建议：先写角色身份，再写不可违反的事实边界，最后写需要产出的内容。自然语言优先，只有下游接口确实要求时才结构化。</div></div><div className="editor-actions"><button className="reset" onClick={reset}><RotateCcw /> 恢复默认</button><button className="save" onClick={save}><Save /> {saved ? '已保存到本机' : '保存角色配置'}</button></div>{testResults.length > 0 && <section className="test-panel"><div className="prompt-header"><div><span className="admin-kicker">ADAPTER SELF-TEST</span><h3>API 适配层测试结果</h3></div><span>{testResults.filter((item) => item.ok).length}/{testResults.length} passed</span></div>{testResults.map((item) => <div className="test-row" key={item.name}><CheckCircle2 className={item.ok ? 'ok' : 'fail'} /><b>{item.name}</b><span>{item.detail}</span></div>)}<small>当前自检默认强制走 mock，真实 API/Coze 需在拿到文档和凭据后单独验证。</small></section>}</section></div></main>;
}

function EditorField({ label, value, onChange, wide = false }: { label: string; value: string; onChange: (value: string) => void; wide?: boolean }) {
  return <label className={`editor-field ${wide ? 'wide' : ''}`}><span>{label}</span>{wide ? <textarea value={value} onChange={(event) => onChange(event.target.value)} /> : <input value={value} onChange={(event) => onChange(event.target.value)} />}</label>;
}
