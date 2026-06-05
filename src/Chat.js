import VideoCall from './VideoCall';
import AudioCall from './AudioCall';
import { setupNotifications, sendNotification, showInAppNotification, listenForMessages, setBadgeCount } from './notifications';
import { useState, useEffect, useRef } from 'react';
import { db } from './firebase';
import {
  collection, addDoc, onSnapshot, orderBy, query,
  serverTimestamp, doc, setDoc, updateDoc, deleteDoc,
  writeBatch, where
} from 'firebase/firestore';
import EmojiPicker from 'emoji-picker-react';

const IMGBB_KEY = 'a821cbedca0d4e5c5d56526b2e15db73';

// ── Ticks ────────────────────────────────────────────────────────
function Ticks({ status }) {
  if (!status) return null;
  const grey = '#A0692E', pink = '#E879A0';
  if (status === 'sent') return (
    <svg width="14" height="10" viewBox="0 0 14 10" style={{ display:'inline-block', verticalAlign:'middle' }}>
      <polyline points="1,5 4.5,8.5 10,2" fill="none" stroke={grey} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
  if (status === 'delivered') return (
    <svg width="18" height="10" viewBox="0 0 18 10" style={{ display:'inline-block', verticalAlign:'middle' }}>
      <polyline points="1,5 4.5,8.5 10,2" fill="none" stroke={grey} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <polyline points="5,5 8.5,8.5 14,2" fill="none" stroke={grey} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
  return (
    <svg width="18" height="10" viewBox="0 0 18 10" style={{ display:'inline-block', verticalAlign:'middle' }}>
      <polyline points="1,5 4.5,8.5 10,2" fill="none" stroke={pink} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <polyline points="5,5 8.5,8.5 14,2" fill="none" stroke={pink} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ── Wallpaper ────────────────────────────────────────────────────
const wallpaperStyle = {
  background: 'linear-gradient(160deg, #FFF5F7 0%, #FFF0F5 40%, #FDF5FF 70%, #FFF8F2 100%)',
};

// ── Date divider ─────────────────────────────────────────────────
function DateDivider({ label }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', margin:'8px 0' }}>
      <div style={{ background:'rgba(232,121,160,0.15)', borderRadius:12, padding:'3px 12px', fontSize:11, color:'rgba(180,60,100,0.7)', fontFamily:'Arial,sans-serif' }}>{label}</div>
    </div>
  );
}

// ── Group by date ────────────────────────────────────────────────
function groupByDate(messages) {
  const groups = []; let lastDate = null;
  messages.forEach(msg => {
    const d = msg.createdAt?.toDate ? msg.createdAt.toDate() : null;
    const label = d ? d.toLocaleDateString([], { weekday:'long', day:'numeric', month:'long' }) : null;
    if (label && label !== lastDate) { groups.push({ type:'date', label }); lastDate = label; }
    groups.push({ type:'msg', msg });
  });
  return groups;
}

// ── Detect URL ───────────────────────────────────────────────────
function detectLinks(text) { return text.match(/(https?:\/\/[^\s]+)/g) || []; }

// ── Link Preview ─────────────────────────────────────────────────
function LinkPreview({ url, isMine }) {
  const isIG = url.includes('instagram.com');
  const isFB = url.includes('facebook.com') || url.includes('fb.com');
  const isYT = url.includes('youtube.com') || url.includes('youtu.be');
  const icon = isIG?'📸':isFB?'💬':isYT?'▶️':'🔗';
  const label = isIG?'Instagram':isFB?'Facebook':isYT?'YouTube':'Link';
  const color = isIG?'#E1306C':isFB?'#1877F2':isYT?'#FF0000':'#8B5A20';
  const short = url.length > 40 ? url.slice(0,40)+'…' : url;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" style={{ textDecoration:'none', display:'block', marginTop:6 }}>
      <div style={{ background: isMine?'rgba(0,0,0,0.15)':'#FDF6ED', borderRadius:12, padding:'8px 12px', border:`1.5px solid ${isMine?'rgba(255,255,255,0.2)':'rgba(200,149,108,0.3)'}`, display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ width:34, height:34, borderRadius:10, background:color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>{icon}</div>
        <div style={{ minWidth:0 }}>
          <div style={{ fontSize:11, fontWeight:700, color: isMine?'rgba(255,255,255,0.9)':color, fontFamily:'Arial,sans-serif' }}>{label}</div>
          <div style={{ fontSize:10, color: isMine?'rgba(255,255,255,0.6)':'#A0692E', fontFamily:'Arial,sans-serif', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{short}</div>
        </div>
      </div>
    </a>
  );
}

// ── Upload progress ───────────────────────────────────────────────
function UploadProgress({ progress, fileName }) {
  return (
    <div style={{ background:'#FFFFFF', borderRadius:16, padding:'12px 14px', boxShadow:'0 2px 8px rgba(139,90,32,0.15)', border:'1px solid rgba(200,149,108,0.2)', maxWidth:'70%', alignSelf:'flex-end' }}>
      <div style={{ fontSize:12, color:'#5C3810', fontFamily:'Arial,sans-serif', marginBottom:6, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:180 }}>{fileName}</div>
      <div style={{ background:'#F0E4D0', borderRadius:6, height:6, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${progress}%`, background:'linear-gradient(90deg,#E879A0,#A855D4)', transition:'width 0.3s', borderRadius:6 }}/>
      </div>
      <div style={{ fontSize:10, color:'#A0692E', marginTop:4, fontFamily:'Arial,sans-serif', textAlign:'right' }}>{Math.round(progress)}%</div>
    </div>
  );
}

// ── Media expiry ──────────────────────────────────────────────────
function MediaExpiry({ expiresAt }) {
  const [timeLeft, setTimeLeft] = useState('');
  const [urgent, setUrgent] = useState(false);
  useEffect(() => {
    const update = () => {
      if (!expiresAt?.toDate) return;
      const left = expiresAt.toDate().getTime() - Date.now();
      if (left <= 0) { setTimeLeft('Expired'); return; }
      const mins = Math.floor(left/60000), secs = Math.floor((left%60000)/1000);
      setUrgent(mins < 5);
      setTimeLeft(mins >= 60 ? '~1h' : mins > 0 ? `${mins}m ${secs}s` : `${secs}s`);
    };
    update(); const iv = setInterval(update, 1000); return () => clearInterval(iv);
  }, [expiresAt]);
  if (!timeLeft) return null;
  return (
    <div style={{ display:'flex', alignItems:'center', gap:3, padding:'2px 7px', borderRadius:8, background: urgent?'rgba(220,60,60,0.7)':'rgba(0,0,0,0.4)', position:'absolute', bottom:6, left:6 }}>
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2"/><path d="M12 6v6l4 2" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
      <span style={{ fontSize:9, color:'white', fontFamily:'Arial,sans-serif', fontWeight:600 }}>{timeLeft}</span>
    </div>
  );
}

// ── Message content ───────────────────────────────────────────────
function MessageContent({ msg, isMine }) {
  const [imgOpen, setImgOpen] = useState(false);
  const links = msg.text ? detectLinks(msg.text) : [];
  if (msg.type === 'voice') return <VoiceMessage url={msg.mediaUrl} isMine={isMine} duration={msg.duration}/>;
  if (msg.type === 'video') return (
    <div style={{ borderRadius:14, overflow:'hidden', maxWidth:240, position:'relative' }}>
      <video
        src={msg.mediaUrl}
        controls
        playsInline
        style={{ width:'100%', display:'block', borderRadius:14, maxHeight:280, background:'#000' }}
      />
      <div style={{ position:'absolute', bottom:6, right:8, background:'rgba(0,0,0,0.5)', borderRadius:8, padding:'2px 6px', display:'flex', alignItems:'center', gap:3 }}>
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2"/><path d="M12 6v6l4 2" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
        <span style={{ fontSize:9, color:'white', fontFamily:"'Lato',sans-serif" }}>1h</span>
      </div>
    </div>
  );
  if (msg.type === 'image') return (
    <>
      <div onClick={() => setImgOpen(true)} style={{ cursor:'zoom-in', borderRadius:12, overflow:'hidden', maxWidth:220, position:'relative' }}>
        <img src={msg.mediaUrl} alt="shared" style={{ width:'100%', display:'block', borderRadius:12 }} loading="lazy"/>
        <MediaExpiry expiresAt={msg.expiresAt}/>
      </div>
      {imgOpen && (
        <div onClick={() => setImgOpen(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.92)', zIndex:3000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <img src={msg.mediaUrl} alt="full" style={{ maxWidth:'100%', maxHeight:'90vh', borderRadius:12, objectFit:'contain' }}/>
          <button onClick={() => setImgOpen(false)} style={{ position:'absolute', top:20, right:20, background:'rgba(255,255,255,0.15)', border:'none', borderRadius:'50%', width:40, height:40, color:'white', fontSize:20, cursor:'pointer' }}>✕</button>
        </div>
      )}
    </>
  );
  const textParts = msg.text ? msg.text.split(/(https?:\/\/[^\s]+)/g) : [];
  return (
    <div>
      <div style={{ fontSize:14, color: isMine ? 'white' : '#3C2010', lineHeight:1.5, wordBreak:'break-word' }}>
        {textParts.map((part, i) => part.match(/^https?:\/\//) ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{ color: isMine?'rgba(255,255,255,0.9)':'#8B5A20', textDecoration:'underline' }}>{part}</a>
        ) : part)}
      </div>
      {links.map((url, i) => <LinkPreview key={i} url={url} isMine={isMine}/>)}
    </div>
  );
}

// ── Reaction Picker ───────────────────────────────────────────────
const REACTIONS = ['❤️','😘','😍','🥰','😂','😢','👏','🔥'];
function ReactionPicker({ msg, coupleId, position, onClose }) {
  const pickerWidth = 50 * REACTIONS.length;
  const left = Math.max(8, Math.min(position.x - pickerWidth/2, window.innerWidth - pickerWidth - 8));
  const top  = Math.max(8, position.y - 72);
  const handleReact = async (emoji) => {
    try {
      const existing = msg.reactions || {};
      await updateDoc(doc(db,'chats',coupleId,'messages',msg.id), { reactions: { ...existing, [emoji]:(existing[emoji]||0)+1 } });
    } catch {} onClose();
  };
  return (
    <div style={{ position:'fixed', inset:0, zIndex:1200 }} onMouseDown={e=>{e.preventDefault();onClose();}} onTouchStart={e=>{e.preventDefault();onClose();}}>
      <div onMouseDown={e=>e.stopPropagation()} onTouchStart={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}
        style={{ position:'fixed', top, left, background:'#FFFFFF', borderRadius:50, padding:'7px 10px', display:'flex', gap:2, boxShadow:'0 8px 32px rgba(139,90,32,0.25)', border:'1px solid rgba(200,149,108,0.2)', zIndex:1201, animation:'reactionPop 0.25s cubic-bezier(0.34,1.56,0.64,1)', userSelect:'none' }}>
        {REACTIONS.map((emoji,i) => (
          <button key={emoji}
            onMouseDown={e=>{e.preventDefault();e.stopPropagation();handleReact(emoji);}}
            onTouchEnd={e=>{e.preventDefault();e.stopPropagation();handleReact(emoji);}}
            style={{ background:'none', border:'none', cursor:'pointer', fontSize:28, padding:'4px', borderRadius:'50%', lineHeight:1, WebkitTapHighlightColor:'transparent', animation:`reactionBounce 0.3s ${i*0.04}s cubic-bezier(0.34,1.56,0.64,1) both`, transition:'transform 0.15s' }}
            onMouseEnter={e=>e.currentTarget.style.transform='scale(1.4)'}
            onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}
          >{emoji}</button>
        ))}
      </div>
    </div>
  );
}

function ReactionBadges({ reactions }) {
  if (!reactions || !Object.keys(reactions).length) return null;
  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:3, marginTop:3 }}>
      {Object.entries(reactions).map(([emoji,count]) => (
        <div key={emoji} style={{ background:'rgba(255,255,255,0.9)', borderRadius:12, padding:'2px 6px', fontSize:12, border:'1px solid rgba(200,149,108,0.25)', display:'flex', alignItems:'center', gap:2 }}>
          <span>{emoji}</span>
          {count > 1 && <span style={{ fontSize:10, color:'#8B5A20', fontWeight:700 }}>{count}</span>}
        </div>
      ))}
    </div>
  );
}

// ── Kiss Effect ───────────────────────────────────────────────────
function KissEffect({ position, onDone }) {
  const W = window.innerWidth, H = window.innerHeight;
  const petals = Array.from({length:14},(_,i)=>({
    id:i, x:W*0.05+Math.random()*W*0.9, size:12+Math.random()*16,
    delay:Math.random()*1.8, dur:3.5+Math.random()*2,
    sway:(Math.random()-0.5)*140,
    emoji:['🌸','🌹','💮','✨','🌺','💫'][i%6],
  }));
  useEffect(()=>{const t=setTimeout(onDone,5000);return()=>clearTimeout(t);},[onDone]);
  return (
    <div style={{position:'fixed',inset:0,zIndex:3000,pointerEvents:'none',overflow:'hidden'}}>
      {/* Cinematic dark vignette */}
      <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse at center,rgba(0,0,0,0.1) 0%,rgba(0,0,0,0.6) 100%)',animation:'kissOverlay 5s ease forwards'}}/>
      {/* Soft pink glow bloom */}
      <div style={{position:'absolute',left:position.x,top:position.y,width:10,height:10,borderRadius:'50%',boxShadow:'0 0 0 0 rgba(232,121,160,0.4)',transform:'translate(-50%,-50%)',animation:'kissGlow 4s ease forwards'}}/>
      {/* Main kiss lips — elegant rise */}
      <div style={{position:'absolute',left:position.x,top:position.y,fontSize:90,transform:'translate(-50%,-50%) scale(0)',animation:'kissMainHeart 5s cubic-bezier(0.34,1.1,0.64,1) forwards',filter:'drop-shadow(0 0 28px rgba(232,80,120,0.95))',zIndex:10}}>💋</div>
      {/* Two side hearts */}
      {[[-55,0.5,30],[55,0.8,24]].map(([x,delay,size],i)=>(
        <div key={i} style={{position:'absolute',left:position.x+x,top:position.y,fontSize:size,transform:'translate(-50%,-50%) scale(0)',opacity:0,animation:`kissSideHeart 3.5s ${delay}s ease forwards`,filter:'drop-shadow(0 0 8px rgba(232,121,160,0.8))'}}>💋</div>
      ))}
      {/* Elegant text */}
      <div style={{position:'absolute',left:'50%',top:'28%',transform:'translateX(-50%) translateY(8px)',opacity:0,animation:'kissText 5s 0.6s ease forwards',textAlign:'center'}}>
        <p style={{fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:20,fontStyle:'italic',fontWeight:300,color:'rgba(255,255,255,0.92)',margin:0,letterSpacing:'3px',textShadow:'0 2px 16px rgba(232,121,160,0.9)',whiteSpace:'nowrap'}}>Mmmmuuuaaahhh 💋</p>
      </div>
      {/* Subtle ripple rings */}
      {[0,0.35,0.7].map((delay,i)=>(
        <div key={i} style={{position:'absolute',left:position.x,top:position.y,width:8,height:8,borderRadius:'50%',border:'1px solid rgba(232,121,160,0.5)',transform:'translate(-50%,-50%)',animation:`kissRipple 2s ${delay}s ease-out forwards`}}/>
      ))}
      {/* Rose petals floating up */}
      {petals.map(p=>(
        <div key={p.id} style={{position:'absolute',left:p.x,top:H+10,fontSize:p.size,opacity:0,animation:`kissRose ${p.dur}s ${p.delay}s ease-out forwards`,'--sway':`${p.sway}px`}}>{p.emoji}</div>
      ))}
      <style>{`
        @keyframes kissOverlay{0%{opacity:0}8%{opacity:1}85%{opacity:1}100%{opacity:0}}
        @keyframes kissGlow{0%{box-shadow:0 0 0 0 rgba(232,121,160,0.4)}30%{box-shadow:0 0 80px 80px rgba(232,121,160,0.18)}80%{box-shadow:0 0 120px 120px rgba(232,121,160,0.08)}100%{box-shadow:0 0 0 0 rgba(232,121,160,0)}}
        @keyframes kissMainHeart{0%{opacity:0;transform:translate(-50%,-50%) scale(0) rotate(-10deg)}25%{opacity:1;transform:translate(-50%,-55%) scale(1.1) rotate(4deg)}50%{transform:translate(-50%,-60%) scale(1) rotate(0deg)}85%{opacity:0.8;transform:translate(-50%,-75%) scale(0.88)}100%{opacity:0;transform:translate(-50%,-95%) scale(0.7)}}
        @keyframes kissSideHeart{0%{opacity:0;transform:translate(-50%,-50%) scale(0)}25%{opacity:0.85;transform:translate(-50%,-50%) scale(1)}100%{opacity:0;transform:translate(-50%,-250%) scale(0.5)}}
        @keyframes kissText{0%{opacity:0;transform:translateX(-50%) translateY(8px)}15%{opacity:1;transform:translateX(-50%) translateY(0)}75%{opacity:1}100%{opacity:0;transform:translateX(-50%) translateY(-8px)}}
        @keyframes kissRipple{0%{width:8px;height:8px;opacity:0.7;margin:0}100%{width:180px;height:180px;opacity:0;margin:-86px 0 0 -86px}}
        @keyframes kissRose{0%{opacity:0;transform:translateY(0) rotate(0deg)}8%{opacity:0.9}100%{opacity:0;transform:translateY(-110vh) translateX(var(--sway)) rotate(380deg)}}
      `}</style>
    </div>
  );
}

// ── Voice Message Player ──────────────────────────────────────────
function VoiceMessage({ url, isMine, duration }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef(null);

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play(); setPlaying(true); }
  };

  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'4px 0', minWidth:160 }}>
      <audio ref={audioRef} src={url}
        onEnded={() => { setPlaying(false); setProgress(0); }}
        onTimeUpdate={e => setProgress((e.target.currentTime / (e.target.duration||1)) * 100)}
      />
      <button onClick={toggle} style={{ width:36, height:36, borderRadius:'50%', background: isMine?'rgba(255,255,255,0.3)':'linear-gradient(135deg,#E879A0,#A855D4)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        {playing
          ? <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
          : <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg>
        }
      </button>
      <div style={{ flex:1 }}>
        <div style={{ height:3, borderRadius:3, background: isMine?'rgba(255,255,255,0.25)':'rgba(232,121,160,0.2)', overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${progress}%`, background: isMine?'rgba(255,255,255,0.8)':'linear-gradient(90deg,#E879A0,#A855D4)', transition:'width 0.1s', borderRadius:3 }}/>
        </div>
        <span style={{ fontSize:10, color: isMine?'rgba(255,255,255,0.7)':'rgba(180,80,120,0.6)', fontFamily:"'Lato',sans-serif", marginTop:2, display:'block' }}>
          {duration ? `${Math.floor(duration/60)}:${String(Math.floor(duration%60)).padStart(2,'0')}` : '🎤'}
        </span>
      </div>
    </div>
  );
}

// ── Can unsend ────────────────────────────────────────────────────
function canUnsend(msg) {
  if (!msg.createdAt?.toDate) return false;
  return Date.now() - msg.createdAt.toDate().getTime() < 5 * 60 * 1000;
}

// ── Message menu ──────────────────────────────────────────────────
function MessageMenu({ msg, isMine, coupleId, onClose }) {
  const [timeLeft, setTimeLeft] = useState('');
  const canUnsendNow = isMine && canUnsend(msg);
  useEffect(() => {
    if (!canUnsendNow) return;
    const iv = setInterval(() => {
      const left = 5*60*1000 - (Date.now() - msg.createdAt.toDate().getTime());
      if (left <= 0) { clearInterval(iv); onClose(); return; }
      const m = Math.floor(left/60000), s = Math.floor((left%60000)/1000);
      setTimeLeft(`${m}:${s.toString().padStart(2,'0')}`);
    }, 1000);
    return () => clearInterval(iv);
  }, [canUnsendNow]);
  const handleUnsend = async () => { try { await deleteDoc(doc(db,'chats',coupleId,'messages',msg.id)); } catch {} onClose(); };
  const handleDeleteForMe = async () => { try { await updateDoc(doc(db,'chats',coupleId,'messages',msg.id),{deletedFor:msg.senderEmail}); } catch {} onClose(); };
  return (
    <div style={{ position:'fixed', inset:0, zIndex:999, display:'flex', alignItems:'center', justifyContent:'center' }} onClick={onClose}>
      <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.35)' }}/>
      <div onClick={e=>e.stopPropagation()} style={{ background:'#FFFFFF', borderRadius:20, overflow:'hidden', minWidth:220, boxShadow:'0 8px 32px rgba(139,90,32,0.25)', zIndex:1000, border:'1px solid rgba(200,149,108,0.2)' }}>
        <div style={{ padding:'13px 18px 10px', borderBottom:'1px solid #F0E4D0', background:'#FDF6ED' }}>
          <p style={{ margin:0, fontSize:13, color:'#5C3810', fontFamily:'Arial,sans-serif', maxWidth:220, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {msg.type==='image'?'📷 Photo':msg.type==='video'?'🎥 Video':`"${msg.text}"`}
          </p>
        </div>
        {canUnsendNow && (
          <button onClick={handleUnsend} style={{ width:'100%', padding:'13px 18px', background:'none', border:'none', borderBottom:'1px solid #F0E4D0', cursor:'pointer', textAlign:'left', display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:36, height:36, borderRadius:'50%', background:'rgba(192,57,43,0.1)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="#C0392B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div>
              <div style={{ fontSize:14, fontWeight:600, color:'#C0392B', fontFamily:'Arial,sans-serif' }}>Unsend</div>
              <div style={{ fontSize:11, color:'#A0692E', fontFamily:'Arial,sans-serif' }}>Removes for both · {timeLeft} left</div>
            </div>
          </button>
        )}
        <button onClick={handleDeleteForMe} style={{ width:'100%', padding:'13px 18px', background:'none', border:'none', borderBottom:'1px solid #F0E4D0', cursor:'pointer', textAlign:'left', display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:36, height:36, borderRadius:'50%', background:'rgba(200,149,108,0.12)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="#8B5A20" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <div>
            <div style={{ fontSize:14, fontWeight:600, color:'#5C3810', fontFamily:'Arial,sans-serif' }}>Delete for me</div>
            <div style={{ fontSize:11, color:'#A0692E', fontFamily:'Arial,sans-serif' }}>Only removes from your screen</div>
          </div>
        </button>
        <button onClick={onClose} style={{ width:'100%', padding:'13px 18px', background:'none', border:'none', cursor:'pointer', textAlign:'center' }}>
          <span style={{ fontSize:14, color:'#A0692E', fontFamily:'Arial,sans-serif', fontWeight:600 }}>Cancel</span>
        </button>
      </div>
    </div>
  );
}

// ── Nickname modal ────────────────────────────────────────────────
function NicknameModal({ myName, partnerName, myNickname, partnerNickname, onSave, onClose }) {
  const [myNick, setMyNick] = useState(myNickname||''), [partnerNick, setPartnerNick] = useState(partnerNickname||'');
  const suggestions = ['Babe','Sanu','Jaan','Love','Baby','Cutie','Sweetheart','Honey'];
  return (
    <div style={{ position:'fixed', inset:0, zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }} onClick={onClose}>
      <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.4)' }}/>
      <div onClick={e=>e.stopPropagation()} style={{ background:'#FFFFFF', borderRadius:24, overflow:'hidden', width:'88%', maxWidth:320, boxShadow:'0 12px 40px rgba(139,90,32,0.25)', zIndex:1001 }}>
        <div style={{ background:'linear-gradient(135deg,#E879A0,#A855D4)', padding:'16px 20px' }}>
          <div style={{ fontSize:16, fontWeight:700, color:'white', fontFamily:'Arial,sans-serif' }}>Set Nicknames 💛</div>
          <div style={{ fontSize:11, color:'rgba(255,255,255,0.8)', marginTop:2, fontFamily:'Arial,sans-serif' }}>Only visible to you</div>
        </div>
        <div style={{ padding:'20px' }}>
          {[['Your nickname',myNick,setMyNick,myName],["Partner's nickname",partnerNick,setPartnerNick,partnerName]].map(([label,val,setter,ph])=>(
            <div key={label} style={{ marginBottom:14 }}>
              <label style={{ fontSize:11, color:'#A0692E', fontFamily:'Arial,sans-serif', letterSpacing:'0.5px', textTransform:'uppercase', fontWeight:600 }}>{label}</label>
              <input value={val} onChange={e=>setter(e.target.value)} placeholder={ph} maxLength={20}
                style={{ width:'100%', marginTop:6, padding:'10px 14px', borderRadius:18, border:'1.5px solid rgba(200,149,108,0.4)', background:'#FDFAF5', color:'#3C2010', fontSize:14, outline:'none', boxSizing:'border-box', fontFamily:'Arial,sans-serif' }}/>
            </div>
          ))}
          <div style={{ marginBottom:18 }}>
            <div style={{ fontSize:11, color:'#A0692E', fontFamily:'Arial,sans-serif', marginBottom:8 }}>Quick suggestions</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {suggestions.map(s=>(
                <button key={s} onClick={()=>setPartnerNick(s)} style={{ padding:'5px 12px', borderRadius:14, border:'1px solid rgba(200,149,108,0.4)', background:partnerNick===s?'linear-gradient(135deg,#E879A0,#A855D4)':'#FDF6ED', color:partnerNick===s?'white':'#8B5A20', fontSize:12, cursor:'pointer', fontFamily:'Arial,sans-serif' }}>{s}</button>
              ))}
            </div>
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={onClose} style={{ flex:1, padding:'11px', borderRadius:18, border:'1.5px solid #E8D5B8', background:'#FDF6ED', color:'#8B5A20', fontSize:13, cursor:'pointer', fontFamily:'Arial,sans-serif', fontWeight:600 }}>Cancel</button>
            <button onClick={()=>onSave(myNick.trim(),partnerNick.trim())} style={{ flex:2, padding:'11px', borderRadius:18, border:'none', background:'linear-gradient(135deg,#E879A0,#A855D4)', color:'white', fontSize:13, cursor:'pointer', fontFamily:'Arial,sans-serif', fontWeight:700 }}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Greeting Popup ────────────────────────────────────────────────
function GreetingPopup({ name, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 2800); return () => clearTimeout(t); }, [onDone]);
  return (
    <div style={{ position:'fixed', inset:0, zIndex:4000, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
      {/* Backdrop blur */}
      <div style={{ position:'absolute', inset:0, background:'rgba(255,240,245,0.5)', backdropFilter:'blur(4px)', animation:'greetFade 2.8s ease forwards' }}/>
      {/* Main greeting */}
      <div style={{ position:'relative', zIndex:1, textAlign:'center', animation:'greetPop 2.8s cubic-bezier(0.34,1.2,0.64,1) forwards' }}>
        <div style={{ fontSize:72, animation:'greetHeart 1.4s ease-in-out infinite', filter:'drop-shadow(0 4px 24px rgba(220,30,70,0.6))', marginBottom:8 }}>❤️</div>
        <h1 style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:42, fontWeight:400, fontStyle:'italic', color:'#2D0A0A', margin:0, letterSpacing:'2px', textShadow:'0 2px 20px rgba(232,121,160,0.4)' }}>
          Hello {name}
        </h1>
      </div>
      <style>{`
        @keyframes greetFade { 0%{opacity:0} 15%{opacity:1} 70%{opacity:1} 100%{opacity:0} }
        @keyframes greetPop  { 0%{opacity:0;transform:scale(0.4) translateY(30px)} 20%{opacity:1;transform:scale(1.08) translateY(0)} 35%{transform:scale(0.97)} 50%{transform:scale(1)} 80%{opacity:1;transform:scale(1)} 100%{opacity:0;transform:scale(0.9) translateY(-20px)} }
        @keyframes greetHeart{ 0%,100%{transform:scale(1)} 30%{transform:scale(1.3)} 60%{transform:scale(1.1)} }
      `}</style>
    </div>
  );
}
function SwipeableMessage({ isMine, onReply, onLongPress, children }) {
  const startXRef=useRef(null), currentXRef=useRef(0), longPressRef=useRef(null);
  const [offset,setOffset]=useState(0), [showing,setShowing]=useState(false);
  const THRESHOLD=60;
  const onTouchStart=e=>{ startXRef.current=e.touches[0].clientX; currentXRef.current=0; longPressRef.current=setTimeout(()=>{ window.getSelection()?.removeAllRanges(); onLongPress({x:e.touches[0].clientX,y:e.touches[0].clientY}); },500); };
  const onTouchMove=e=>{ clearTimeout(longPressRef.current); if(startXRef.current===null)return; const dx=e.touches[0].clientX-startXRef.current; const swipe=isMine?Math.min(0,dx)*-1:Math.max(0,dx); if(swipe<0)return; currentXRef.current=swipe; const capped=Math.min(swipe,THRESHOLD+10); setOffset(capped); setShowing(capped>20); };
  const onTouchEnd=()=>{ clearTimeout(longPressRef.current); if(currentXRef.current>=THRESHOLD){onReply();setOffset(THRESHOLD+10);setTimeout(()=>setOffset(0),120);}else setOffset(0); setShowing(false); startXRef.current=null; currentXRef.current=0; };
  return (
    <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
      style={{ position:'relative', transition:currentXRef.current===0?'transform 0.2s ease':'none', transform:`translateX(${isMine?-offset:offset}px)`, display:'flex', flexDirection:isMine?'row-reverse':'row', alignItems:'flex-end', gap:6, marginBottom:2 }}>
      {children}
      <div style={{ position:'absolute', [isMine?'left':'right']:-40, top:'50%', transform:'translateY(-50%)', width:30, height:30, borderRadius:'50%', background:'linear-gradient(135deg,#E879A0,#A855D4)', display:'flex', alignItems:'center', justifyContent:'center', opacity:showing?Math.min(1,offset/THRESHOLD):0, transition:'opacity 0.1s' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 17H5a2 2 0 01-2-2V5a2 2 0 012-2h11a2 2 0 012 2v3" stroke="white" strokeWidth="2" strokeLinecap="round"/><path d="M14 13l-3 3 3 3" stroke="white" strokeWidth="2" strokeLinecap="round"/><path d="M11 16h5a3 3 0 000-6h-1" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
      </div>
    </div>
  );
}

// ── Chat ──────────────────────────────────────────────────────────
function Chat({ user: initialUser, onLogout, onOpenProfile }) {
  const [user, setUser]                       = useState(initialUser);
  const [partnerData, setPartnerData]         = useState(null);
  const [messages, setMessages]               = useState([]);
  const [input, setInput]                     = useState('');
  const [showEmoji, setShowEmoji]             = useState(false);
  const [partnerTyping, setPartnerTyping]     = useState(false);
  const [inCall, setInCall]                   = useState(false);
  const [inAudioCall, setInAudioCall]         = useState(false);
  const [recording, setRecording]             = useState(false);
  const [recordSeconds, setRecordSeconds]     = useState(0);
  const [selectedMsg, setSelectedMsg]         = useState(null);
  const [showNickname, setShowNickname]       = useState(false);
  const [myNickname, setMyNickname]           = useState(() => localStorage.getItem(`nick_me_${initialUser?.email}`) || '');
  const [partnerNickname, setPartnerNickname] = useState(() => localStorage.getItem(`nick_partner_${initialUser?.email}`) || '');
  const [uploads, setUploads]                 = useState([]);
  const [showAttach, setShowAttach]           = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [replyTo, setReplyTo]                 = useState(null);
  const [reactionPicker, setReactionPicker]   = useState(null);
  const [kissEffect, setKissEffect]           = useState(null);
  const [suggestTab, setSuggestTab]           = useState('sweet');
  const [showGreeting, setShowGreeting]       = useState(true);
  const tapCountRef=useRef(0), tapTimerRef=useRef(null);
  const fileInputRef=useRef(null), bottomRef=useRef(null), inputRef=useRef(null), isVisibleRef=useRef(true);
  const mediaRecorderRef=useRef(null), recordChunksRef=useRef([]), recordTimerRef=useRef(null);

  const coupleId=user?.coupleId||'', myEmail=user?.email||'', partnerEmail=user?.partnerEmail||'', myName=user?.name||'You';

  useEffect(()=>{ const onVis=()=>{isVisibleRef.current=!document.hidden;}; document.addEventListener('visibilitychange',onVis); return()=>document.removeEventListener('visibilitychange',onVis); },[]);

  // ── Setup push notifications ──────────────────────────────────────
  useEffect(() => {
    if (!myEmail) return;
    setupNotifications(myEmail);
    listenForMessages((payload) => {
      // Show in-app banner for foreground messages
      showInAppNotification(
        payload.notification?.title || 'New message',
        payload.notification?.body  || '',
      );
    });
  }, [myEmail]);
  useEffect(()=>{ const prevent=e=>e.preventDefault(); document.addEventListener('contextmenu',prevent); document.addEventListener('selectstart',prevent); return()=>{document.removeEventListener('contextmenu',prevent);document.removeEventListener('selectstart',prevent);}; },[]);
  useEffect(()=>{ if(!user?.uid)return; return onSnapshot(doc(db,'users',user.uid),snap=>{if(snap.exists())setUser(p=>({...p,...snap.data()}));}); },[user?.uid]);
  useEffect(()=>{ if(!partnerEmail)return; const q=query(collection(db,'users'),where('email','==',partnerEmail)); return onSnapshot(q,snap=>{if(!snap.empty)setPartnerData(snap.docs[0].data());}); },[partnerEmail]);

  useEffect(()=>{
    if(!coupleId)return;
    const q=query(collection(db,'chats',coupleId,'messages'),orderBy('createdAt'));
    return onSnapshot(q,async snap=>{
      setMessages(snap.docs.map(d=>({id:d.id,...d.data()})));
      // Count unread messages from partner
      const unread = snap.docs.filter(d => d.data().senderEmail !== myEmail && d.data().status !== 'seen').length;
      setBadgeCount(unread);
      if(!isVisibleRef.current)return;
      const batch=writeBatch(db);let dirty=false;
      snap.docs.forEach(d=>{const data=d.data();if(data.senderEmail!==myEmail&&data.status!=='seen'){batch.update(d.ref,{status:'seen'});dirty=true;}});
      if(dirty)await batch.commit();
    });
  },[coupleId,myEmail]);

  useEffect(()=>{if(!coupleId||!partnerEmail)return;return onSnapshot(doc(db,'chats',coupleId,'typing',partnerEmail),snap=>{setPartnerTyping(snap.exists()&&snap.data().isTyping===true);});},[coupleId,partnerEmail]);
  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:'smooth'});},[messages,partnerTyping]);

  const updateTyping=async val=>{if(!coupleId||!myEmail)return;try{await setDoc(doc(db,'chats',coupleId,'typing',myEmail),{isTyping:val},{merge:true});}catch{}};
  const markDelivered=ref=>setTimeout(async()=>{try{await updateDoc(ref,{status:'delivered'});}catch{}},800);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      recordChunksRef.current  = [];
      mr.ondataavailable = e => { if (e.data.size > 0) recordChunksRef.current.push(e.data); };
      mr.start();
      setRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => setRecordSeconds(s => s + 1), 1000);
    } catch { alert('Microphone permission denied.'); }
  };

  const stopRecording = async (send = true) => {
    clearInterval(recordTimerRef.current);
    setRecording(false);
    const mr = mediaRecorderRef.current;
    if (!mr) return;
    mr.stop();
    mr.stream.getTracks().forEach(t => t.stop());
    if (!send) { setRecordSeconds(0); return; }
    mr.onstop = async () => {
      const blob = new Blob(recordChunksRef.current, { type:'audio/webm' });
      const dur  = recordSeconds;
      // Upload to ImgBB won't work for audio — use base64 data URL stored in Firestore (for short clips)
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result;
        const msgRef  = await addDoc(collection(db,'chats',coupleId,'messages'), {
          text:'', type:'voice', mediaUrl:dataUrl, duration:dur,
          sender:myName, senderEmail:myEmail,
          createdAt:serverTimestamp(), status:'sent',
          expiresAt:new Date(Date.now()+60*60*1000),
        });
        markDelivered(msgRef);
      };
      reader.readAsDataURL(blob);
      setRecordSeconds(0);
    };
  };

  const sendMessage=async()=>{
    const text=input.trim();if(!text||!coupleId)return;
    setInput('');setShowEmoji(false);const reply=replyTo;setReplyTo(null);await updateTyping(false);
    try{
      const msgData={text,type:'text',sender:myName,senderEmail:myEmail,createdAt:serverTimestamp(),status:'sent'};
      if(reply)msgData.replyTo={id:reply.id,text:reply.text||(reply.type==='image'?'📷 Photo':'🎥 Video'),sender:reply.sender};
      const ref=await addDoc(collection(db,'chats',coupleId,'messages'),msgData);
      markDelivered(ref);
      // Notify partner
      if (partnerEmail) sendNotification(partnerEmail, myName, text.length > 50 ? text.slice(0,50)+'…' : text);
    }catch(err){console.error(err);}
  };

  const handleFileUpload=async e=>{
    const file=e.target.files?.[0];if(!file||!coupleId)return;e.target.value='';setShowAttach(false);
    if(!file.type.startsWith('image/')){
      if(file.type.startsWith('video/')){
        if(file.size > 15 * 1024 * 1024){ alert('Video too large! Max 15MB.'); return; }
        const uploadId = Date.now().toString();
        setUploads(prev=>[...prev,{id:uploadId,progress:10,fileName:file.name}]);
        const reader = new FileReader();
        reader.onprogress = e => { if(e.lengthComputable) setUploads(prev=>prev.map(u=>u.id===uploadId?{...u,progress:Math.round((e.loaded/e.total)*85)}:u)); };
        reader.onload = async () => {
          setUploads(prev=>prev.map(u=>u.id===uploadId?{...u,progress:95}:u));
          const msgRef = await addDoc(collection(db,'chats',coupleId,'messages'),{
            text:'', type:'video', mediaUrl:reader.result,
            fileName:file.name, sender:myName, senderEmail:myEmail,
            createdAt:serverTimestamp(), status:'sent',
            expiresAt:new Date(Date.now()+60*60*1000),
          });
          markDelivered(msgRef);
          setUploads(prev=>prev.filter(u=>u.id!==uploadId));
        };
        reader.onerror = () => { setUploads(prev=>prev.filter(u=>u.id!==uploadId)); alert('Failed to load video.'); };
        reader.readAsDataURL(file);
        return;
      }
      if(file.type.startsWith('audio/')){
        // Handle as voice file
        const reader = new FileReader();
        reader.onload = async () => {
          const msgRef = await addDoc(collection(db,'chats',coupleId,'messages'),{
            text:'', type:'voice', mediaUrl:reader.result,
            fileName:file.name, duration:0,
            sender:myName, senderEmail:myEmail,
            createdAt:serverTimestamp(), status:'sent',
            expiresAt:new Date(Date.now()+60*60*1000),
          });
          markDelivered(msgRef);
        };
        reader.readAsDataURL(file);
        return;
      }
      // Document — send as text message with file name
      const msgRef = await addDoc(collection(db,'chats',coupleId,'messages'),{
        text:`📄 ${file.name} (${(file.size/1024).toFixed(0)}KB)`,
        type:'text', sender:myName, senderEmail:myEmail,
        createdAt:serverTimestamp(), status:'sent',
      });
      markDelivered(msgRef);
      return;
    }
    const uploadId=Date.now().toString();
    setUploads(prev=>[...prev,{id:uploadId,progress:10,fileName:file.name}]);
    try{
      const base64=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result.split(',')[1]);r.onerror=rej;r.readAsDataURL(file);});
      setUploads(prev=>prev.map(u=>u.id===uploadId?{...u,progress:40}:u));
      const formData=new FormData();formData.append('image',base64);formData.append('key',IMGBB_KEY);
      const res=await fetch('https://api.imgbb.com/1/upload',{method:'POST',body:formData});
      const data=await res.json();
      setUploads(prev=>prev.map(u=>u.id===uploadId?{...u,progress:90}:u));
      if(!data.success)throw new Error('Upload failed');
      setUploads(prev=>prev.filter(u=>u.id!==uploadId));
      const msgRef=await addDoc(collection(db,'chats',coupleId,'messages'),{text:'',type:'image',mediaUrl:data.data.url,fileName:file.name,sender:myName,senderEmail:myEmail,createdAt:serverTimestamp(),status:'sent',expiresAt:new Date(Date.now()+60*60*1000)});
      markDelivered(msgRef);
    }catch(err){console.error(err);setUploads(prev=>prev.filter(u=>u.id!==uploadId));alert('Upload failed.');}
  };

  const handleKey=e=>{if(e.key==='Enter'&&!e.shiftKey)sendMessage();};
  const formatTime=ts=>ts?.toDate?ts.toDate().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'';
  const partnerRealName=partnerData?.name||partnerEmail.split('@')[0]||'Partner';
  const partnerName=partnerNickname||partnerRealName;
  const displayMyName=myNickname||myName;

  const saveNicknames=(myNick,partnerNick)=>{
    setMyNickname(myNick);setPartnerNickname(partnerNick);
    localStorage.setItem(`nick_me_${myEmail}`,myNick);localStorage.setItem(`nick_partner_${myEmail}`,partnerNick);
    setShowNickname(false);
  };

  const handleScreenTap=async e=>{
    if(e.target.closest('button,input,a,.hb-bubble,canvas'))return;
    tapCountRef.current+=1;clearTimeout(tapTimerRef.current);
    if(tapCountRef.current>=3){
      tapCountRef.current=0;
      const pos={x:e.clientX||window.innerWidth/2,y:e.clientY||window.innerHeight/2};
      setKissEffect(null);setTimeout(()=>setKissEffect(pos),10);
      try{const ref=await addDoc(collection(db,'chats',coupleId,'messages'),{text:'Mmmmuuuaaahhh 💋',type:'text',sender:myName,senderEmail:myEmail,createdAt:serverTimestamp(),status:'sent'});markDelivered(ref);}catch{}
    }else{tapTimerRef.current=setTimeout(()=>{tapCountRef.current=0;},600);}
  };

  if(!coupleId)return(
    <div style={{height:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:'#FFF5F7',color:'#5C3810',fontFamily:'Arial,sans-serif',gap:16,padding:24,textAlign:'center'}}>
      <div style={{fontSize:40}}>💛</div>
      <p style={{fontSize:15,color:'#C0392B',fontWeight:'bold'}}>Account not fully linked yet.</p>
      <p style={{fontSize:12,color:'#A0692E'}}>Your partner also needs to sign up using your email.</p>
      <button onClick={onLogout} style={{padding:'10px 24px',borderRadius:20,background:'linear-gradient(135deg,#E879A0,#A855D4)',border:'none',color:'white',cursor:'pointer',fontSize:13}}>Back to Login</button>
    </div>
  );

  const grouped=groupByDate(messages.filter(m=>m.deletedFor!==myEmail));

  return(
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600&family=DM+Sans:wght@300;400;500&display=swap');
        @keyframes hbPulse{0%,80%,100%{opacity:.3;transform:scale(.75)}40%{opacity:1;transform:scale(1)}}
        @keyframes reactionPop{from{opacity:0;transform:scale(0.5) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)}}
        @keyframes reactionBounce{from{opacity:0;transform:scale(0.3)}to{opacity:1;transform:scale(1)}}
        .hb-scroll::-webkit-scrollbar{width:3px}
        .hb-scroll::-webkit-scrollbar-thumb{background:rgba(232,121,160,0.3);border-radius:3px}
        .hb-suggestions::-webkit-scrollbar{display:none}
        .hb-bubble:active{filter:brightness(0.93)}
        .hb-header-btn:hover{opacity:0.8}
        .hb-send:hover{transform:scale(1.06);box-shadow:0 4px 20px rgba(232,121,160,0.5)!important}
        .hb-send:active{transform:scale(0.93)!important}
      `}</style>

      <div onClick={handleScreenTap} style={{display:'flex',flexDirection:'column',height:'100%',fontFamily:"'DM Sans','Segoe UI',sans-serif",overflow:'hidden',userSelect:'none'}}>

        {/* ── HEADER ── */}
        <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',background:'linear-gradient(135deg,#E8607A,#C0392B)',flexShrink:0,boxShadow:'0 2px 12px rgba(200,60,100,0.3)',zIndex:10}}>
          <button onClick={onOpenProfile} style={{background:'rgba(255,255,255,0.2)',border:'1.5px solid rgba(255,255,255,0.4)',borderRadius:'50%',width:40,height:40,cursor:'pointer',padding:0,position:'relative',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}} title="Back to Home">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <div style={{flex:1,minWidth:0,cursor:'pointer'}} onClick={()=>setShowNickname(true)}>
            <div style={{fontSize:16,fontWeight:600,color:'white',lineHeight:1.2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',fontFamily:"'Cormorant Garamond',serif",letterSpacing:'0.5px'}}>{partnerName}</div>
            <div style={{fontSize:10,color:partnerTyping?'#FFE0E0':'rgba(255,255,255,0.75)',marginTop:1}}>{partnerTyping?'✍️ typing...':'✏️ tap to set nickname'}</div>
          </div>
          <div style={{background:'rgba(255,255,255,0.2)',border:'1.5px solid rgba(255,255,255,0.4)',borderRadius:'50%',width:36,height:36,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="white" strokeWidth="1.8"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="white" strokeWidth="1.8" strokeLinecap="round"/></svg>
          </div>
          <button className="hb-header-btn" onClick={()=>setInAudioCall(true)} style={{background:'rgba(255,255,255,0.2)',border:'1.5px solid rgba(255,255,255,0.4)',borderRadius:'50%',width:38,height:38,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}} title="Audio call">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.52 9.94 19.79 19.79 0 01.47 1.31 2 2 0 012.46 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.44a16 16 0 006.29 6.29l.61-.61a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <button className="hb-header-btn" onClick={()=>setInCall(true)} style={{background:'rgba(255,255,255,0.2)',border:'1.5px solid rgba(255,255,255,0.4)',borderRadius:'50%',width:38,height:38,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M15 10l4.553-2.277A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M4 8a2 2 0 012-2h9a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2V8z" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <button className="hb-header-btn" onClick={()=>setShowLogoutConfirm(true)} style={{background:'rgba(255,255,255,0.2)',border:'1.5px solid rgba(255,255,255,0.4)',borderRadius:'50%',width:38,height:38,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><polyline points="16,17 21,12 16,7" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><line x1="21" y1="12" x2="9" y2="12" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>

        {/* ── MESSAGES ── */}
        <div className="hb-scroll" style={{flex:1,overflowY:'auto',overflowX:'hidden',padding:'12px 10px',display:'flex',flexDirection:'column',gap:2,...wallpaperStyle,WebkitOverflowScrolling:'touch'}}>
          {messages.length===0&&uploads.length===0&&(
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',flex:1,gap:0,paddingTop:40,paddingBottom:20}}>
              {/* Animated heart */}
              <div style={{fontSize:64,animation:'hbHeartBeat 1.8s ease-in-out infinite',filter:'drop-shadow(0 4px 20px rgba(232,40,80,0.5))'}}>❤️</div>
              {/* Brand name */}
              <h1 style={{fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:36,fontWeight:400,fontStyle:'italic',color:'#2D0A0A',margin:'10px 0 0',letterSpacing:'2px'}}>Hello Babe</h1>
              {/* Divider */}
              <div style={{display:'flex',alignItems:'center',gap:8,margin:'8px 0'}}>
                <div style={{width:30,height:1,background:'linear-gradient(90deg,transparent,rgba(232,121,160,0.5))'}}/>
                <span style={{fontSize:9,letterSpacing:4,color:'rgba(180,60,100,0.5)',fontFamily:"'Lato',sans-serif",textTransform:'uppercase'}}>your private world</span>
                <div style={{width:30,height:1,background:'linear-gradient(90deg,rgba(232,121,160,0.5),transparent)'}}/>
              </div>
              {/* Subtitle */}
              <p style={{fontSize:13,fontStyle:'italic',color:'rgba(180,60,100,0.55)',fontFamily:"'Cormorant Garamond',serif",margin:'4px 0 20px',letterSpacing:'0.5px'}}>For the love you deserve ♡</p>
              {/* Partner name card */}
              <div style={{background:'linear-gradient(135deg,rgba(232,121,160,0.1),rgba(168,85,212,0.08))',borderRadius:20,padding:'14px 28px',border:'1px solid rgba(232,121,160,0.2)',textAlign:'center',backdropFilter:'blur(8px)'}}>
                <p style={{margin:0,fontSize:12,color:'rgba(180,60,100,0.5)',fontFamily:"'Lato',sans-serif",marginBottom:4}}>You are connected with</p>
                <p style={{margin:0,fontSize:18,fontWeight:700,color:'#2D0A0A',fontFamily:"'Cormorant Garamond',serif",fontStyle:'italic'}}>{partnerName} 💗</p>
              </div>
              {/* Hint */}
              <p style={{fontSize:11,color:'rgba(180,60,100,0.35)',fontFamily:"'Lato',sans-serif",margin:'16px 0 0',textAlign:'center'}}>Say the first word or triple tap to send a kiss 💋</p>
              <style>{`@keyframes hbHeartBeat{0%,100%{transform:scale(1)}15%{transform:scale(1.25)}30%{transform:scale(1)}45%{transform:scale(1.15)}60%{transform:scale(1)}}`}</style>
            </div>
          )}
          {grouped.map((item,idx)=>{
            if(item.type==='date')return<DateDivider key={idx} label={item.label}/>;
            const{msg}=item;const isMine=msg.senderEmail===myEmail;
            return(
              <SwipeableMessage key={msg.id} isMine={isMine} onReply={()=>setReplyTo(msg)} onLongPress={pos=>setReactionPicker({msg,position:pos})}>
                <div style={{width:26,height:26,borderRadius:'50%',flexShrink:0,background:isMine?'rgba(232,121,160,0.2)':'rgba(168,85,212,0.15)',border:isMine?'1.5px solid rgba(232,121,160,0.4)':'1.5px solid rgba(168,85,212,0.3)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke={isMine?'#E879A0':'#A855D4'} strokeWidth="2"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={isMine?'#E879A0':'#A855D4'} strokeWidth="2" strokeLinecap="round"/></svg>
                </div>
                <div style={{display:'flex',flexDirection:'column',alignItems:isMine?'flex-end':'flex-start',maxWidth:'75%'}}>
                  {msg.replyTo&&(
                    <div style={{marginBottom:3,padding:'5px 10px',borderRadius:'10px 10px 0 0',background:isMine?'rgba(232,121,160,0.15)':'rgba(168,85,212,0.1)',borderLeft:`3px solid ${isMine?'#E879A0':'#A855D4'}`,maxWidth:'100%'}}>
                      <div style={{fontSize:10,fontWeight:700,color:isMine?'#E879A0':'#A855D4',fontFamily:'Arial,sans-serif',marginBottom:1}}>{msg.replyTo.sender}</div>
                      <div style={{fontSize:11,color:'#8B5A20',fontFamily:'Arial,sans-serif',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:180}}>{msg.replyTo.text}</div>
                    </div>
                  )}
                  <div className="hb-bubble" onClick={()=>setSelectedMsg(msg)} style={{padding:msg.type==='image'?'4px':'8px 12px 6px',borderRadius:isMine?'16px 4px 16px 16px':'4px 16px 16px 16px',background:isMine?'linear-gradient(135deg,#E879A0,#A855D4)':'#FFFFFF',boxShadow:isMine?'0 2px 10px rgba(232,121,160,0.3)':'0 1px 4px rgba(200,100,150,0.12)',border:isMine?'none':'1px solid rgba(255,182,193,0.35)',cursor:'pointer',overflow:'hidden'}}>
                    {!isMine&&msg.type==='text'&&<div style={{fontSize:10,color:'#A855D4',marginBottom:2,fontWeight:600,letterSpacing:'0.3px'}}>{msg.sender}</div>}
                    <MessageContent msg={msg} isMine={isMine}/>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'flex-end',gap:3,marginTop:msg.type==='text'?3:4,paddingRight:msg.type!=='text'?6:0,paddingBottom:msg.type!=='text'?4:0}}>
                      <span style={{fontSize:10,color:isMine?'rgba(255,255,255,0.7)':'rgba(180,80,120,0.6)'}}>{formatTime(msg.createdAt)}</span>
                      {isMine&&<Ticks status={msg.status||'sent'}/>}
                    </div>
                  </div>
                  <ReactionBadges reactions={msg.reactions}/>
                </div>
              </SwipeableMessage>
            );
          })}
          {uploads.map(u=><UploadProgress key={u.id} progress={u.progress} fileName={u.fileName}/>)}
          {partnerTyping&&(
            <div style={{display:'flex',alignItems:'flex-end',gap:6,marginBottom:4}}>
              <div style={{width:26,height:26,borderRadius:'50%',flexShrink:0,background:'rgba(168,85,212,0.15)',border:'1.5px solid rgba(168,85,212,0.3)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="#A855D4" strokeWidth="2"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="#A855D4" strokeWidth="2" strokeLinecap="round"/></svg>
              </div>
              <div style={{background:'#FFFFFF',border:'1px solid rgba(255,182,193,0.35)',padding:'10px 14px',borderRadius:'4px 16px 16px 16px',display:'flex',gap:5,alignItems:'center',boxShadow:'0 1px 4px rgba(200,100,150,0.1)'}}>
                {[0,0.2,0.4].map((delay,i)=><div key={i} style={{width:7,height:7,borderRadius:'50%',background:'#E879A0',animation:'hbPulse 1.4s ease-in-out infinite',animationDelay:`${delay}s`}}/>)}
              </div>
            </div>
          )}
          <div ref={bottomRef}/>
        </div>

        {/* EMOJI PICKER */}
        {showEmoji&&(
          <div style={{position:'absolute',bottom:72,left:12,zIndex:999}}>
            <EmojiPicker onEmojiClick={e=>setInput(p=>p+e.emoji)} height={340} width={300} theme="light"/>
          </div>
        )}

        {/* ATTACH MENU */}
        {showAttach&&(
          <div style={{position:'absolute',bottom:72,left:0,right:0,zIndex:999,background:'#FFFFFF',borderRadius:'20px 20px 0 0',padding:'20px 16px 24px',boxShadow:'0 -8px 32px rgba(200,100,150,0.15)',border:'1px solid rgba(255,182,193,0.3)'}}>
            <div style={{width:36,height:4,borderRadius:2,background:'rgba(200,100,150,0.2)',margin:'0 auto 16px'}}/>
            <p style={{margin:'0 0 16px',fontSize:11,color:'rgba(180,60,100,0.5)',fontFamily:"'Lato',sans-serif",letterSpacing:'0.5px',textTransform:'uppercase',fontWeight:600}}>Share</p>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16}}>
              {[
                {label:'Photo',color:'linear-gradient(135deg,#E879A0,#A855D4)',accept:'image/*',capture:null,
                  icon:<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="3" stroke="white" strokeWidth="2"/><circle cx="8.5" cy="8.5" r="1.5" fill="white"/><path d="M21 15l-5-5L5 21" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>},
                {label:'Camera',color:'linear-gradient(135deg,#A855D4,#6366F1)',accept:'image/*',capture:'environment',
                  icon:<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke="white" strokeWidth="2" strokeLinecap="round"/><circle cx="12" cy="13" r="4" stroke="white" strokeWidth="2"/></svg>},
                {label:'Video',color:'linear-gradient(135deg,#F59E0B,#EF4444)',accept:'video/*',capture:null,
                  icon:<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M15 10l4.553-2.277A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M4 8a2 2 0 012-2h9a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2V8z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>},
                {label:'Document',color:'linear-gradient(135deg,#3B82F6,#1D4ED8)',accept:'.pdf,.doc,.docx,.txt,.xlsx,.pptx',capture:null,
                  icon:<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><polyline points="14,2 14,8 20,8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><line x1="16" y1="13" x2="8" y2="13" stroke="white" strokeWidth="2" strokeLinecap="round"/><line x1="16" y1="17" x2="8" y2="17" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>},
              ].map(btn=>(
                <div key={btn.label} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8}}>
                  <button onClick={()=>{fileInputRef.current.accept=btn.accept;if(btn.capture)fileInputRef.current.capture=btn.capture;else fileInputRef.current.removeAttribute('capture');fileInputRef.current.click();setShowAttach(false);}} style={{width:56,height:56,borderRadius:18,background:btn.color,border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:`0 4px 14px rgba(0,0,0,0.15)`}}>{btn.icon}</button>
                  <span style={{fontSize:11,color:'#5C3810',fontFamily:"'Lato',sans-serif",fontWeight:500}}>{btn.label}</span>
                </div>
              ))}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16,marginTop:16}}>
              {[
                {label:'Location',color:'linear-gradient(135deg,#10B981,#059669)',
                  icon:<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="10" r="3" stroke="white" strokeWidth="2"/></svg>,
                  action:()=>{ navigator.geolocation.getCurrentPosition(pos=>{ const url=`https://maps.google.com/?q=${pos.coords.latitude},${pos.coords.longitude}`; setInput(url); setShowAttach(false); inputRef.current?.focus(); },()=>alert('Location permission denied.')); }},
                {label:'GIF',color:'linear-gradient(135deg,#EC4899,#8B5CF6)',
                  icon:<span style={{color:'white',fontWeight:900,fontSize:16,letterSpacing:-1}}>GIF</span>,
                  action:()=>{ window.open('https://giphy.com','_blank'); setShowAttach(false); alert('Copy a GIF link from GIPHY and paste it in the chat!'); }},
                {label:'Audio',color:'linear-gradient(135deg,#F97316,#EF4444)',accept:'audio/*',capture:null,
                  icon:<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M9 18V5l12-2v13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="6" cy="18" r="3" stroke="white" strokeWidth="2"/><circle cx="18" cy="16" r="3" stroke="white" strokeWidth="2"/></svg>},
                {label:'Contact',color:'linear-gradient(135deg,#6366F1,#4F46E5)',
                  icon:<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="9" cy="7" r="4" stroke="white" strokeWidth="2"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
                  action:()=>{ alert('Share your contact by typing your details in the chat!'); setShowAttach(false); }},
              ].map(btn=>(
                <div key={btn.label} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8}}>
                  <button onClick={btn.action||(()=>{fileInputRef.current.accept=btn.accept;fileInputRef.current.removeAttribute('capture');fileInputRef.current.click();setShowAttach(false);})} style={{width:56,height:56,borderRadius:18,background:btn.color,border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 4px 14px rgba(0,0,0,0.15)'}}>{btn.icon}</button>
                  <span style={{fontSize:11,color:'#5C3810',fontFamily:"'Lato',sans-serif",fontWeight:500}}>{btn.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {showAttach&&<div style={{position:'fixed',inset:0,zIndex:998}} onClick={()=>setShowAttach(false)}/>}
        <input ref={fileInputRef} type="file" style={{display:'none'}} onChange={handleFileUpload}/>

        {/* REPLY BAR */}
        {replyTo&&(
          <div style={{display:'flex',alignItems:'center',gap:10,padding:'8px 14px',background:'#FFF0F5',borderTop:'1px solid rgba(255,182,193,0.25)',zIndex:10}}>
            <div style={{width:3,height:36,borderRadius:3,background:'linear-gradient(135deg,#E879A0,#A855D4)',flexShrink:0}}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:11,fontWeight:700,color:'#E879A0',fontFamily:'Arial,sans-serif'}}>{replyTo.sender}</div>
              <div style={{fontSize:12,color:'#8B5A20',fontFamily:'Arial,sans-serif',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{replyTo.text||(replyTo.type==='image'?'📷 Photo':'🎥 Video')}</div>
            </div>
            <button onClick={()=>setReplyTo(null)} style={{background:'rgba(232,121,160,0.15)',border:'none',borderRadius:'50%',width:28,height:28,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><line x1="18" y1="6" x2="6" y2="18" stroke="#8B5A20" strokeWidth="2.5" strokeLinecap="round"/><line x1="6" y1="6" x2="18" y2="18" stroke="#8B5A20" strokeWidth="2.5" strokeLinecap="round"/></svg>
            </button>
          </div>
        )}

        {/* ── INPUT BAR ── */}
        <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',background:'#FFF0F5',borderTop:'1.5px solid rgba(232,121,160,0.2)',flexShrink:0,zIndex:10}}>
          <button onClick={()=>{setShowEmoji(!showEmoji);setShowAttach(false);}} style={{width:40,height:40,borderRadius:'50%',background:'rgba(232,121,160,0.1)',border:'1px solid rgba(232,121,160,0.25)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#E879A0" strokeWidth="1.8"/><path d="M8 14s1.5 2 4 2 4-2 4-2" stroke="#E879A0" strokeWidth="1.8" strokeLinecap="round"/><circle cx="9" cy="10" r="1.2" fill="#E879A0"/><circle cx="15" cy="10" r="1.2" fill="#E879A0"/></svg>
          </button>
          <button onClick={()=>{setShowAttach(!showAttach);setShowEmoji(false);}} style={{width:40,height:40,borderRadius:'50%',background:'rgba(232,121,160,0.1)',border:'1px solid rgba(232,121,160,0.25)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" stroke="#E879A0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <div style={{flex:1,background:'#FFFFFF',borderRadius:24,border:'1.5px solid rgba(232,121,160,0.3)',display:'flex',alignItems:'center',padding:'0 16px',boxShadow:'0 1px 4px rgba(232,121,160,0.1)'}}>
            <input ref={inputRef} className="hb-input-field" value={input}
              onChange={async e=>{setInput(e.target.value);await updateTyping(e.target.value.length>0);}}
              onKeyDown={handleKey} placeholder="Write something sweet…"
              style={{flex:1,background:'none',border:'none',outline:'none',color:'#3C1020',fontFamily:"'DM Sans','Segoe UI',sans-serif",fontSize:14,padding:'11px 0'}}/>
          </div>
          {recording ? (
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <div style={{display:'flex',alignItems:'center',gap:6,background:'rgba(232,121,160,0.1)',borderRadius:20,padding:'6px 12px',border:'1px solid rgba(232,121,160,0.3)'}}>
                <div style={{width:8,height:8,borderRadius:'50%',background:'#E879A0',animation:'hbPulse 1s ease-in-out infinite'}}/>
                <span style={{fontSize:13,color:'#E879A0',fontFamily:"'Lato',sans-serif",fontWeight:600}}>{String(Math.floor(recordSeconds/60)).padStart(2,'0')}:{String(recordSeconds%60).padStart(2,'0')}</span>
              </div>
              <button onClick={()=>stopRecording(false)} style={{width:38,height:38,borderRadius:'50%',background:'rgba(240,80,80,0.15)',border:'1px solid rgba(240,80,80,0.3)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><line x1="18" y1="6" x2="6" y2="18" stroke="#F05050" strokeWidth="2.5" strokeLinecap="round"/><line x1="6" y1="6" x2="18" y2="18" stroke="#F05050" strokeWidth="2.5" strokeLinecap="round"/></svg>
              </button>
              <button onClick={()=>stopRecording(true)} style={{width:42,height:42,borderRadius:'50%',background:'linear-gradient(135deg,#E879A0,#A855D4)',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,boxShadow:'0 3px 12px rgba(232,121,160,0.4)'}}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>
          ) : (
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              {!input && (
                <button onMouseDown={startRecording} onTouchStart={startRecording} style={{width:38,height:38,borderRadius:'50%',background:'rgba(232,121,160,0.1)',border:'1px solid rgba(232,121,160,0.25)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}} title="Hold to record voice message">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" stroke="#E879A0" strokeWidth="1.8" strokeLinecap="round"/><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" stroke="#E879A0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              )}
              <button className="hb-send" onClick={sendMessage} style={{width:42,height:42,borderRadius:'50%',background:'linear-gradient(135deg,#E879A0,#A855D4)',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,boxShadow:'0 3px 12px rgba(232,121,160,0.4)',transition:'all 0.15s'}}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>
          )}
        </div>

        {selectedMsg&&<MessageMenu msg={selectedMsg} isMine={selectedMsg.senderEmail===myEmail} coupleId={coupleId} onClose={()=>setSelectedMsg(null)}/>}
        {showNickname&&<NicknameModal myName={myName} partnerName={partnerRealName} myNickname={myNickname} partnerNickname={partnerNickname} onSave={saveNicknames} onClose={()=>setShowNickname(false)}/>}
        {reactionPicker&&<ReactionPicker msg={reactionPicker.msg} coupleId={coupleId} position={reactionPicker.position} onClose={()=>setReactionPicker(null)}/>}
        {kissEffect&&<KissEffect key={`${kissEffect.x}-${kissEffect.y}`} position={kissEffect} onDone={()=>setKissEffect(null)}/>}

        {showLogoutConfirm&&(
          <div style={{position:'fixed',inset:0,zIndex:2000,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setShowLogoutConfirm(false)}>
            <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.45)'}}/>
            <div onClick={e=>e.stopPropagation()} style={{background:'#FFFFFF',borderRadius:24,overflow:'hidden',width:'82%',maxWidth:300,boxShadow:'0 12px 40px rgba(200,100,150,0.3)',zIndex:2001}}>
              <div style={{background:'linear-gradient(135deg,#E879A0,#A855D4)',padding:'20px 20px 16px',textAlign:'center'}}>
                <div style={{width:48,height:48,borderRadius:'50%',background:'rgba(255,255,255,0.2)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 10px'}}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" stroke="white" strokeWidth="2" strokeLinecap="round"/><polyline points="16,17 21,12 16,7" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"/><line x1="21" y1="12" x2="9" y2="12" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
                </div>
                <div style={{fontSize:17,fontWeight:700,color:'white',fontFamily:'Arial,sans-serif'}}>Sign Out?</div>
                <div style={{fontSize:12,color:'rgba(255,255,255,0.8)',marginTop:4,fontFamily:'Arial,sans-serif'}}>You'll need to log in again</div>
              </div>
              <div style={{padding:'16px 16px 20px',display:'flex',gap:10}}>
                <button onClick={()=>setShowLogoutConfirm(false)} style={{flex:1,padding:'12px',borderRadius:18,border:'1.5px solid #E8D5B8',background:'#FDF6ED',color:'#8B5A20',fontSize:14,cursor:'pointer',fontFamily:'Arial,sans-serif',fontWeight:700}}>No, Stay</button>
                <button onClick={()=>{setShowLogoutConfirm(false);onLogout();}} style={{flex:1,padding:'12px',borderRadius:18,border:'none',background:'linear-gradient(135deg,#E879A0,#A855D4)',color:'white',fontSize:14,cursor:'pointer',fontFamily:'Arial,sans-serif',fontWeight:700}}>Yes, Leave</button>
              </div>
            </div>
          </div>
        )}

        {showGreeting && <GreetingPopup name={partnerNickname || partnerRealName || 'Babe'} onDone={() => setShowGreeting(false)}/>}
        {inAudioCall&&<AudioCall user={myName} partnerName={partnerName} onEndCall={()=>setInAudioCall(false)}/>}
        {inCall&&<VideoCall user={myName} onEndCall={()=>setInCall(false)}/>}
      </div>
    </>
  );
}

export default Chat;