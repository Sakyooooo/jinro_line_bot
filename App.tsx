
import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, Settings, Moon, Sun, Send, MessageCircle, User as UserIcon, Shield, Ghost, 
  Trash2, Crown, ChevronRight, AlertCircle, Skull, Clock,
  ArrowRight, CheckCircle2, XCircle, UserCheck, Key, Copy, RefreshCw, Eye, EyeOff, PlusCircle, LogIn, ChevronDown, RotateCcw, ArrowRightCircle
} from 'lucide-react';
import { ROLES, TEMPLATES } from './constants';
import { Player, Phase, Message, GameState, UserProfile, Team, ChatChannel, ScreenState } from './types';

// ゲーム定数（秒）
const NIGHT_LIMIT = 300; 
const DAY_LIMIT = 300; 
const VOTE_LIMIT = 120;

const generatePasscode = () => Math.floor(100000 + Math.random() * 900000).toString();
const generateRoomId = () => Math.random().toString(36).substr(2, 6).toUpperCase();
const mockHash = (str: string) => `sha256:${btoa(str).slice(0, 10)}`;

interface ResumeRecord {
  roomId: string;
  roomName: string;
  playerToken: string;
  displayName: string;
  lastSeenAt: number;
}

const ROLE_SELECTION_DESCRIPTIONS: { [key: string]: string } = {
  village: '特別な能力はない（推理して投票する）',
  wolf: '夜に襲撃先を相談して決める（人狼同士で相談可）',
  seer: '夜に1人を占い、人狼かどうかが分かる',
  knight: '夜に1人を護衛し、襲撃から守れる',
  medium: '朝に前日処刑者が人狼か分かる',
  madman: '人狼陣営だが人狼は誰か分からない／占いは村人判定',
  fox: '襲撃では死なないが、占われると死ぬ',
  immoral: '妖狐陣営。妖狐が死ぬと後追いで死亡',
  mason: '共有者同士は開始時にお互いが分かる',
  baker: '生存している朝は「パンが焼けた」と通知される',
};

