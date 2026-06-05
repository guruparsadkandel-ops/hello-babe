import { useState, useRef, useEffect } from 'react';
import { auth, db, storage } from './firebase';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// 30 preset couple-themed avatars using emoji + gradient combos
const PRESET_AVATARS = [
  { id: 'p1',  emoji: '🌸', bg: 'linear-gradient(135deg,#ff9a9e,#fad0c4)' },
  { id: 'p2',  emoji: '🔥', bg: 'linear-gradient(135deg,#f83600,#f9d423)' },
  { id: 'p3',  emoji: '🌙', bg: 'linear-gradient(135deg,#2c3e50,#4a6fa5)' },
  { id: 'p4',  emoji: '🌻', bg: 'linear-gradient(135deg,#f7971e,#ffd200)' },
  { id: 'p5',  emoji: '🦋', bg: 'linear-gradient(135deg,#a18cd1,#fbc2eb)' },
  { id: 'p6',  emoji: '🐻', bg: 'linear-gradient(135deg,#d4a853,#8B5A20)' },
  { id: 'p7',  emoji: '🌊', bg: 'linear-gradient(135deg,#0575e6,#021b79)' },
  { id: 'p8',  emoji: '🌺', bg: 'linear-gradient(135deg,#f953c6,#b91d73)' },
  { id: 'p9',  emoji: '🍀', bg: 'linear-gradient(135deg,#134e5e,#71b280)' },
  { id: 'p10', emoji: '⭐', bg: 'linear-gradient(135deg,#373b44,#4286f4)' },
  { id: 'p11', emoji: '🦊', bg: 'linear-gradient(135deg,#e96c1a,#c0392b)' },
  { id: 'p12', emoji: '🌈', bg: 'linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045)' },
  { id: 'p13', emoji: '🐼', bg: 'linear-gradient(135deg,#2c2c2c,#808080)' },
  { id: 'p14', emoji: '🌷', bg: 'linear-gradient(135deg,#f0a0b0,#c0392b)' },
  { id: 'p15', emoji: '🦁', bg: 'linear-gradient(135deg,#b8860b,#8B5A20)' },
  { id: 'p16', emoji: '🍓', bg: 'linear-gradient(135deg,#eb3349,#f45c43)' },
  { id: 'p17', emoji: '🐉', bg: 'linear-gradient(135deg,#1a1a2e,#16213e)' },
  { id: 'p18', emoji: '🌿', bg: 'linear-gradient(135deg,#1d4350,#a43931)' },
  { id: 'p19', emoji: '🦄', bg: 'linear-gradient(135deg,#c471ed,#f64f59)' },
  { id: 'p20', emoji: '🍁', bg: 'linear-gradient(135deg,#c94b4b,#4b134f)' },
  { id: 'p21', emoji: '🐬', bg: 'linear-gradient(135deg,#2980b9,#6dd5fa)' },
  { id: 'p22', emoji: '🌃', bg: 'linear-gradient(135deg,#0f0c29,#302b63,#24243e)' },
  { id: 'p23', emoji: '🎸', bg: 'linear-gradient(135deg,#1a1a1a,#c0392b)' },
  { id: 'p24', emoji: '🍵', bg: 'linear-gradient(135deg,#56ab2f,#a8e063)' },
  { id: 'p25', emoji: '🐧', bg: 'linear-gradient(135deg,#2c3e50,#bdc3c7)' },
  { id: 'p26', emoji: '🌍', bg: 'linear-gradient(135deg,#1a6b1a,#0a3d62)' },
  { id: 'p27', emoji: '🎀', bg: 'linear-gradient(135deg,#ff758c,#ff7eb3)' },
  { id: 'p28', emoji: '🦅', bg: 'linear-gradient(135deg,#283048,#859398)' },
  { id: 'p29', emoji: '🍦', bg: 'linear-gradient(135deg,#f8cdda,#1d2b64)' },
  { id: 'p30', emoji: '💎', bg: 'linear-gradient(135deg,#4facfe,#00f2fe)' },
];

function Avatar({ photoURL, presetAvatar, name, size = 72, border = '2px solid rgba(212,168,83,0.6)' }) {
  if (photoURL) {
    return (
      <div style={{ width: size, height: size, borderRadius: '50%', border, overflow: 'hidden', flexShrink: 0 }}>
        <img src={photoURL} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    );
  }
  if (presetAvatar) {
    const preset = PRESET_AVATARS.find(p => p.id === presetAvatar);
    if (preset) {
      return (
        <div style={{ width: size, height: size, borderRadius: '50%', border, background: preset.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.42, flexShrink: 0 }}>
          {preset.emoji}
        </div>
      );
    }
  }
  // Fallback: initial letter
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', border, background: 'linear-gradient(135deg,#C0392B,#7B1A1A)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.42, color: '#F5DEB3', fontFamily: "'Cormorant Garamond',Georgia,serif", fontWeight: 600, flexShrink: 0 }}>
      {(name || '?').charAt(0).toUpperCase()}
    </div>
  );
}

