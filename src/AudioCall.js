import { useState, useEffect, useRef } from 'react';

const APP_ID  = 'aeb134a2be64445a943d3b8c5e40ee0a';
const CHANNEL = 'srijana-ganesh-2';

function AudioCall({ user, partnerName, onEndCall }) {
  const [status,       setStatus]       = useState('Connecting...');
  const [error,        setError]        = useState(null);
  const [micOn,        setMicOn]        = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [isConnected,  setIsConnected]  = useState(false);
  const [remoteJoined, setRemoteJoined] = useState(false);
  const [pulse,        setPulse]        = useState(false);

  const clientRef    = useRef(null);
  const audioRef     = useRef(null);
  const timerRef     = useRef(null);
  const pulseRef     = useRef(null);

  const formatTime = (s) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

  useEffect(() => {
    const uid = Math.floor(Math.random() * 100000);

    const startCall = async () => {
      try {
        const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;
        const client   = AgoraRTC.createClient({ mode:'rtc', codec:'vp8' });
        clientRef.current = client;

        setStatus('Getting token...');
        const res   = await fetch(`https://agora-token-service-07fo.onrender.com/rtc/${CHANNEL}/publisher/uid/${uid}/`);
        const data  = await res.json();
        const token = data.rtcToken;

        setStatus('Joining...');
        await client.join(APP_ID, CHANNEL, token, uid);

        setStatus('Waiting for partner...');
        const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
        audioRef.current = audioTrack;
        await client.publish([audioTrack]);

        setIsConnected(true);
        timerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);

        // Pulse animation while waiting
        pulseRef.current = setInterval(() => setPulse(p => !p), 800);

        client.on('user-published', async (remote, mediaType) => {
          await client.subscribe(remote, mediaType);
          if (mediaType === 'audio') {
            remote.audioTrack?.play();
            setRemoteJoined(true);
            setStatus('Connected ♡');
            clearInterval(pulseRef.current);
          }
        });
        client.on('user-unpublished', () => { setRemoteJoined(false); setStatus('Partner left...'); });
        client.on('user-left', () => { setRemoteJoined(false); setStatus('Partner disconnected'); });

      } catch (err) {
        console.error(err);
        setError(err.message);
      }
    };
    startCall();

    return () => {
      clearInterval(timerRef.current);
      clearInterval(pulseRef.current);
      try {
        audioRef.current?.stop();
        audioRef.current?.close();
        clientRef.current?.leave();
      } catch {}
    };
  }, []);

  const toggleMic = async () => {
    if (!audioRef.current) return;
    await audioRef.current.setEnabled(!micOn);
    setMicOn(m => !m);
  };

  const handleEndCall = async () => {
    clearInterval(timerRef.current);
    clearInterval(pulseRef.current);
    try { audioRef.current?.stop(); audioRef.current?.close(); await clientRef.current?.leave(); } catch {}
    onEndCall();
  };

  return (
    <>
      <style>{`
        @keyframes audioPulse {
          0%,100% { transform: scale(1); opacity: 0.6; }
          50%      { transform: scale(1.5); opacity: 0; }
        }
        @keyframes ripple1 { 0%{transform:scale(1);opacity:0.4}100%{transform:scale(2.2);opacity:0} }
        @keyframes ripple2 { 0%{transform:scale(1);opacity:0.3}100%{transform:scale(2.8);opacity:0} }
        @keyframes ripple3 { 0%{transform:scale(1);opacity:0.2}100%{transform:scale(3.4);opacity:0} }
      `}</style>

      <div style={{
        position:'fixed', inset:0, zIndex:2000,
        background:'linear-gradient(160deg,#1a0520 0%,#2d0835 40%,#1a1040 100%)',
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        fontFamily:"'Lato',sans-serif",
      }}>
        {/* Status */}
        <p style={{ color:'rgba(255,255,255,0.5)', fontSize:13, marginBottom:40, letterSpacing:'0.5px' }}>
          {error ? `Error: ${error}` : status}
        </p>

        {/* Avatar with ripple */}
        <div style={{ position:'relative', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:40 }}>
          {/* Ripple rings */}
          {remoteJoined && [1,2,3].map(i => (
            <div key={i} style={{
              position:'absolute', width:100, height:100, borderRadius:'50%',
              border:'2px solid rgba(232,121,160,0.6)',
              animation:`ripple${i} ${1.5+i*0.4}s ${i*0.3}s ease-out infinite`,
            }}/>
          ))}
          {!remoteJoined && isConnected && (
            <div style={{ position:'absolute', width:100, height:100, borderRadius:'50%', border:'2px solid rgba(232,121,160,0.4)', animation:'audioPulse 1.6s ease-in-out infinite' }}/>
          )}

          {/* Avatar circle */}
          <div style={{
            width:100, height:100, borderRadius:'50%',
            background:'linear-gradient(135deg,#E879A0,#A855D4)',
            display:'flex', alignItems:'center', justifyContent:'center',
            boxShadow:'0 8px 32px rgba(232,121,160,0.4)',
            fontSize:40, position:'relative', zIndex:1,
          }}>
            💗
          </div>
        </div>

        {/* Name */}
        <h2 style={{ color:'white', fontSize:26, fontWeight:700, margin:'0 0 8px', letterSpacing:'0.5px' }}>{partnerName || 'Partner'}</h2>
        <p style={{ color:'rgba(255,255,255,0.5)', fontSize:14, margin:'0 0 60px' }}>
          {isConnected ? (remoteJoined ? formatTime(callDuration) : 'Ringing...') : 'Connecting...'}
        </p>

        {/* Controls */}
        <div style={{ display:'flex', alignItems:'center', gap:24 }}>
          {/* Mute */}
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
            <button onClick={toggleMic} style={{
              width:60, height:60, borderRadius:'50%', border:'none', cursor:'pointer',
              background: micOn ? 'rgba(255,255,255,0.12)' : 'rgba(240,80,80,0.8)',
              display:'flex', alignItems:'center', justifyContent:'center',
              boxShadow:'0 4px 16px rgba(0,0,0,0.3)', transition:'all 0.2s',
            }}>
              {micOn ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" stroke="white" strokeWidth="2" strokeLinecap="round"/><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" stroke="white" strokeWidth="2" strokeLinecap="round"/><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><line x1="3" y1="3" x2="21" y2="21" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
              )}
            </button>
            <span style={{ fontSize:11, color:'rgba(255,255,255,0.5)' }}>{micOn ? 'Mute' : 'Unmute'}</span>
          </div>

          {/* End call */}
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
            <button onClick={handleEndCall} style={{
              width:72, height:72, borderRadius:'50%', border:'none', cursor:'pointer',
              background:'linear-gradient(135deg,#FF4B6E,#C0392B)',
              display:'flex', alignItems:'center', justifyContent:'center',
              boxShadow:'0 6px 24px rgba(192,57,43,0.5)', transition:'all 0.2s',
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M16.5 8.3A9.77 9.77 0 0012 7a9.77 9.77 0 00-4.5 1.3L5 6.1A12 12 0 0112 4a12 12 0 017 2.1l-2.5 2.2zM20.1 11.9l-2.2 2.2a9.8 9.8 0 01-.9 3.4l2.1 2.1A12 12 0 0021 12c0-.03 0-.07-.9-.1z" fill="white"/>
                <path d="M3.51 3.51L20.49 20.49" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                <path d="M6.5 6.5C5 8 4 9.9 4 12a12 12 0 001.9 6.5l2.1-2.1a9.8 9.8 0 01-.9-3.4L4.8 10.8" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
            <span style={{ fontSize:11, color:'rgba(255,255,255,0.5)' }}>End Call</span>
          </div>

          {/* Speaker placeholder */}
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
            <button style={{
              width:60, height:60, borderRadius:'50%', border:'none', cursor:'pointer',
              background:'rgba(255,255,255,0.12)',
              display:'flex', alignItems:'center', justifyContent:'center',
              boxShadow:'0 4px 16px rgba(0,0,0,0.3)',
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M15.54 8.46a5 5 0 010 7.07M19.07 4.93a10 10 0 010 14.14" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
            </button>
            <span style={{ fontSize:11, color:'rgba(255,255,255,0.5)' }}>Speaker</span>
          </div>
        </div>
      </div>
    </>
  );
}

export default AudioCall;