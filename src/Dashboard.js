import { useState, useEffect, useRef } from 'react';
import { db } from './firebase';
import { doc, getDoc, setDoc, onSnapshot, collection, addDoc, deleteDoc, updateDoc, query, where } from 'firebase/firestore';

// ── Ethereal background ───────────────────────────────────────────
function DashBackground() {
  const canvasRef = useRef(null);
  const animRef   = useRef(null);
  const tRef      = useRef(0);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext('2d');
    let W = canvas.width  = window.innerWidth;
    let H = canvas.height = window.innerHeight;
    const particles = Array.from({ length: 22 }, () => ({
      x: Math.random()*W, y: Math.random()*H,
      vy: -0.2 - Math.random()*0.3,
      size: 6 + Math.random()*12,
      emoji: ['💗','✨','🌸','💕','⭐','💮'][Math.floor(Math.random()*6)],
      alpha: 0.08 + Math.random()*0.18,
      phase: Math.random()*Math.PI*2,
    }));
    function draw() {
      ctx.clearRect(0,0,W,H);
      const bg = ctx.createLinearGradient(0,0,W*0.5,H);
      bg.addColorStop(0,'#FFF5F7'); bg.addColorStop(0.5,'#FEF0F8'); bg.addColorStop(1,'#FDF5FF');
      ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);
      // Soft glow blobs
      [[W*0.15,H*0.2,'rgba(255,182,193,0.12)'],[W*0.85,H*0.5,'rgba(200,150,255,0.1)'],[W*0.5,H*0.8,'rgba(255,160,200,0.09)']].forEach(([x,y,c])=>{
        const g=ctx.createRadialGradient(x,y,0,x,y,W*0.4); g.addColorStop(0,c); g.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
      });
      particles.forEach(p=>{
        p.y+=p.vy; p.x+=Math.sin(tRef.current*0.01+p.phase)*0.25; p.phase+=0.004;
        if(p.y<-20){p.y=H+10;p.x=Math.random()*W;}
        ctx.globalAlpha=p.alpha; ctx.font=`${p.size}px serif`; ctx.fillText(p.emoji,p.x,p.y);
      });
      ctx.globalAlpha=1; tRef.current++; animRef.current=requestAnimationFrame(draw);
    }
    draw();
    const onResize=()=>{W=canvas.width=window.innerWidth;H=canvas.height=window.innerHeight;};
    window.addEventListener('resize',onResize);
    return()=>{cancelAnimationFrame(animRef.current);window.removeEventListener('resize',onResize);};
  },[]);
  return <canvas ref={canvasRef} style={{position:'fixed',inset:0,zIndex:0,pointerEvents:'none'}}/>;
}

// ── Days Together ─────────────────────────────────────────────────
function useDaysTogether(coupleId) {
  const [days, setDays]           = useState(null);
  const [startDate, setStartDate] = useState('');
  useEffect(() => {
    if(!coupleId) return;
    return onSnapshot(doc(db,'couples',coupleId), snap => {
      if(snap.exists() && snap.data().startDate) {
        const d = snap.data().startDate; setStartDate(d);
        setDays(Math.floor((Date.now()-new Date(d).getTime())/(1000*60*60*24)));
      }
    });
  },[coupleId]);
  return { days, startDate };
}

function useCountdown(coupleId, field) {
  const [daysLeft, setDaysLeft] = useState(null);
  const [date, setDate]         = useState('');
  useEffect(() => {
    if(!coupleId) return;
    return onSnapshot(doc(db,'couples',coupleId), snap => {
      if(snap.exists() && snap.data()[field]) {
        const d = snap.data()[field]; setDate(d);
        const now=new Date(), target=new Date(d);
        const thisYear=new Date(now.getFullYear(),target.getMonth(),target.getDate());
        const next=thisYear>now?thisYear:new Date(now.getFullYear()+1,target.getMonth(),target.getDate());
        setDaysLeft(Math.ceil((next-now)/(1000*60*60*24)));
      }
    });
  },[coupleId,field]);
  return { daysLeft, date };
}

const QUESTIONS = [
  "What's one thing I do that makes you smile every time?",
  "If we could travel anywhere right now, where would you go?",
  "What's your favourite memory of us so far?",
  "What's one thing you want us to try together this month?",
  "How do you feel most loved?",
  "What song reminds you of me?",
  "If you could relive one day with us, which would it be?",
  "What's one thing you secretly love about me?",
  "What does your perfect date with me look like?",
  "What dream do you want us to achieve together?",
];