function Profile({ user, onBack, onUpdate }) {
  const [photoURL, setPhotoURL]         = useState(user.photoURL || '');
  const [presetAvatar, setPresetAvatar] = useState(user.presetAvatar || '');
  const [tab, setTab]                   = useState('preset'); // 'preset' | 'upload'
  const [uploading, setUploading]       = useState(false);
  const [saving, setSaving]             = useState(false);
  const [success, setSuccess]           = useState(false);
  const [error, setError]               = useState('');
  const [preview, setPreview]           = useState('');
  const [pendingFile, setPendingFile]   = useState(null);
  const fileRef                         = useRef(null);

  // Live-listen for partner's avatar updates too
  useEffect(() => {
    if (!user.uid) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setPhotoURL(d.photoURL || '');
        setPresetAvatar(d.presetAvatar || '');
      }
    });
    return unsub;
  }, [user.uid]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError('Image must be under 5MB.'); return; }
    setError('');
    setPendingFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target.result);
    reader.readAsDataURL(file);
    setPresetAvatar(''); // clear preset if uploading
  };

  const handleSelectPreset = (id) => {
    setPresetAvatar(id);
    setPreview('');
    setPendingFile(null);
    setPhotoURL('');
  };

  const handleSave = async () => {
    setSaving(true); setError(''); setSuccess(false);
    try {
      let finalPhotoURL = photoURL;
      let finalPreset   = presetAvatar;

      if (pendingFile) {
        setUploading(true);
        const storageRef = ref(storage, `avatars/${user.uid}`);
        await uploadBytes(storageRef, pendingFile);
        finalPhotoURL = await getDownloadURL(storageRef);
        finalPreset   = '';
        setUploading(false);
      }

      await updateDoc(doc(db, 'users', user.uid), {
        photoURL:     finalPhotoURL,
        presetAvatar: finalPreset,
      });

      setPhotoURL(finalPhotoURL);
      setPresetAvatar(finalPreset);
      setPendingFile(null);
      setPreview('');
      setSuccess(true);
      onUpdate({ ...user, photoURL: finalPhotoURL, presetAvatar: finalPreset });
      setTimeout(() => setSuccess(false), 2500);
    } catch (err) {
      console.error(err);
      setError('Failed to save. Please try again.');
    }
    setSaving(false);
  };

  const currentPhotoURL    = preview || photoURL;
  const currentPresetAvatar = preview ? '' : presetAvatar;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=DM+Sans:wght@300;400;500&display=swap');
        .preset-grid::-webkit-scrollbar{width:3px}
        .preset-grid::-webkit-scrollbar-thumb{background:rgba(212,168,83,.2);border-radius:3px}
        .preset-item{transition:transform 0.15s,box-shadow 0.15s;}
        .preset-item:hover{transform:scale(1.08);}
        .tab-btn{transition:all 0.2s;}
      `}</style>

      <div style={{ display:'flex', flexDirection:'column', height:'100vh', background:'#0D0A1A', fontFamily:"'DM Sans',sans-serif", overflow:'hidden' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 20px', background:'#1C1630', borderBottom:'1px solid rgba(212,168,83,0.15)', flexShrink:0 }}>
          <button onClick={onBack} style={{ width:36, height:36, borderRadius:'50%', background:'rgba(212,168,83,0.08)', border:'1px solid rgba(212,168,83,0.2)', cursor:'pointer', color:'#D4A853', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center' }}>←</button>
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:18, fontWeight:600, color:'#E8E0F5' }}>Your Profile</div>
            <div style={{ fontSize:11, color:'#6B608A', marginTop:1 }}>personalise your presence</div>
          </div>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'24px 20px' }}>

          {/* Current avatar preview */}
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', marginBottom:28 }}>
            <div style={{ position:'relative', marginBottom:12 }}>
              <Avatar
                photoURL={currentPhotoURL}
                presetAvatar={currentPresetAvatar}
                name={user.name}
                size={96}
                border='3px solid rgba(212,168,83,0.5)'
              />
              {/* Ring glow */}
              <div style={{ position:'absolute', inset:-4, borderRadius:'50%', border:'1px solid rgba(212,168,83,0.15)', pointerEvents:'none' }}/>
            </div>
            <div style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:20, fontWeight:600, color:'#E8E0F5' }}>{user.name}</div>
            <div style={{ fontSize:11, color:'#6B608A', marginTop:2 }}>{user.email}</div>
          </div>

          {/* Tabs */}
          <div style={{ display:'flex', gap:8, marginBottom:20, background:'#15102A', borderRadius:14, padding:4 }}>
            {[['preset','✨ Pick Avatar'],['upload','📷 Upload Photo']].map(([id, label]) => (
              <button key={id} className="tab-btn" onClick={() => setTab(id)} style={{
                flex:1, padding:'9px 0', borderRadius:10, border:'none', cursor:'pointer', fontSize:12, fontWeight:500,
                background: tab === id ? 'linear-gradient(135deg,#C0392B,#7B1A1A)' : 'transparent',
                color: tab === id ? 'white' : '#6B608A',
                fontFamily:"'DM Sans',sans-serif",
              }}>{label}</button>
            ))}
          </div>

          {/* Preset grid */}
          {tab === 'preset' && (
            <div>
              <p style={{ color:'#6B608A', fontSize:11, marginBottom:12, letterSpacing:'0.5px', textTransform:'uppercase' }}>Choose your vibe</p>
              <div className="preset-grid" style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10, maxHeight:320, overflowY:'auto', paddingRight:4 }}>
                {PRESET_AVATARS.map((p) => {
                  const selected = presetAvatar === p.id && !preview;
                  return (
                    <button key={p.id} className="preset-item" onClick={() => handleSelectPreset(p.id)} style={{
                      width:'100%', aspectRatio:'1', borderRadius:'50%', border: selected ? '2.5px solid #D4A853' : '2px solid transparent',
                      background: p.bg, cursor:'pointer', fontSize:22, display:'flex', alignItems:'center', justifyContent:'center',
                      boxShadow: selected ? '0 0 12px rgba(212,168,83,0.5)' : 'none', outline:'none', padding:0,
                    }}>{p.emoji}</button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Upload tab */}
          {tab === 'upload' && (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:16 }}>
              <div
                onClick={() => fileRef.current?.click()}
                style={{
                  width:'100%', height:140, borderRadius:16, border:'1.5px dashed rgba(212,168,83,0.3)',
                  background:'#15102A', display:'flex', flexDirection:'column', alignItems:'center',
                  justifyContent:'center', cursor:'pointer', gap:8, color:'#6B608A',
                }}
              >
                {preview ? (
                  <img src={preview} alt="preview" style={{ width:90, height:90, borderRadius:'50%', objectFit:'cover', border:'2px solid rgba(212,168,83,0.4)' }}/>
                ) : (
                  <>
                    <div style={{ fontSize:32 }}>📷</div>
                    <div style={{ fontSize:12 }}>Tap to choose a photo</div>
                    <div style={{ fontSize:10, color:'#3D3555' }}>JPG, PNG · max 5MB</div>
                  </>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display:'none' }}/>
              {preview && (
                <button onClick={() => { setPreview(''); setPendingFile(null); }} style={{ fontSize:11, color:'#C0392B', background:'none', border:'none', cursor:'pointer' }}>
                  ✕ Remove
                </button>
              )}
            </div>
          )}

          {/* Feedback */}
          {error   && <p style={{ color:'#C0392B', fontSize:12, textAlign:'center', marginTop:14, background:'rgba(192,57,43,0.1)', borderRadius:8, padding:'8px' }}>{error}</p>}
          {success && <p style={{ color:'#4CAF8A', fontSize:12, textAlign:'center', marginTop:14, background:'rgba(76,175,138,0.1)', borderRadius:8, padding:'8px' }}>✓ Profile updated!</p>}

          {/* Save button */}
          <button onClick={handleSave} disabled={saving} style={{
            width:'100%', marginTop:22, padding:'13px', borderRadius:22, border:'none',
            background: saving ? '#3D3555' : 'linear-gradient(135deg,#C0392B,#7B1A1A)',
            color:'white', fontSize:14, fontWeight:600, cursor: saving ? 'not-allowed' : 'pointer',
            fontFamily:"'DM Sans',sans-serif", letterSpacing:1,
            boxShadow: saving ? 'none' : '0 4px 20px rgba(192,57,43,0.35)',
          }}>
            {uploading ? 'Uploading…' : saving ? 'Saving…' : 'Save Profile'}
          </button>
        </div>
      </div>
    </>
  );
}

export { Avatar, PRESET_AVATARS };
export default Profile;