export default function App() {
  const [screen, setScreen] = useState<ScreenState>('HOME');

  const [currentUser, setCurrentUser] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem('werewolf-token-v3');
      return saved ? JSON.parse(saved) : { id: `u-${Math.random().toString(36).substr(2, 9)}`, name: '' };
    } catch {
      return { id: `u-${Math.random().toString(36).substr(2, 9)}`, name: '' };
    }
  });

  const [game, setGame] = useState<GameState>(() => {
    try {
      const saved = localStorage.getItem('werewolf-instance-v3');
      return saved ? JSON.parse(saved) : {
        roomId: '', roomName: '', passcode: '', passcodeHash: '', phase: 'LOBBY',
        day: 0, players: [], messages: [], timer: 0, roleConfig: { ...TEMPLATES[5] }
      };
    } catch {
      return {
        roomId: '', roomName: '', passcode: '', passcodeHash: '', phase: 'LOBBY',
        day: 0, players: [], messages: [], timer: 0, roleConfig: { ...TEMPLATES[5] }
      };
    }
  });

  const [resumeHistory, setResumeHistory] = useState<ResumeRecord[]>(() => {
    try {
      const saved = localStorage.getItem('werewolf:resume:index');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [formRoomName, setFormRoomName] = useState('');
  const [formPlayerCount, setFormPlayerCount] = useState(5);
  const [formDisplayName, setFormDisplayName] = useState(currentUser.name || '');
  const [formRoomId, setFormRoomId] = useState('');
  const [inputPasscode, setInputPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [canResume, setCanResume] = useState(false);

  const [activeChannel, setActiveChannel] = useState<ChatChannel>('GLOBAL');
  const [inputMessage, setInputMessage] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // 襲撃演出用ステート
  const [attackEffect, setAttackEffect] = useState(false);
  const prevPhaseRef = useRef<Phase>(game.phase);
  const me = game.players.find(p => p.id === currentUser.id);
  const prevAliveRef = useRef<boolean>(me?.isAlive ?? true);

  // 永続化と画面遷移の監視
  useEffect(() => {
    localStorage.setItem('werewolf-token-v3', JSON.stringify(currentUser));
    localStorage.setItem('werewolf-instance-v3', JSON.stringify(game));
    localStorage.setItem('werewolf:resume:index', JSON.stringify(resumeHistory));
    
    if (game.phase !== 'LOBBY' && screen === 'HOME' && game.roomId) {
      setScreen('GAME');
    }
  }, [currentUser, game, screen, resumeHistory]);

  // 襲撃演出のトリガー監視（夜から朝への切り替わり時）
  useEffect(() => {
    if (prevPhaseRef.current === 'NIGHT' && game.phase === 'DAY') {
      // 自分が「生存」から「襲撃死」に変わったかチェック
      if (prevAliveRef.current === true && me?.isAlive === false && me?.deathReason === '襲撃') {
        setAttackEffect(true);
        setTimeout(() => setAttackEffect(false), 3000);
      }
    }
    prevPhaseRef.current = game.phase;
    prevAliveRef.current = me?.isAlive ?? true;
  }, [game.phase, me?.isAlive, me?.deathReason]);

  // チャットの自動追従（メッセージ増分時に最下部付近ならスクロール）
  useEffect(() => {
    if (isAtBottom && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [game.messages.length, isAtBottom]);

  useEffect(() => {
    if (formRoomId.length === 6) {
      const savedRecord = resumeHistory.find(r => r.roomId === formRoomId.toUpperCase());
      setCanResume(!!(savedRecord && game.roomId === formRoomId.toUpperCase()));
    } else {
      setCanResume(false);
    }
  }, [formRoomId, game.roomId, resumeHistory]);

  const updateResumeHistory = (record: ResumeRecord) => {
    setResumeHistory(prev => {
      const filtered = prev.filter(r => r.roomId !== record.roomId);
      return [record, ...filtered].slice(0, 5);
    });
  };

  const createMsg = (sid: string, sname: string, content: string, channel: ChatChannel, rid?: string): Message => ({
    id: `m-${Date.now()}-${Math.random()}`,
    senderId: sid,
    senderName: sname,
    content,
    timestamp: Date.now(),
    channel,
    recipientId: rid
  });

  const postGlobal = (content: string) => {
    setGame(prev => ({
      ...prev,
      messages: [...prev.messages, createMsg('bot', 'GM Bot', content, 'GLOBAL')]
    }));
  };

  const postBotDM = (userId: string, content: string) => {
    setGame(prev => ({
      ...prev,
      messages: [...prev.messages, createMsg('bot', 'GM Bot', content, 'BOT_DM', userId)]
    }));
  };

  const handleCreateRoom = () => {
    if (!formDisplayName.trim()) { setErrorMsg('表示名を入力してください'); return; }
    try {
      const rid = generateRoomId();
      const pc = generatePasscode();
      const hash = mockHash(pc);
      const host: Player = { id: currentUser.id, name: formDisplayName, roleId: 'village', isAlive: true, isHost: true, isNPC: false, hasActed: false, skipAgreed: false };
      const newGame: GameState = {
        roomId: rid, roomName: formRoomName.trim() || `${formDisplayName}の村`, passcode: pc, passcodeHash: hash,
        phase: 'SETUP', day: 0, players: [host], messages: [createMsg('bot', 'GM Bot', `ルーム「${formRoomName || rid}」が作成されました。`, 'GLOBAL')],
        timer: 0, roleConfig: { ...TEMPLATES[formPlayerCount] }
      };
      updateResumeHistory({ roomId: rid, roomName: newGame.roomName, playerToken: currentUser.id, displayName: formDisplayName, lastSeenAt: Date.now() });
      setCurrentUser(prev => ({ ...prev, name: formDisplayName }));
      setGame(newGame);
      setScreen('GAME');
    } catch (err) { setErrorMsg('作成失敗'); }
  };

  const handleJoinRoom = () => {
    if (!formDisplayName.trim() || !formRoomId || inputPasscode.length !== 6) { setErrorMsg('入力を確認してください'); return; }
    if (formRoomId.toUpperCase() !== game.roomId) { setErrorMsg('ルームが見つかりません'); return; }
    if (mockHash(inputPasscode) !== game.passcodeHash) { setErrorMsg('パスコードが違います'); return; }

    const isMember = game.players.some(p => p.id === currentUser.id);
    if (!isMember) {
      const p: Player = { id: currentUser.id, name: formDisplayName, roleId: 'village', isAlive: true, isHost: false, isNPC: false, hasActed: false, skipAgreed: false };
      setGame(prev => ({
        ...prev,
        players: [...prev.players, p],
        messages: [...prev.messages, createMsg('bot', 'GM Bot', `${formDisplayName}さんが入室しました。`, 'GLOBAL')]
      }));
    }
    updateResumeHistory({ roomId: formRoomId.toUpperCase(), roomName: game.roomName, playerToken: currentUser.id, displayName: formDisplayName, lastSeenAt: Date.now() });
    setCurrentUser(prev => ({ ...prev, name: formDisplayName }));
    setScreen('GAME');
  };

  const handleResumeFromRecord = (record: ResumeRecord) => {
    if (record.roomId !== game.roomId) {
      setResumeHistory(prev => prev.filter(r => r.roomId !== record.roomId));
      setErrorMsg('セッションが終了しています');
      return;
    }
    setCurrentUser({ id: record.playerToken, name: record.displayName });
    updateResumeHistory({ ...record, lastSeenAt: Date.now() });
    setScreen('GAME');
  };

  const handleResumeSession = () => {
    const record = resumeHistory.find(r => r.roomId === formRoomId.toUpperCase());
    if (record) {
      handleResumeFromRecord(record);
    }
  };

  const jumpToLatest = () => {
    setIsAtBottom(true);
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;
    
    setGame(prev => ({
      ...prev,
      messages: [...prev.messages, createMsg(currentUser.id, currentUser.name, inputMessage, activeChannel, activeChannel === 'BOT_DM' ? 'bot' : undefined)]
    }));
    setInputMessage('');
  };

  const handleRematch = () => {
    setGame(prev => {
      const resetPlayers = prev.players.map(p => ({
        ...p,
        isAlive: true,
        hasActed: false,
        skipAgreed: false,
        nightActionTarget: undefined,
        voteTarget: undefined,
        deathReason: undefined
      }));
      
      return {
        ...prev,
        phase: 'SETUP' as Phase,
        day: 0,
        players: resetPlayers,
        messages: [...prev.messages, createMsg('bot', 'GM Bot', "--- 再戦を開始します ---", 'GLOBAL')],
        timer: 0,
        winner: undefined
      };
    });
  };

  const handleGoHome = () => {
    setScreen('HOME');
    setGame({
      roomId: '', roomName: '', passcode: '', passcodeHash: '', phase: 'LOBBY',
      day: 0, players: [], messages: [], timer: 0, roleConfig: { ...TEMPLATES[5] }
    });
  };

  const startGame = () => {
    const total = (Object.values(game.roleConfig) as number[]).reduce((a, b) => a + b, 0);
    if (total !== game.players.length) return;
    const pool: string[] = [];
    Object.entries(game.roleConfig).forEach(([rid, count]) => { for (let i = 0; i < (count as number); i++) pool.push(rid); });
    const shuffled = pool.sort(() => Math.random() - 0.5);
    const nextPlayers = game.players.map((p, i) => ({ ...p, roleId: shuffled[i], isAlive: true, hasActed: false, skipAgreed: false }));
    setGame(prev => ({ ...prev, phase: 'NIGHT', day: 1, players: nextPlayers, timer: NIGHT_LIMIT }));
    postGlobal("=== ゲーム開始 ===\n夜が来ました。役職者はBotチャットを確認してください。");
    nextPlayers.forEach(p => {
      if (!p.isNPC) {
        postBotDM(p.id, `役職: 【${ROLES[p.roleId].name}】\n${ROLES[p.roleId].description}`);
        if (p.roleId === 'seer') postBotDM(p.id, "【案内】初日は自動的に「村人陣営」の誰か一人が白と判明します。");
        if (p.roleId === 'wolf') {
          const partners = nextPlayers.filter(x => x.id !== p.id && x.roleId === 'wolf').map(x => x.name);
          if (partners.length > 0) postBotDM(p.id, `仲間: ${partners.join(', ')}`);
        }
      }
    });
  };

  const resolveNight = () => {
    setGame(prev => {
      if (prev.phase !== 'NIGHT') return prev;
      let players = prev.players.map(p => ({ ...p }));
      let deaths: string[] = [];
      const wolfVotes: Record<string, number> = {};
      players.filter(p => p.isAlive && p.roleId === 'wolf').forEach(p => {
        const tid = p.nightActionTarget || players.filter(t => t.isAlive && t.roleId !== 'wolf')[0]?.id;
        if (tid) wolfVotes[tid] = (wolfVotes[tid] || 0) + 1;
      });
      const killId = Object.entries(wolfVotes).sort((a,b) => b[1] - a[1])[0]?.[0];
      const guardId = players.find(p => p.isAlive && p.roleId === 'knight')?.nightActionTarget;
      
      if (prev.day > 1 && killId && killId !== guardId) {
        const target = players.find(p => p.id === killId);
        if (target && target.roleId !== 'fox') { target.isAlive = false; target.deathReason = '襲撃'; deaths.push(`${target.name}さんが無残な姿で発見されました。`); }
      }
      players.filter(p => p.isAlive && p.roleId === 'seer').forEach(p => {
        let tid: string | undefined;
        if (prev.day === 1) {
          tid = players.filter(t => t.id !== p.id && ROLES[t.roleId].team === 'VILLAGER')[0]?.id;
        } else {
          tid = p.nightActionTarget || players.find(t => t.isAlive && t.id !== p.id)?.id;
        }
        if (tid) {
          const t = players.find(x => x.id === tid);
          const isW = t && ROLES[t.roleId].team === 'WEREWOLF' && t.roleId !== 'madman';
          if (!p.isNPC) prev.messages.push(createMsg('bot', 'GM Bot', `${t?.name}さんは「${isW ? '人狼' : '村人'}」でした。`, 'BOT_DM', p.id));
          if (t?.roleId === 'fox') { t.isAlive = false; t.deathReason = '呪殺'; deaths.push(`${t.name}さんが変わり果てた姿で見つかりました。`); }
        }
      });
      return checkVictory({ ...prev, phase: 'DAY', timer: DAY_LIMIT, players: players.map(p => ({ ...p, nightActionTarget: undefined, hasActed: false, skipAgreed: false })), messages: [...prev.messages, ...newsMessages(deaths, prev.day, players)] });
    });
  };

  const newsMessages = (deaths: string[], day: number, players: Player[]) => {
    const msgs = [`=== 第 ${day} 日目 朝 ===`, ...(deaths.length > 0 ? deaths : ["昨晩は誰も死にませんでした。"])];
    if (players.some(p => p.isAlive && p.roleId === 'baker')) msgs.push("「焼きたての美味しいパンが届きました🍞」");
    return msgs.map(n => createMsg('bot', 'GM Bot', n, 'GLOBAL'));
  };

  const resolveVote = () => {
    setGame(prev => {
      const tallies: Record<string, number> = {};
      prev.players.filter(p => p.isAlive).forEach(v => { const t = v.voteTarget || prev.players.filter(p => p.isAlive && p.id !== v.id)[0]?.id; if (t) tallies[t] = (tallies[t] || 0) + 1; });
      const sorted = Object.entries(tallies).sort((a,b) => b[1] - a[1]);
      let victimId: string | undefined;

      if (sorted.length > 1 && sorted[0][1] === sorted[1][1]) {
        if (prev.phase === 'VOTE') {
          return { ...prev, phase: 'REVOTE', timer: VOTE_LIMIT, players: prev.players.map(p => ({ ...p, voteTarget: undefined, hasActed: false })) };
        } else {
          const max = sorted[0][1];
          const tied = sorted.filter(s => s[1] === max);
          victimId = tied[Math.floor(Math.random() * tied.length)][0];
        }
      } else {
        victimId = sorted[0]?.[0];
      }

      const victim = prev.players.find(p => p.id === victimId);
      return checkVictory({ ...prev, phase: 'NIGHT', day: prev.day + 1, timer: NIGHT_LIMIT, players: prev.players.map(p => p.id === victimId ? { ...p, isAlive: false, deathReason: '処刑' } : { ...p, voteTarget: undefined, hasActed: false, skipAgreed: false }), messages: [...prev.messages, createMsg('bot', 'GM Bot', `${victim?.name}さんが処刑されました。`, 'GLOBAL')] });
    });
  };

  const checkVictory = (state: GameState): GameState => {
    const alive = state.players.filter(p => p.isAlive);
    const w = alive.filter(p => ROLES[p.roleId].team === 'WEREWOLF').length;
    const v = alive.length - w;
    const f = alive.filter(p => p.roleId === 'fox').length;
    let winner: Team | undefined;
    if (w >= v) winner = f > 0 ? 'FOX' : 'WEREWOLF';
    else if (w === 0) winner = f > 0 ? 'FOX' : 'VILLAGER';
    return winner ? { ...state, phase: 'RESULT', winner } : state;
  };

  const handleAction = (targetId: string) => {
    setGame(prev => ({
      ...prev,
      players: prev.players.map(p => {
        if (p.id !== currentUser.id) return p;
        if (prev.phase === 'NIGHT') return { ...p, nightActionTarget: targetId, hasActed: true };
        if (prev.phase === 'VOTE' || prev.phase === 'REVOTE') return { ...p, voteTarget: targetId, hasActed: true };
        return p;
      })
    }));
  };

  useEffect(() => {
    if (game.phase === 'LOBBY' || game.phase === 'SETUP' || game.phase === 'RESULT') return;
    const interval = setInterval(() => {
      setGame(prev => {
        if (prev.phase === 'LOBBY' || prev.phase === 'SETUP' || prev.phase === 'RESULT') return prev;
        let changed = false;
        const players = prev.players.map(p => {
          if (!p.isNPC || !p.isAlive) return p;
          if (prev.phase === 'NIGHT' && !p.hasActed) {
            if (prev.day === 1 && p.roleId === 'seer') return p;
            const targets = prev.players.filter(t => t.isAlive && t.id !== p.id);
            const target = targets[Math.floor(Math.random() * targets.length)];
            if (target) { changed = true; return { ...p, nightActionTarget: target.id, hasActed: true }; }
          }
          if ((prev.phase === 'VOTE' || prev.phase === 'REVOTE') && !p.hasActed) {
            const targets = prev.players.filter(t => t.isAlive && t.id !== p.id);
            const target = targets[Math.floor(Math.random() * targets.length)];
            if (target) { changed = true; return { ...p, voteTarget: target.id, hasActed: true }; }
          }
          if (prev.phase === 'DAY' && !p.skipAgreed && Math.random() < 0.05) { changed = true; return { ...p, skipAgreed: true }; }
          return p;
        });
        return changed ? { ...prev, players } : prev;
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [game.phase, game.day]);

  useEffect(() => {
    let interval: any;
    if (['NIGHT', 'DAY', 'VOTE', 'REVOTE'].includes(game.phase) && game.timer > 0) {
      interval = setInterval(() => { setGame(prev => ({ ...prev, timer: Math.max(0, prev.timer - 1) })); }, 1000);
    }
    return () => clearInterval(interval);
  }, [game.phase, game.timer]);

  useEffect(() => {
    if (game.phase === 'NIGHT') {
      const active = game.players.filter(p => p.isAlive && (game.day === 1 && p.roleId === 'seer' ? false : ['wolf', 'seer', 'knight'].includes(p.roleId)));
      if (active.length > 0 && active.every(p => p.hasActed)) resolveNight();
    } else if (game.phase === 'DAY') {
      const survivors = game.players.filter(p => p.isAlive);
      const agreed = survivors.filter(p => p.skipAgreed).length;
      if (survivors.length > 0 && agreed >= Math.ceil(survivors.length / 2)) {
        postGlobal("過半数が同意したため議論を終了します。");
        setGame(prev => ({ ...prev, phase: 'VOTE', timer: VOTE_LIMIT }));
      }
    } else if (game.phase === 'VOTE' || game.phase === 'REVOTE') {
      const voters = game.players.filter(p => p.isAlive);
      if (voters.length > 0 && voters.every(p => p.hasActed)) resolveVote();
    }
    if (game.timer === 0 && ['NIGHT', 'DAY', 'VOTE', 'REVOTE'].includes(game.phase)) {
      if (game.phase === 'NIGHT') resolveNight();
      if (game.phase === 'DAY') setGame(prev => ({ ...prev, phase: 'VOTE', timer: VOTE_LIMIT }));
      if (game.phase === 'VOTE' || game.phase === 'REVOTE') resolveVote();
    }
  }, [game.players, game.timer, game.phase]);

  const prefersReducedMotion = typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;

  if (screen === 'HOME') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-slate-900 overflow-hidden relative">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl rotate-3">
            <Ghost size={40} className="text-white"/>
          </div>
          <h1 className="text-4xl font-black italic text-white mb-1">WEREWOLF <span className="text-blue-500">PRO</span></h1>
          <p className="text-slate-400 font-bold uppercase tracking-widest text-[8px]">The Ultimate Game Master</p>
        </div>
        <div className="w-full max-sm space-y-8">
          {resumeHistory.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4 flex items-center gap-2"><Clock size={12}/> 最近の村</h2>
              <div className="grid gap-2">
                {resumeHistory.map(record => (
                  <button key={record.roomId} onClick={() => handleResumeFromRecord(record)} className="group relative flex flex-col gap-1 bg-slate-800/50 p-4 rounded-2xl border border-slate-700 hover:border-blue-500 transition-all text-left overflow-hidden">
                    <div className="flex items-center justify-between"><span className="font-black text-white text-sm">{record.roomName}</span><span className="font-mono text-[10px] text-blue-400">{record.roomId}</span></div>
                    <div className="text-[10px] text-slate-500 font-bold flex justify-between"><span>{record.displayName}</span><span>{new Date(record.lastSeenAt).toLocaleTimeString()}</span></div>
                    <div onClick={(e) => { e.stopPropagation(); setResumeHistory(prev => prev.filter(r => r.roomId !== record.roomId)); }} className="absolute -right-2 -top-2 p-4 opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400"><Trash2 size={14}/></div>
                  </button>
                ))}
              </div>
            </div>
          )}
          {errorMsg && <div className="p-4 bg-red-900/20 border border-red-500 text-red-500 rounded-2xl text-[11px] font-black">{errorMsg}</div>}
          <div className="grid grid-cols-2 gap-4">
            <button onClick={() => setScreen('CREATE')} className="flex flex-col items-center gap-4 bg-slate-800 p-6 rounded-3xl border border-slate-700 hover:border-blue-500 shadow-xl"><PlusCircle size={24} className="text-blue-500"/><div className="text-sm font-black text-white">ルーム作成</div></button>
            <button onClick={() => setScreen('JOIN')} className="flex flex-col items-center gap-4 bg-slate-800 p-6 rounded-3xl border border-slate-700 hover:border-indigo-500 shadow-xl"><LogIn size={24} className="text-indigo-500"/><div className="text-sm font-black text-white">ルーム参加</div></button>
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'CREATE') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-slate-900">
        <div className="w-full max-w-md bg-slate-800 p-8 rounded-[2.5rem] border border-slate-700 shadow-2xl space-y-8">
          <div className="flex items-center justify-between"><h2 className="text-2xl font-black text-white">ルーム作成</h2><button onClick={() => setScreen('HOME')} className="text-slate-500 hover:text-white"><XCircle size={24}/></button></div>
          <div className="space-y-4">
            <div><label className="text-[10px] font-black text-slate-500 uppercase ml-2 mb-2 block">ルーム名</label><input placeholder="例: 怪しい村" value={formRoomName} onChange={e => setFormRoomName(e.target.value)} className="w-full bg-slate-900 p-4 rounded-2xl text-white font-bold" /></div>
            <div><label className="text-[10px] font-black text-slate-500 uppercase ml-2 mb-2 block">表示名</label><input placeholder="例: たろう" value={formDisplayName} onChange={e => setFormDisplayName(e.target.value)} className="w-full bg-slate-900 p-4 rounded-2xl text-white font-bold" /></div>
            <div><label className="text-[10px] font-black text-slate-500 uppercase ml-2 mb-2 block">人数 ({formPlayerCount}人)</label><input type="range" min="5" max="12" value={formPlayerCount} onChange={e => setFormPlayerCount(parseInt(e.target.value))} className="w-full accent-blue-600" /></div>
          </div>
          <button onClick={handleCreateRoom} className="w-full bg-blue-600 py-5 rounded-2xl font-black text-white text-lg active:scale-95">ルームを作成</button>
        </div>
      </div>
    );
  }

  if (screen === 'JOIN') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-slate-900">
        <div className="w-full max-w-md bg-slate-800 p-8 rounded-[2.5rem] border border-slate-700 shadow-2xl space-y-8">
          <div className="flex items-center justify-between"><h2 className="text-2xl font-black text-white">ルーム参加</h2><button onClick={() => setScreen('HOME')} className="text-slate-500 hover:text-white"><XCircle size={24}/></button></div>
          <div className="space-y-4">
            <div><label className="text-[10px] font-black text-slate-500 uppercase ml-2 mb-2 block">ルームID</label><input placeholder="ABCD12" value={formRoomId} onChange={e => setFormRoomId(e.target.value.toUpperCase())} className="w-full bg-slate-900 p-4 rounded-2xl text-white font-mono font-black" /></div>
            {canResume && <button onClick={handleResumeSession} className="w-full py-4 bg-blue-600/20 text-blue-400 rounded-2xl font-black text-xs">既存セッションを復帰</button>}
            <div><label className="text-[10px] font-black text-slate-500 uppercase ml-2 mb-2 block">表示名</label><input placeholder="例: じろう" value={formDisplayName} onChange={e => setFormDisplayName(e.target.value)} className="w-full bg-slate-900 p-4 rounded-2xl text-white font-bold" /></div>
            <div><label className="text-[10px] font-black text-slate-500 uppercase ml-2 mb-2 block">パスコード</label><input maxLength={6} placeholder="000000" value={inputPasscode} onChange={e => setInputPasscode(e.target.value.replace(/\D/g, ''))} className="w-full bg-slate-900 p-4 rounded-2xl text-white font-mono font-black text-2xl tracking-[0.5em] text-center" /></div>
          </div>
          {errorMsg && <div className="p-4 bg-red-900/20 border border-red-500 text-red-500 rounded-2xl text-[11px] font-black">{errorMsg}</div>}
          <button onClick={handleJoinRoom} className="w-full bg-indigo-600 py-5 rounded-2xl font-black text-white text-lg active:scale-95">入室</button>
        </div>
      </div>
    );
  }

  if (game.phase === 'SETUP') {
    const total = (Object.values(game.roleConfig) as number[]).reduce((a, b) => a + b, 0);
    const isReady = total === game.players.length;
    return (
      <div className="max-w-xl mx-auto p-4 md:p-8 space-y-6">
        <div className="flex justify-between items-center"><h1 className="text-2xl font-black flex items-center gap-2"><Crown className="text-yellow-400"/> {game.roomName}</h1><button onClick={() => setScreen('HOME')} className="text-slate-500 hover:text-white"><RotateCcw size={20}/></button></div>
        <div className="bg-slate-800 p-6 rounded-[2rem] border border-slate-700 shadow-xl space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-700"><label className="text-[9px] font-black text-slate-500 uppercase block">Room ID</label><div className="font-mono text-xl font-black text-blue-400">{game.roomId}</div></div>
            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-700"><label className="text-[9px] font-black text-slate-500 uppercase block">Passcode</label><div className="font-mono text-xl font-black text-indigo-400">{showPasscode ? game.passcode : '••••••'}</div><button onClick={() => setShowPasscode(!showPasscode)} className="text-[9px] text-slate-500 underline">{showPasscode ? 'Hide' : 'Show'}</button></div>
          </div>
        </div>
        <div className="bg-slate-800 p-6 rounded-[2rem] border border-slate-700 shadow-xl space-y-4">
          <h2 className="text-xl font-black flex items-center gap-2"><Users className="text-blue-400"/> 参加者 ({game.players.length})</h2>
          <div className="grid gap-2">{game.players.map(p => (<div key={p.id} className="bg-slate-700/50 p-3 rounded-xl flex items-center justify-between border border-slate-600"><span className="font-bold">{p.isNPC ? '🤖 ' : ''}{p.name}{p.id === currentUser.id ? ' (YOU)' : ''}</span>{p.isHost && <Crown size={14} className="text-yellow-400"/>}</div>))}</div>
          {me?.isHost && (<button onClick={() => { const nid = `npc-${Math.random().toString(36).substr(2, 5)}`; setGame(prev => ({ ...prev, players: [...prev.players, { id: nid, name: `NPC-${nid.toUpperCase().slice(-3)}`, roleId: 'village', isAlive: true, isHost: false, isNPC: true, hasActed: false, skipAgreed: false }] })); }} className="w-full py-2 bg-slate-700 rounded-xl text-xs font-bold border border-slate-600">+ NPCを追加</button>)}
        </div>
        {me?.isHost && (
          <div className="bg-slate-800 p-6 rounded-[2rem] border border-slate-700 shadow-xl space-y-6">
            <h2 className="text-xl font-black flex items-center gap-2"><Settings className="text-purple-400"/> 配役</h2>
            <div className="grid gap-4">{Object.values(ROLES).map(role => (<div key={role.id} className="bg-slate-700/30 p-4 rounded-2xl flex items-center justify-between border border-slate-700/50"><div className="flex flex-col"><span className="text-sm font-black uppercase">{role.name}</span><p className="text-[10px] text-slate-400 font-bold">{ROLE_SELECTION_DESCRIPTIONS[role.id]}</p></div><div className="flex items-center gap-4"><button onClick={() => setGame(prev => ({ ...prev, roleConfig: { ...prev.roleConfig, [role.id]: Math.max(0, (prev.roleConfig[role.id] || 0) - 1) } }))} className="w-8 h-8 bg-slate-700 rounded-lg">-</button><span className="font-black text-xl w-6 text-center">{game.roleConfig[role.id] || 0}</span><button onClick={() => setGame(prev => ({ ...prev, roleConfig: { ...prev.roleConfig, [role.id]: (prev.roleConfig[role.id] || 0) + 1 } }))} className="w-8 h-8 bg-slate-700 rounded-lg">+</button></div></div>))}</div>
            <div className="pt-6 border-t border-slate-700"><div className={`text-sm font-black text-center mb-4 ${isReady ? 'text-green-400' : 'text-red-400'}`}>合計: {total} / {game.players.length}人</div><button onClick={startGame} disabled={!isReady} className="w-full bg-blue-600 py-5 rounded-2xl font-black text-xl transition disabled:opacity-50">ゲーム開始</button></div>
          </div>
        )}
      </div>
    );
  }

  if (game.phase === 'RESULT') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center bg-slate-900">
        <h1 className="text-5xl font-black mb-6 tracking-tighter">{game.winner === 'FOX' ? '妖狐' : game.winner === 'WEREWOLF' ? '人狼' : '村人'}陣営の勝利！</h1>
        <div className="w-full max-w-md bg-slate-800 rounded-[2.5rem] p-8 border border-slate-700 mb-8 space-y-2">{game.players.map(p => (<div key={p.id} className="flex justify-between p-4 bg-slate-900/50 rounded-2xl"><span className="font-bold">{p.name}</span><span className="font-black text-indigo-400 text-sm uppercase">{ROLES[p.roleId].name} {p.isAlive ? '' : '(死亡)'}</span></div>))}</div>
        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
          {me?.isHost && (
            <button onClick={handleRematch} className="flex-1 bg-blue-600 text-white py-5 rounded-2xl font-black text-xl shadow-xl hover:bg-blue-500 transition active:scale-95">再戦する</button>
          )}
          <button onClick={handleGoHome} className="flex-1 bg-white text-slate-900 py-5 rounded-2xl font-black text-xl shadow-xl hover:bg-slate-100 transition active:scale-95">ホームに戻る</button>
        </div>
      </div>
    );
  }

  const isW = me && ROLES[me.roleId].team === 'WEREWOLF' && me.roleId !== 'madman';
  const channels: ChatChannel[] = ['GLOBAL'];
  if (me && !me.isAlive) channels.push('DEAD');
  if (isW && me?.isAlive) channels.push('WOLVES');
  channels.push('BOT_DM');

  const filtered = game.messages.filter(m => {
    if (m.channel === 'GLOBAL') return true;
    if (m.channel === 'DEAD') return me && !me.isAlive;
    if (m.channel === 'WOLVES') return isW && me?.isAlive;
    if (m.channel === 'BOT_DM') return m.recipientId === currentUser.id || m.senderId === currentUser.id;
    return false;
  });

  const survivors = game.players.filter(p => p.isAlive);
  const agreeCount = survivors.filter(p => p.skipAgreed).length;
  const neededCount = Math.ceil(survivors.length / 2);

  return (
    <div className="h-screen flex flex-col bg-slate-900 text-white overflow-hidden">
      {/* 襲撃演出オーバーレイ */}
      {attackEffect && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black overflow-hidden pointer-events-auto">
          <style>{`
            @keyframes shake-screen {
              0%, 100% { transform: translate(0,0); }
              10%, 30%, 50%, 70%, 90% { transform: translate(-8px, -8px); }
              20%, 40%, 60%, 80% { transform: translate(8px, 8px); }
            }
            .animate-attack-shake {
              animation: shake-screen 0.2s cubic-bezier(.36,.07,.19,.97) both infinite;
            }
            @keyframes wolf-eyes {
              0% { opacity: 0; transform: scale(0.2); filter: blur(10px); }
              40% { opacity: 1; transform: scale(1); filter: blur(0px); }
              100% { opacity: 1; transform: scale(1.4); }
            }
            .animate-eyes {
              animation: wolf-eyes 2s ease-out forwards;
            }
            @keyframes blood-flash {
              0% { background: transparent; }
              60% { background: rgba(185, 28, 28, 0.5); }
              100% { background: black; }
            }
            .animate-blood {
              animation: blood-flash 2.5s ease-in forwards;
            }
          `}</style>
          
          <div className={`absolute inset-0 bg-black ${prefersReducedMotion ? '' : 'animate-blood'}`} />
          
          <div className={`relative flex flex-col items-center justify-center ${prefersReducedMotion ? '' : 'animate-attack-shake'}`}>
            <div className="flex gap-16 mb-12 animate-eyes">
              <div className="w-8 h-4 bg-red-600 rounded-full shadow-[0_0_35px_rgba(220,38,38,1)] rotate-[-15deg]" />
              <div className="w-8 h-4 bg-red-600 rounded-full shadow-[0_0_35px_rgba(220,38,38,1)] rotate-[15deg]" />
            </div>
            <div className="text-red-600 font-black italic text-2xl tracking-tighter opacity-80 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
              ……！
            </div>
          </div>
        </div>
      )}

      <header className="bg-slate-800 border-b border-slate-700 p-4 flex items-center justify-between shadow-lg z-10">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${game.phase === 'NIGHT' ? 'bg-indigo-900 text-indigo-300' : 'bg-yellow-900 text-yellow-300'}`}>{game.phase === 'NIGHT' ? <Moon size={20}/> : <Sun size={20}/>}</div>
          <div><div className="text-[10px] font-black opacity-40 uppercase">Day {game.day} - {game.phase}</div><div className="text-base font-black">{game.phase === 'NIGHT' ? '夜' : game.phase === 'DAY' ? '議論' : '投票'}</div></div>
        </div>
        <div className="text-right"><div className="text-[9px] opacity-40 font-black uppercase">Timer</div><div className={`text-2xl font-mono font-black tabular-nums ${game.timer < 30 ? 'text-red-500 animate-pulse' : 'text-blue-400'}`}>{Math.floor(game.timer / 60)}:{String(game.timer % 60).padStart(2, '0')}</div></div>
      </header>
      <div className="flex bg-slate-800 border-b border-slate-700 overflow-x-auto scrollbar-hide">{channels.map(ch => (<button key={ch} onClick={() => setActiveChannel(ch)} className={`flex-1 min-w-[100px] p-4 text-[10px] font-black transition-all border-b-4 ${activeChannel === ch ? 'text-blue-400 border-blue-400 bg-blue-500/5' : 'opacity-30 border-transparent'}`}>{ch === 'GLOBAL' ? '全体' : ch === 'DEAD' ? '霊界' : ch === 'WOLVES' ? '人狼' : 'Bot'}</button>))}</div>
      <div className="flex-1 relative overflow-hidden">
        <div ref={chatContainerRef} onScroll={(e) => { const {scrollTop, scrollHeight, clientHeight} = e.currentTarget; setIsAtBottom(scrollHeight - scrollTop - clientHeight < 150); }} className="h-full overflow-y-auto p-4 space-y-6 bg-slate-950/20 scroll-smooth">
          {filtered.map((m) => (<div key={m.id} className={`flex ${m.senderId === currentUser.id ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[85%] rounded-[1.5rem] p-4 ${m.senderId === 'bot' ? 'bg-slate-800 italic border-l-4 border-l-blue-500' : m.senderId === currentUser.id ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-slate-800 text-white rounded-tl-none'}`}>{m.senderId !== currentUser.id && (<div className="text-[10px] font-black mb-1 opacity-50 flex items-center gap-2"><span>{m.senderName}</span><span className="text-[8px] bg-slate-900 px-1 rounded">{m.channel}</span></div>)}<div className="text-sm whitespace-pre-wrap leading-relaxed">{m.content}</div></div></div>))}
          <div ref={chatEndRef} />
        </div>
        {!isAtBottom && (<button onClick={jumpToLatest} className="absolute bottom-6 right-6 bg-blue-600/90 text-white p-3 rounded-full shadow-2xl flex items-center gap-1 hover:bg-blue-500 transition-colors animate-in slide-in-from-bottom-2"><ChevronDown size={24}/><span className="text-[10px] font-black uppercase pr-1">最新へ</span></button>)}
      </div>
      {activeChannel === 'BOT_DM' && me?.isAlive && (
        <div className="bg-slate-800 p-4 border-t border-slate-700 space-y-4 rounded-t-3xl shadow-2xl relative z-20">
          {game.phase === 'DAY' && (
            <div className="space-y-3">
              <div className="text-center text-[11px] font-black text-blue-400 uppercase tracking-widest bg-blue-500/10 py-2 rounded-xl border border-blue-500/20">
                投票スキップ同意：{agreeCount} / {neededCount}
              </div>
              <button onClick={() => setGame(prev => ({ ...prev, players: prev.players.map(p => p.id === currentUser.id ? { ...p, skipAgreed: !p.skipAgreed } : p) }))} className={`w-full py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all ${me.skipAgreed ? 'bg-green-600 text-white shadow-lg shadow-green-500/20' : 'bg-slate-700 text-slate-300'}`}>{me.skipAgreed ? <CheckCircle2 size={16}/> : <XCircle size={16}/>} 投票をスキップ</button>
            </div>
          )}
          {((game.phase === 'NIGHT' && !me.hasActed && ['wolf', 'seer', 'knight'].includes(me.roleId) && !(game.day === 1 && me.roleId === 'seer')) || ((game.phase === 'VOTE' || game.phase === 'REVOTE') && !me.hasActed)) && (
            <div className="space-y-3"><div className="text-blue-400 font-black text-[10px] uppercase ml-1 flex items-center gap-1"><ArrowRight size={12}/> 対象を選択してください</div><div className="grid grid-cols-2 gap-2">{game.players.filter(p => p.isAlive && p.id !== currentUser.id).map(p => (<button key={p.id} onClick={() => handleAction(p.id)} className="bg-slate-900 p-3 rounded-xl text-xs font-bold border border-slate-700 hover:border-blue-500 transition-all active:scale-95 flex items-center gap-2 truncate"><UserIcon size={12}/> <span className="truncate">{p.name}</span></button>))}</div></div>
          )}
          {me.hasActed && (game.phase !== 'DAY') && (<div className="flex items-center justify-center gap-2 text-green-400 font-black text-sm p-4 bg-slate-900 rounded-2xl border border-green-500/20"><UserCheck size={20}/> 提出完了</div>)}
        </div>
      )}
      <form onSubmit={handleSendMessage} className="p-4 bg-slate-800 border-t border-slate-700 flex gap-2 relative z-10 shadow-[0_-4px_10px_rgba(0,0,0,0.1)]">
        <input value={inputMessage} onChange={e => setInputMessage(e.target.value)} placeholder={`${activeChannel} チャット...`} className="flex-1 bg-slate-900 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none border border-slate-700 transition-all" />
        <button type="submit" className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg hover:bg-blue-500 transition-colors active:scale-90"><Send size={20}/></button>
      </form>
    </div>
  );
}
