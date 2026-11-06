import { useState, useEffect, useRef } from 'react';

const APP_ID    = 'aeb134a2be64445a943d3b8c5e40ee0a';
const CHANNEL   = 'srijana-ganesh-video';
const TOKEN_URL = 'https://agora-token-service-07fo.onrender.com/rtc';

const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

function VideoCall({ user, partnerName, onEndCall }) {
  const [status,       setStatus]       = useState('Connecting...');
  const [error,        setError]        = useState(null);
  const [micOn,        setMicOn]        = useState(true);
  const [camOn,        setCamOn]        = useState(true);
  const [hasCamera,    setHasCamera]    = useState(true);
  const [remoteJoined, setRemoteJoined] = useState(false);
  const [remoteVideo,  setRemoteVideo]  = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [facing,       setFacing]       = useState('user');

  const clientRef      = useRef(null);
  const micTrackRef    = useRef(null);
  const camTrackRef    = useRef(null);
  const timerRef       = useRef(null);
  const localBoxRef    = useRef(null);
  const remoteBoxRef   = useRef(null);
  const remoteUserRef  = useRef(null);
  const endedRef       = useRef(false);

  // ── Join call ──────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false; // guards against React StrictMode double-mount in dev
    const uid = Math.floor(Math.random() * 100000);

    const cleanup = async () => {
      clearInterval(timerRef.current);
      timerRef.current = null;
      try { micTrackRef.current?.stop(); micTrackRef.current?.close(); } catch {}
      try { camTrackRef.current?.stop(); camTrackRef.current?.close(); } catch {}
      micTrackRef.current = null;
      camTrackRef.current = null;
      try { await clientRef.current?.leave(); } catch {}
      clientRef.current?.removeAllListeners();
      clientRef.current = null;
    };

    const startCall = async () => {
      try {
        const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;
        if (cancelled) return;
        AgoraRTC.setLogLevel(3); // warnings and errors only

        const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
        clientRef.current = client;

        // Register listeners BEFORE join so a partner already in the channel is not missed
        client.on('user-published', async (remote, mediaType) => {
          try {
            await client.subscribe(remote, mediaType);
          } catch (err) {
            console.error('Subscribe failed:', err);
            return;
          }
          remoteUserRef.current = remote;
          setRemoteJoined(true);
          setStatus('Connected ♡');
          if (!timerRef.current) {
            timerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
          }
          if (mediaType === 'video' && remoteBoxRef.current) {
            remote.videoTrack?.play(remoteBoxRef.current, { fit: 'cover' });
            setRemoteVideo(true);
          }
          if (mediaType === 'audio') {
            remote.audioTrack?.play();
          }
        });

        client.on('user-unpublished', (remote, mediaType) => {
          if (mediaType === 'video') setRemoteVideo(false);
        });

        client.on('user-left', () => {
          remoteUserRef.current = null;
          setRemoteJoined(false);
          setRemoteVideo(false);
          setStatus('Partner left the call');
        });

        client.on('connection-state-change', (cur) => {
          if (cur === 'RECONNECTING') setStatus('Reconnecting...');
          if (cur === 'CONNECTED' && remoteUserRef.current) setStatus('Connected ♡');
        });

        setStatus('Getting token...');
        const res = await fetch(`${TOKEN_URL}/${CHANNEL}/publisher/uid/${uid}/`);
        if (!res.ok) throw new Error(`Token server returned ${res.status}`);
        const data = await res.json();
        if (!data.rtcToken) throw new Error('Token server returned no token');
        if (cancelled) return;

        setStatus('Joining...');
        await client.join(APP_ID, CHANNEL, data.rtcToken, uid);
        if (cancelled) { await client.leave(); return; }

        // Mic is required, camera is optional (falls back to audio-only)
        const micTrack = await AgoraRTC.createMicrophoneAudioTrack();
        micTrackRef.current = micTrack;

        let camTrack = null;
        try {
          camTrack = await AgoraRTC.createCameraVideoTrack({
            facingMode: 'user',
            encoderConfig: '480p_1',
          });
          camTrackRef.current = camTrack;
        } catch (camErr) {
          console.warn('Camera unavailable, continuing audio-only:', camErr);
          setHasCamera(false);
          setCamOn(false);
        }

        if (cancelled) { await cleanup(); return; }

        if (camTrack && localBoxRef.current) {
          camTrack.play(localBoxRef.current, { fit: 'cover', mirror: true });
        }

        await client.publish(camTrack ? [micTrack, camTrack] : [micTrack]);
        if (!remoteUserRef.current) setStatus('Waiting for partner...');
      } catch (err) {
        if (cancelled) return;
        console.error(err);
        const msg =
          err?.code === 'PERMISSION_DENIED' || err?.name === 'NotAllowedError'
            ? 'Camera/microphone permission denied. Allow access in your browser settings.'
            : err?.message || 'Could not start the call.';
        setError(msg);
      }
    };

    startCall();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, []);

  // ── Replay remote video if the container re-mounts ─────────────
  useEffect(() => {
    const remote = remoteUserRef.current;
    if (remoteVideo && remote?.videoTrack && remoteBoxRef.current && !remote.videoTrack.isPlaying) {
      remote.videoTrack.play(remoteBoxRef.current, { fit: 'cover' });
    }
  }, [remoteVideo]);

  // ── Controls ───────────────────────────────────────────────────
  const toggleMic = async () => {
    if (!micTrackRef.current) return;
    await micTrackRef.current.setEnabled(!micOn);
    setMicOn(m => !m);
  };

  const toggleCam = async () => {
    if (!camTrackRef.current) return;
    await camTrackRef.current.setEnabled(!camOn);
    setCamOn(c => !c);
  };

  const switchCamera = async () => {
    const track = camTrackRef.current;
    if (!track || !camOn) return;
    const next = facing === 'user' ? 'environment' : 'user';
    try {
      await track.setDevice({ facingMode: next });
      setFacing(next);
    } catch {
      // Fallback for browsers without facingMode support: cycle through cameras
      try {
        const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;
        const cams = await AgoraRTC.getCameras();
        if (cams.length < 2) return;
        const currentLabel = track.getTrackLabel();
        const idx = cams.findIndex(c => c.label === currentLabel);
        const nextCam = cams[(idx + 1) % cams.length];
        await track.setDevice(nextCam.deviceId);
        setFacing(next);
      } catch (err) {
        console.error('Switch camera failed:', err);
      }
    }
  };

  const handleEndCall = async () => {
    if (endedRef.current) return;
    endedRef.current = true;
    clearInterval(timerRef.current);
    try { micTrackRef.current?.stop(); micTrackRef.current?.close(); } catch {}
    try { camTrackRef.current?.stop(); camTrackRef.current?.close(); } catch {}
    try { await clientRef.current?.leave(); } catch {}
    onEndCall();
  };

  // ── UI ─────────────────────────────────────────────────────────
  const btn = (active, danger) => ({
    width: 56, height: 56, borderRadius: '50%', border: 'none', cursor: 'pointer',
    background: danger
      ? 'linear-gradient(135deg,#FF4B6E,#C0392B)'
      : active ? 'rgba(255,255,255,0.15)' : 'rgba(240,80,80,0.85)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 4px 16px rgba(0,0,0,0.35)', transition: 'all 0.2s',
    backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
  });

  const label = { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 6, textAlign: 'center' };

  return (
    <>
      <style>{`
        @keyframes vcPulse { 0%,100%{transform:scale(1);opacity:.6} 50%{transform:scale(1.4);opacity:0} }
        .vc-video > div { border-radius: inherit; }
        .vc-video video { object-fit: cover; }
      `}</style>

      <div style={{
        position: 'fixed', inset: 0, zIndex: 2000, overflow: 'hidden',
        background: 'linear-gradient(160deg,#1a0520 0%,#2d0835 40%,#1a1040 100%)',
        fontFamily: "'Lato',sans-serif",
      }}>
        {/* Remote video (full screen) */}
        <div
          ref={remoteBoxRef}
          className="vc-video"
          style={{
            position: 'absolute', inset: 0,
            opacity: remoteVideo ? 1 : 0, transition: 'opacity 0.3s',
          }}
        />

        {/* Placeholder while partner video is not showing */}
        {!remoteVideo && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 16,
          }}>
            <div style={{ position: 'relative', width: 100, height: 100 }}>
              {!error && (
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: '50%',
                  border: '2px solid rgba(232,121,160,0.5)', animation: 'vcPulse 1.6s ease-in-out infinite',
                }} />
              )}
              <div style={{
                width: 100, height: 100, borderRadius: '50%',
                background: 'linear-gradient(135deg,#E879A0,#A855D4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 40, boxShadow: '0 8px 32px rgba(232,121,160,0.4)',
              }}>💗</div>
            </div>
            <h2 style={{ color: 'white', fontSize: 24, fontWeight: 700, margin: 0 }}>
              {partnerName || 'Video call'}
            </h2>
            <p style={{ color: error ? '#FFB4B4' : 'rgba(255,255,255,0.6)', fontSize: 13, margin: 0, maxWidth: 280, textAlign: 'center' }}>
              {error ? error : remoteJoined ? 'Partner camera is off' : status}
            </p>
          </div>
        )}

        {/* Top bar: status + timer */}
        {remoteJoined && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, padding: '18px 20px',
            background: 'linear-gradient(180deg,rgba(0,0,0,0.5),transparent)',
            color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>{partnerName || 'Partner'}</span>
            <span style={{ fontSize: 13, opacity: 0.8 }}>{status === 'Connected ♡' ? formatTime(callDuration) : status}</span>
          </div>
        )}

        {/* Local preview (picture-in-picture) */}
        {hasCamera && (
          <div style={{
            position: 'absolute', top: 70, right: 16, width: 110, height: 150,
            borderRadius: 16, overflow: 'hidden', background: '#000',
            border: '2px solid rgba(255,255,255,0.25)', boxShadow: '0 6px 24px rgba(0,0,0,0.4)',
            zIndex: 2,
          }}>
            <div ref={localBoxRef} className="vc-video" style={{ width: '100%', height: '100%', visibility: camOn ? 'visible' : 'hidden' }} />
            {!camOn && (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'rgba(255,255,255,0.6)', fontSize: 11,
              }}>Camera off</div>
            )}
          </div>
        )}

        {/* Controls */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, padding: '24px 16px 36px',
          background: 'linear-gradient(0deg,rgba(0,0,0,0.6),transparent)',
          display: 'flex', justifyContent: 'center', alignItems: 'flex-start', gap: 20, zIndex: 3,
        }}>
          {/* Mic */}
          <div>
            <button onClick={toggleMic} style={btn(micOn)} aria-label={micOn ? 'Mute' : 'Unmute'}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" stroke="white" strokeWidth="2" strokeLinecap="round" />
                <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                {!micOn && <line x1="3" y1="3" x2="21" y2="21" stroke="white" strokeWidth="2" strokeLinecap="round" />}
              </svg>
            </button>
            <div style={label}>{micOn ? 'Mute' : 'Unmute'}</div>
          </div>

          {/* Camera on/off */}
          <div>
            <button onClick={toggleCam} disabled={!hasCamera} style={{ ...btn(camOn), opacity: hasCamera ? 1 : 0.4 }} aria-label={camOn ? 'Camera off' : 'Camera on'}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M23 7l-7 5 7 5V7z" stroke="white" strokeWidth="2" strokeLinejoin="round" />
                <rect x="1" y="5" width="15" height="14" rx="2" stroke="white" strokeWidth="2" />
                {!camOn && <line x1="2" y1="2" x2="22" y2="22" stroke="white" strokeWidth="2" strokeLinecap="round" />}
              </svg>
            </button>
            <div style={label}>{camOn ? 'Camera' : 'Cam off'}</div>
          </div>

          {/* End call */}
          <div>
            <button onClick={handleEndCall} style={{ ...btn(true, true), width: 68, height: 68 }} aria-label="End call">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="white" style={{ transform: 'rotate(135deg)' }}>
                <path d="M20 15.5c-1.25 0-2.45-.2-3.57-.57a1 1 0 00-1.02.24l-2.2 2.2a15.07 15.07 0 01-6.59-6.59l2.2-2.21a.96.96 0 00.25-1A11.36 11.36 0 018.5 4a1 1 0 00-1-1H4a1 1 0 00-1 1 17 17 0 0017 17 1 1 0 001-1v-3.5a1 1 0 00-1-1z" />
              </svg>
            </button>
            <div style={label}>End</div>
          </div>

          {/* Switch camera */}
          <div>
            <button onClick={switchCamera} disabled={!hasCamera || !camOn} style={{ ...btn(true), opacity: hasCamera && camOn ? 1 : 0.4 }} aria-label="Switch camera">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M20 7h-3l-2-3H9L7 7H4a2 2 0 00-2 2v9a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z" stroke="white" strokeWidth="2" strokeLinejoin="round" />
                <path d="M9 13.5a3 3 0 015-2.2M15 12.5a3 3 0 01-5 2.2" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M14 9.5v2h-2M10 16.5v-2h2" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div style={label}>Flip</div>
          </div>
        </div>
      </div>
    </>
  );
}

export default VideoCall;