const MOODS = [
  {emoji:'😍',label:'In Love'},{emoji:'😊',label:'Happy'},
  {emoji:'🥰',label:'Grateful'},{emoji:'😌',label:'Peaceful'},
  {emoji:'🥺',label:'Miss You'},{emoji:'😢',label:'Sad'},
];

// ── Main Dashboard ────────────────────────────────────────────────
function Dashboard({ user, onOpenChat, onOpenProfile, onLogout }) {
  const coupleId     = user?.coupleId     || '';
  const myName       = user?.name         || 'You';
  const partnerEmail = user?.partnerEmail || '';

  const [partnerName,   setPartnerName]   = useState('');
  const [myPhoto,       setMyPhoto]       = useState(null);
  const [partnerPhoto,  setPartnerPhoto]  = useState(null);
  const [myMood,        setMyMood]        = useState(null);
  const [partnerMood,   setPartnerMood]   = useState(null);
  const [notes,         setNotes]         = useState([]);
  const [goals,         setGoals]         = useState([]);
  const [noteInput,     setNoteInput]     = useState('');
  const [goalInput,     setGoalInput]     = useState('');
  const [answer,        setAnswer]        = useState('');
  const [savedAnswer,   setSavedAnswer]   = useState('');
  const [startDate,     setStartDateVal]  = useState('');
  const [birthdayDate,  setBirthdayDate]  = useState('');
  const [anniversaryDate,setAnniversaryDate] = useState('');
  const [activeSection, setActiveSection] = useState('home');
  const [uploading,     setUploading]     = useState(false);
  const fileRef = useRef(null);

  const { days }                      = useDaysTogether(coupleId);
  const { daysLeft: bdayLeft }        = useCountdown(coupleId, 'partnerBirthday');
  const { daysLeft: annivLeft }       = useCountdown(coupleId, 'anniversary');
  const todayKey = new Date().toISOString().split('T')[0];
  const question = QUESTIONS[new Date().getDate() % QUESTIONS.length];

  useEffect(()=>{ if(!partnerEmail)return; const ref=query(collection(db,'users'),where('email','==',partnerEmail)); return onSnapshot(ref,snap=>{if(!snap.empty)setPartnerName(snap.docs[0].data().name||'');});  },[partnerEmail]);
  useEffect(()=>{ if(!coupleId)return; return onSnapshot(doc(db,'couples',coupleId),snap=>{ if(!snap.exists())return; const d=snap.data(); if(d[`photo_${myName}`])setMyPhoto(d[`photo_${myName}`]); if(partnerName&&d[`photo_${partnerName}`])setPartnerPhoto(d[`photo_${partnerName}`]); if(d.startDate)setStartDateVal(d.startDate); if(d.partnerBirthday)setBirthdayDate(d.partnerBirthday); if(d.anniversary)setAnniversaryDate(d.anniversary); }); },[coupleId,myName,partnerName]);
  useEffect(()=>{ if(!coupleId)return; return onSnapshot(collection(db,'couples',coupleId,'loveNotes'),snap=>{setNotes(snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>b.createdAt-a.createdAt));}); },[coupleId]);
  useEffect(()=>{ if(!coupleId)return; return onSnapshot(collection(db,'couples',coupleId,'goals'),snap=>{setGoals(snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>a.createdAt-b.createdAt));}); },[coupleId]);
  useEffect(()=>{ if(!coupleId)return; return onSnapshot(doc(db,'couples',coupleId,'moods',todayKey),snap=>{ if(snap.exists()){const d=snap.data();if(d[myName])setMyMood(d[myName]);if(partnerName&&d[partnerName])setPartnerMood(d[partnerName]);} }); },[coupleId,myName,partnerName]);
  useEffect(()=>{ if(!coupleId)return; getDoc(doc(db,'couples',coupleId,'dailyAnswers',`${todayKey}_${myName}`)).then(snap=>{if(snap.exists())setSavedAnswer(snap.data().answer);}); },[coupleId,myName]);

  const saveField = async (field, value) => { await setDoc(doc(db,'couples',coupleId),{[field]:value},{merge:true}); };
  const selectMood = async (mood) => { setMyMood(mood); await setDoc(doc(db,'couples',coupleId,'moods',todayKey),{[myName]:mood},{merge:true}); };
  const addNote = async () => { if(!noteInput.trim())return; await addDoc(collection(db,'couples',coupleId,'loveNotes'),{text:noteInput.trim(),author:myName,createdAt:Date.now()}); setNoteInput(''); };
  const addGoal = async () => { if(!goalInput.trim())return; await addDoc(collection(db,'couples',coupleId,'goals'),{text:goalInput.trim(),done:false,createdAt:Date.now()}); setGoalInput(''); };
  const toggleGoal = async (id,done) => { await updateDoc(doc(db,'couples',coupleId,'goals',id),{done:!done}); };
  const saveAnswer = async () => { if(!answer.trim())return; await setDoc(doc(db,'couples',coupleId,'dailyAnswers',`${todayKey}_${myName}`),{answer:answer.trim(),author:myName,date:todayKey}); setSavedAnswer(answer.trim()); };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0]; if(!file)return; e.target.value='';
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      await setDoc(doc(db,'couples',coupleId),{[`photo_${partnerName||'partner'}`]:reader.result},{merge:true});
      setPartnerPhoto(reader.result); setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const doneTasks  = goals.filter(g=>g.done).length;
  const totalTasks = goals.length;

  const sections = [
    {id:'home',   emoji:'🏠', label:'Home'},
    {id:'dates',  emoji:'📅', label:'Dates'},
    {id:'mood',   emoji:'💭', label:'Mood'},
    {id:'notes',  emoji:'📌', label:'Notes'},
    {id:'goals',  emoji:'🎯', label:'Goals'},
    {id:'qa',     emoji:'💬', label:'Q&A'},
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Lato:wght@300;400;700&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 2px; }
        ::-webkit-scrollbar-thumb { background: rgba(232,121,160,0.2); border-radius: 2px; }
        input, textarea { -webkit-user-select: text !important; user-select: text !important; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes scaleIn { from{opacity:0;transform:scale(0.92)} to{opacity:1;transform:scale(1)} }
      `}</style>

      <div style={{height:'100vh',display:'flex',flexDirection:'column',position:'relative',fontFamily:"'Lato',sans-serif",overflow:'hidden'}}>
        <DashBackground/>

        {/* ── HEADER ── */}
        <div style={{position:'relative',zIndex:2,padding:'10px 16px 6px',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
          <div>
            <h1 style={{margin:0,fontSize:20,fontFamily:"'Cormorant Garamond',serif",fontWeight:400,fontStyle:'italic',color:'#1A0510',letterSpacing:'1px'}}>Hello Babe</h1>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <div style={{width:34,height:34,borderRadius:'50%',overflow:'hidden',border:'2px solid rgba(232,121,160,0.4)',background:'rgba(232,121,160,0.1)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}} onClick={onOpenProfile}>
              {myPhoto ? <img src={myPhoto} alt="me" style={{width:'100%',height:'100%',objectFit:'cover'}}/> : <span style={{fontSize:16}}>👤</span>}
            </div>
            <button onClick={onLogout} style={{background:'none',border:'none',cursor:'pointer',fontSize:16,opacity:0.4}}>⟵</button>
          </div>
        </div>

        {/* ── HERO BANNER ── */}
        <div style={{position:'relative',zIndex:2,margin:'0 16px 12px',flexShrink:0}}>
          <div style={{background:'linear-gradient(135deg,#E879A0,#A855D4)',borderRadius:20,padding:'14px 16px',position:'relative',overflow:'hidden',boxShadow:'0 6px 24px rgba(232,121,160,0.3)'}}>
            <div style={{position:'absolute',inset:0,opacity:0.05}}>
              <span style={{position:'absolute',fontSize:50,top:-5,right:-5}}>❤️</span>
            </div>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',position:'relative',zIndex:1}}>
              <div style={{flex:1}}>
                <h2 style={{margin:'0 0 4px',fontSize:18,color:'white',fontFamily:"'Cormorant Garamond',serif",fontWeight:600,letterSpacing:'0.5px'}}>{myName} ♡ {partnerName||'...'}</h2>
                {days !== null && (
                  <div style={{display:'inline-flex',alignItems:'center',gap:5,background:'rgba(255,255,255,0.2)',borderRadius:20,padding:'3px 10px'}}>
                    <span style={{fontSize:12}}>💗</span>
                    <span style={{fontSize:11,color:'white',fontWeight:700}}>{days} days of love</span>
                  </div>
                )}
              </div>
              <div style={{width:58,height:58,borderRadius:'50%',overflow:'hidden',border:'2.5px solid rgba(255,255,255,0.4)',background:'rgba(255,255,255,0.15)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,cursor:'pointer'}} onClick={()=>fileRef.current.click()}>
                {partnerPhoto
                  ? <img src={partnerPhoto} alt="eyes" style={{width:'100%',height:'100%',objectFit:'cover',objectPosition:'center 18%',transform:'scale(1.5) translateY(-5%)'}}/>
                  : <div style={{textAlign:'center'}}><div style={{fontSize:18}}>👁️</div><div style={{fontSize:7,color:'rgba(255,255,255,0.7)'}}>Add</div></div>
                }
              </div>
            </div>
          </div>
        </div>

        {/* ── SCROLLABLE CONTENT ── */}
        <div style={{flex:1,overflowY:'auto',position:'relative',zIndex:2,padding:'0 16px 80px'}}>

          {/* HOME — stat cards */}
          {activeSection === 'home' && (
            <div style={{animation:'scaleIn 0.3s ease'}}>
              {/* Stats row */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:16}}>
                {[
                  {emoji:'💑',label:'Days\nTogether',value:days??'—',color:'#E879A0'},
                  {emoji:'🎂',label:"Birthday\nCountdown",value:bdayLeft===0?'Today!':bdayLeft??'—',unit:bdayLeft&&bdayLeft>0?'days':'',color:'#F59E0B'},
                  {emoji:'💍',label:'Anniversary\nCountdown',value:annivLeft===0?'Today!':annivLeft??'—',unit:annivLeft&&annivLeft>0?'days':'',color:'#A855D4'},
                ].map((s,i)=>(
                  <div key={i} onClick={()=>setActiveSection('dates')} style={{background:'rgba(255,255,255,0.8)',backdropFilter:'blur(12px)',borderRadius:18,padding:'14px 10px',textAlign:'center',border:`1px solid ${s.color}22`,boxShadow:`0 4px 16px ${s.color}18`,cursor:'pointer',transition:'transform 0.2s'}}
                    onMouseEnter={e=>e.currentTarget.style.transform='scale(1.03)'}
                    onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
                    <div style={{fontSize:22,marginBottom:4}}>{s.emoji}</div>
                    <div style={{fontSize:22,fontWeight:800,color:s.color,lineHeight:1,fontFamily:"'Cormorant Garamond',serif"}}>{s.value}</div>
                    {s.unit && <div style={{fontSize:9,color:s.color,opacity:0.8,fontWeight:600}}>{s.unit}</div>}
                    <div style={{fontSize:9,color:'rgba(100,20,50,0.45)',marginTop:3,lineHeight:1.3,whiteSpace:'pre-line'}}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Mood snap */}
              <div style={{background:'rgba(255,255,255,0.8)',backdropFilter:'blur(12px)',borderRadius:20,padding:'16px',marginBottom:12,border:'1px solid rgba(232,121,160,0.15)',boxShadow:'0 4px 16px rgba(232,121,160,0.08)'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                  <div>
                    <p style={{margin:0,fontSize:14,fontWeight:700,color:'#1A0510',fontFamily:"'Cormorant Garamond',serif"}}>💭 How are you feeling?</p>
                    <p style={{margin:0,fontSize:10,color:'rgba(160,40,80,0.5)'}}>Check in with each other daily</p>
                  </div>
                  {partnerMood && <div style={{background:'rgba(168,85,212,0.1)',borderRadius:12,padding:'4px 10px',fontSize:11,color:'rgba(100,20,80,0.7)'}}>{partnerName}: {partnerMood.emoji}</div>}
                </div>
                <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                  {MOODS.map(m=>(
                    <button key={m.label} onClick={()=>selectMood(m)} style={{display:'flex',flexDirection:'column',alignItems:'center',padding:'8px 10px',borderRadius:14,border:`1.5px solid ${myMood?.label===m.label?'#E879A0':'rgba(232,121,160,0.2)'}`,background:myMood?.label===m.label?'linear-gradient(135deg,rgba(232,121,160,0.15),rgba(168,85,212,0.1))':'transparent',cursor:'pointer',gap:2,transition:'all 0.2s'}}>
                      <span style={{fontSize:20}}>{m.emoji}</span>
                      <span style={{fontSize:9,color:'rgba(160,40,80,0.6)',fontWeight:myMood?.label===m.label?700:400}}>{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Daily Q */}
              <div style={{background:'linear-gradient(135deg,rgba(232,121,160,0.08),rgba(168,85,212,0.06))',backdropFilter:'blur(12px)',borderRadius:20,padding:'16px',marginBottom:12,border:'1px solid rgba(232,121,160,0.15)'}}>
                <p style={{margin:'0 0 6px',fontSize:10,color:'rgba(160,40,80,0.5)',letterSpacing:'2px',textTransform:'uppercase',fontWeight:600}}>💬 Today's Question</p>
                <p style={{margin:'0 0 12px',fontSize:15,fontStyle:'italic',color:'#1A0510',fontFamily:"'Cormorant Garamond',serif",lineHeight:1.5}}>"{question}"</p>
                {savedAnswer
                  ? <p style={{margin:0,fontSize:13,color:'rgba(160,40,80,0.7)',fontStyle:'italic'}}>"{savedAnswer}"</p>
                  : <div style={{display:'flex',gap:8}}>
                      <input value={answer} onChange={e=>setAnswer(e.target.value)} placeholder="Your answer…" onKeyDown={e=>e.key==='Enter'&&saveAnswer()}
                        style={{flex:1,padding:'8px 12px',borderRadius:12,border:'1px solid rgba(232,121,160,0.25)',background:'rgba(255,255,255,0.8)',fontSize:12,outline:'none',color:'#1A0510',fontFamily:"'Lato',sans-serif"}}/>
                      <button onClick={saveAnswer} style={{padding:'8px 14px',borderRadius:12,border:'none',background:'linear-gradient(135deg,#E879A0,#A855D4)',color:'white',fontSize:12,cursor:'pointer',fontWeight:700}}>Share</button>
                    </div>
                }
              </div>

              {/* Recent notes preview */}
              {notes.length > 0 && (
                <div style={{background:'rgba(255,255,255,0.8)',backdropFilter:'blur(12px)',borderRadius:20,padding:'16px',marginBottom:12,border:'1px solid rgba(232,121,160,0.15)',cursor:'pointer'}} onClick={()=>setActiveSection('notes')}>
                  <p style={{margin:'0 0 10px',fontSize:12,fontWeight:700,color:'#1A0510'}}>📌 Love Notes <span style={{fontSize:10,color:'rgba(160,40,80,0.4)',fontWeight:400}}>— tap to see all</span></p>
                  <p style={{margin:0,fontSize:13,color:'rgba(100,20,50,0.8)',fontStyle:'italic',fontFamily:"'Cormorant Garamond',serif",lineHeight:1.5}}>"{notes[0].text}"</p>
                  <p style={{margin:'4px 0 0',fontSize:10,color:'rgba(160,40,80,0.4)'}}>— {notes[0].author}</p>
                </div>
              )}

              {/* Goals progress */}
              {totalTasks > 0 && (
                <div style={{background:'rgba(255,255,255,0.8)',backdropFilter:'blur(12px)',borderRadius:20,padding:'16px',border:'1px solid rgba(232,121,160,0.15)',cursor:'pointer'}} onClick={()=>setActiveSection('goals')}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                    <p style={{margin:0,fontSize:12,fontWeight:700,color:'#1A0510'}}>🎯 Couple Goals</p>
                    <span style={{fontSize:11,color:'rgba(160,40,80,0.6)'}}>{doneTasks}/{totalTasks} done</span>
                  </div>
                  <div style={{background:'rgba(232,121,160,0.12)',borderRadius:6,height:6,overflow:'hidden'}}>
                    <div style={{height:'100%',width:`${(doneTasks/totalTasks)*100}%`,background:'linear-gradient(90deg,#E879A0,#A855D4)',borderRadius:6,transition:'width 0.5s'}}/>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* DATES section */}
          {activeSection === 'dates' && (
            <div style={{animation:'scaleIn 0.3s ease'}}>
              <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:400,fontStyle:'italic',color:'#1A0510',margin:'0 0 14px'}}>Important Dates</h2>
              {[
                {label:'💑 When did you start dating?',field:'startDate',state:startDate,setter:setStartDateVal},
                {label:"🎂 Partner's Birthday",field:'partnerBirthday',state:birthdayDate,setter:setBirthdayDate},
                {label:'💍 Anniversary',field:'anniversary',state:anniversaryDate,setter:setAnniversaryDate},
              ].map(({label,field,state,setter})=>(
                <div key={field} style={{background:'rgba(255,255,255,0.85)',backdropFilter:'blur(12px)',borderRadius:18,padding:'16px',marginBottom:12,border:'1px solid rgba(232,121,160,0.15)',boxShadow:'0 2px 12px rgba(232,121,160,0.06)'}}>
                  <p style={{margin:'0 0 8px',fontSize:13,color:'#1A0510',fontWeight:600,fontFamily:"'Lato',sans-serif"}}>{label}</p>
                  <div style={{display:'flex',gap:8}}>
                    <input type="date" value={state} onChange={e=>setter(e.target.value)}
                      style={{flex:1,padding:'10px 12px',borderRadius:12,border:'1.5px solid rgba(232,121,160,0.3)',background:'#FFF5F7',color:'#1A0510',fontSize:13,outline:'none',fontFamily:"'Lato',sans-serif"}}/>
                    <button onClick={()=>saveField(field,state)} style={{padding:'10px 16px',borderRadius:12,border:'none',background:'linear-gradient(135deg,#E879A0,#A855D4)',color:'white',fontSize:12,cursor:'pointer',fontWeight:700,fontFamily:"'Lato',sans-serif"}}>Save</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* MOOD section */}
          {activeSection === 'mood' && (
            <div style={{animation:'scaleIn 0.3s ease'}}>
              <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:400,fontStyle:'italic',color:'#1A0510',margin:'0 0 14px'}}>How Are You Feeling?</h2>
              <div style={{background:'rgba(255,255,255,0.85)',backdropFilter:'blur(12px)',borderRadius:20,padding:'20px',marginBottom:12,border:'1px solid rgba(232,121,160,0.15)'}}>
                <p style={{margin:'0 0 14px',fontSize:13,color:'rgba(160,40,80,0.6)',fontFamily:"'Lato',sans-serif"}}>Your mood today:</p>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:16}}>
                  {MOODS.map(m=>(
                    <button key={m.label} onClick={()=>selectMood(m)} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4,padding:'12px 8px',borderRadius:16,border:`1.5px solid ${myMood?.label===m.label?'#E879A0':'rgba(232,121,160,0.2)'}`,background:myMood?.label===m.label?'linear-gradient(135deg,rgba(232,121,160,0.18),rgba(168,85,212,0.12))':'rgba(255,245,247,0.8)',cursor:'pointer',transition:'all 0.2s'}}>
                      <span style={{fontSize:28}}>{m.emoji}</span>
                      <span style={{fontSize:11,color:'rgba(160,40,80,0.7)',fontWeight:myMood?.label===m.label?700:400,fontFamily:"'Lato',sans-serif"}}>{m.label}</span>
                    </button>
                  ))}
                </div>
                {partnerMood && (
                  <div style={{display:'flex',alignItems:'center',gap:10,padding:'12px 14px',borderRadius:14,background:'rgba(168,85,212,0.07)',border:'1px solid rgba(168,85,212,0.15)'}}>
                    <span style={{fontSize:26}}>{partnerMood.emoji}</span>
                    <div>
                      <p style={{margin:0,fontSize:12,fontWeight:700,color:'#1A0510',fontFamily:"'Lato',sans-serif"}}>{partnerName||'Partner'}</p>
                      <p style={{margin:0,fontSize:11,color:'rgba(160,40,80,0.6)',fontFamily:"'Lato',sans-serif"}}>is feeling {partnerMood.label} today</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* NOTES section */}
          {activeSection === 'notes' && (
            <div style={{animation:'scaleIn 0.3s ease'}}>
              <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:400,fontStyle:'italic',color:'#1A0510',margin:'0 0 14px'}}>Love Notes</h2>
              <div style={{display:'flex',gap:8,marginBottom:14}}>
                <input value={noteInput} onChange={e=>setNoteInput(e.target.value)} placeholder="Pin a sweet message forever…" onKeyDown={e=>e.key==='Enter'&&addNote()}
                  style={{flex:1,padding:'11px 14px',borderRadius:14,border:'1.5px solid rgba(232,121,160,0.3)',background:'rgba(255,255,255,0.9)',fontSize:13,outline:'none',color:'#1A0510',fontFamily:"'Lato',sans-serif"}}/>
                <button onClick={addNote} style={{padding:'11px 16px',borderRadius:14,border:'none',background:'linear-gradient(135deg,#E879A0,#A855D4)',color:'white',fontSize:13,cursor:'pointer',fontWeight:700}}>Pin</button>
              </div>
              {notes.length===0 && <p style={{textAlign:'center',color:'rgba(160,40,80,0.35)',fontSize:13,fontStyle:'italic',fontFamily:"'Cormorant Garamond',serif",marginTop:40}}>No love notes yet — pin your first one 💗</p>}
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {notes.map(n=>(
                  <div key={n.id} style={{background:'rgba(255,255,255,0.85)',backdropFilter:'blur(12px)',borderRadius:16,padding:'14px 16px',border:'1px solid rgba(232,121,160,0.12)',display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8,boxShadow:'0 2px 12px rgba(232,121,160,0.06)'}}>
                    <div>
                      <p style={{margin:'0 0 4px',fontSize:14,color:'#1A0510',fontFamily:"'Cormorant Garamond',serif",fontStyle:'italic',lineHeight:1.5}}>"{n.text}"</p>
                      <p style={{margin:0,fontSize:10,color:'rgba(160,40,80,0.4)'}}>— {n.author}</p>
                    </div>
                    <button onClick={()=>deleteDoc(doc(db,'couples',coupleId,'loveNotes',n.id))} style={{background:'none',border:'none',cursor:'pointer',fontSize:14,color:'rgba(200,80,120,0.3)',flexShrink:0}}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* GOALS section */}
          {activeSection === 'goals' && (
            <div style={{animation:'scaleIn 0.3s ease'}}>
              <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:400,fontStyle:'italic',color:'#1A0510',margin:'0 0 14px'}}>Couple Goals</h2>
              {totalTasks>0 && (
                <div style={{marginBottom:14}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                    <span style={{fontSize:11,color:'rgba(160,40,80,0.6)',fontFamily:"'Lato',sans-serif"}}>{doneTasks} of {totalTasks} completed</span>
                    <span style={{fontSize:11,color:'rgba(160,40,80,0.6)',fontFamily:"'Lato',sans-serif"}}>{Math.round((doneTasks/totalTasks)*100)}%</span>
                  </div>
                  <div style={{background:'rgba(232,121,160,0.15)',borderRadius:8,height:8,overflow:'hidden'}}>
                    <div style={{height:'100%',width:`${(doneTasks/totalTasks)*100}%`,background:'linear-gradient(90deg,#E879A0,#A855D4)',borderRadius:8,transition:'width 0.5s'}}/>
                  </div>
                </div>
              )}
              <div style={{display:'flex',gap:8,marginBottom:14}}>
                <input value={goalInput} onChange={e=>setGoalInput(e.target.value)} placeholder="Add a goal, e.g. Visit Paris…" onKeyDown={e=>e.key==='Enter'&&addGoal()}
                  style={{flex:1,padding:'11px 14px',borderRadius:14,border:'1.5px solid rgba(232,121,160,0.3)',background:'rgba(255,255,255,0.9)',fontSize:13,outline:'none',color:'#1A0510',fontFamily:"'Lato',sans-serif"}}/>
                <button onClick={addGoal} style={{padding:'11px 16px',borderRadius:14,border:'none',background:'linear-gradient(135deg,#E879A0,#A855D4)',color:'white',fontSize:13,cursor:'pointer',fontWeight:700}}>Add</button>
              </div>
              {goals.length===0 && <p style={{textAlign:'center',color:'rgba(160,40,80,0.35)',fontSize:13,fontStyle:'italic',fontFamily:"'Cormorant Garamond',serif",marginTop:40}}>No goals yet — dream big together 🌟</p>}
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {goals.map(g=>(
                  <div key={g.id} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',borderRadius:14,background:g.done?'rgba(168,85,212,0.06)':'rgba(255,255,255,0.85)',border:`1px solid ${g.done?'rgba(168,85,212,0.15)':'rgba(232,121,160,0.12)'}`,backdropFilter:'blur(12px)',boxShadow:'0 2px 8px rgba(232,121,160,0.06)'}}>
                    <button onClick={()=>toggleGoal(g.id,g.done)} style={{width:24,height:24,borderRadius:'50%',border:`2px solid ${g.done?'#A855D4':'rgba(232,121,160,0.4)'}`,background:g.done?'linear-gradient(135deg,#E879A0,#A855D4)':'transparent',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'all 0.2s'}}>
                      {g.done && <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><polyline points="20,6 9,17 4,12" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </button>
                    <span style={{flex:1,fontSize:13,color:'#1A0510',fontFamily:"'Lato',sans-serif",textDecoration:g.done?'line-through':'none',opacity:g.done?0.5:1}}>{g.text}</span>
                    <button onClick={()=>deleteDoc(doc(db,'couples',coupleId,'goals',g.id))} style={{background:'none',border:'none',cursor:'pointer',fontSize:13,color:'rgba(200,80,120,0.3)',flexShrink:0}}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Q&A section */}
          {activeSection === 'qa' && (
            <div style={{animation:'scaleIn 0.3s ease'}}>
              <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:400,fontStyle:'italic',color:'#1A0510',margin:'0 0 14px'}}>Daily Question</h2>
              <div style={{background:'linear-gradient(135deg,rgba(232,121,160,0.1),rgba(168,85,212,0.08))',borderRadius:20,padding:'20px',marginBottom:14,border:'1px solid rgba(232,121,160,0.15)'}}>
                <p style={{margin:'0 0 4px',fontSize:10,color:'rgba(160,40,80,0.5)',letterSpacing:'2px',textTransform:'uppercase',fontWeight:600}}>Today's question</p>
                <p style={{margin:0,fontSize:17,fontStyle:'italic',color:'#1A0510',fontFamily:"'Cormorant Garamond',serif",lineHeight:1.6}}>"{question}"</p>
              </div>
              {savedAnswer
                ? <div style={{background:'rgba(255,255,255,0.85)',borderRadius:18,padding:'16px',border:'1px solid rgba(232,121,160,0.15)'}}>
                    <p style={{margin:'0 0 4px',fontSize:10,color:'rgba(160,40,80,0.5)',letterSpacing:'1px',textTransform:'uppercase'}}>Your answer</p>
                    <p style={{margin:0,fontSize:14,color:'#1A0510',fontStyle:'italic',fontFamily:"'Cormorant Garamond',serif",lineHeight:1.5}}>"{savedAnswer}"</p>
                  </div>
                : <div style={{display:'flex',flexDirection:'column',gap:10}}>
                    <textarea value={answer} onChange={e=>setAnswer(e.target.value)} placeholder="Write your answer…" rows={3}
                      style={{width:'100%',padding:'12px 14px',borderRadius:14,border:'1.5px solid rgba(232,121,160,0.3)',background:'rgba(255,255,255,0.9)',fontSize:13,outline:'none',resize:'none',fontFamily:"'Lato',sans-serif",color:'#1A0510'}}/>
                    <button onClick={saveAnswer} style={{padding:'12px',borderRadius:14,border:'none',background:'linear-gradient(135deg,#E879A0,#A855D4)',color:'white',fontSize:13,cursor:'pointer',fontWeight:700,fontFamily:"'Lato',sans-serif"}}>Share Answer 💗</button>
                  </div>
              }
            </div>
          )}
        </div>

        {/* ── BOTTOM NAV — fixed to bottom always ── */}
        <div style={{position:'fixed',bottom:0,left:0,right:0,zIndex:100,background:'rgba(255,255,255,0.95)',backdropFilter:'blur(20px)',borderTop:'1px solid rgba(232,121,160,0.15)',paddingBottom:'env(safe-area-inset-bottom,0px)',display:'flex',justifyContent:'space-around',alignItems:'center',height:58}}>
          {sections.map(s=>(
            <button key={s.id} onClick={()=>setActiveSection(s.id)} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2,background:'none',border:'none',cursor:'pointer',padding:'4px 8px',borderRadius:12,transition:'all 0.2s',opacity:activeSection===s.id?1:0.45}}>
              <span style={{fontSize:activeSection===s.id?22:18,transition:'font-size 0.2s'}}>{s.emoji}</span>
              <span style={{fontSize:9,color:activeSection===s.id?'#E879A0':'rgba(100,20,50,0.5)',fontWeight:activeSection===s.id?700:400,fontFamily:"'Lato',sans-serif",letterSpacing:'0.3px'}}>{s.label}</span>
              {activeSection===s.id && <div style={{width:4,height:4,borderRadius:'50%',background:'linear-gradient(135deg,#E879A0,#A855D4)'}}/>}
            </button>
          ))}
        </div>

        {/* Floating chat button */}
        <button onClick={onOpenChat} style={{position:'fixed',bottom:'calc(env(safe-area-inset-bottom, 0px) + 65px)',right:18,zIndex:100,width:52,height:52,borderRadius:'50%',background:'linear-gradient(135deg,#E879A0,#A855D4)',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 4px 20px rgba(232,121,160,0.5)',transition:'transform 0.2s'}}
          onMouseEnter={e=>e.currentTarget.style.transform='scale(1.1)'}
          onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>

        <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={handlePhotoUpload}/>
      </div>
    </>
  );
}

export default Dashboard;