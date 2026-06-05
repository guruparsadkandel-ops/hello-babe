import { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import Login from './Login';
import Signup from './Signup';
import Chat from './Chat';
import Profile from './Profile';
import Dashboard from './Dashboard';

function App() {
  const [screen, setScreen]     = useState('login'); // 'login'|'signup'|'chat'|'profile'|'dashboard'
  const [userData, setUserData] = useState(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (snap.exists()) {
            setUserData({ uid: firebaseUser.uid, ...snap.data() });
            setScreen('dashboard'); // → dashboard first, not chat
          } else {
            setScreen('login');
          }
        } catch {
          setScreen('login');
        }
      } else {
        setUserData(null);
        setScreen('login');
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleLogin  = (data) => { setUserData(data); setScreen('dashboard'); };
  const handleSignup = (data) => { setUserData(data); setScreen('dashboard'); };
  const handleLogout = () => { auth.signOut(); setUserData(null); setScreen('login'); };

  const handleProfileUpdate = (updatedUser) => { setUserData(updatedUser); };

  if (loading) return (
    <div style={{
      height:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      background:'linear-gradient(160deg,#FFF5F7,#FFF0F5,#FDF5FF)',
      fontFamily:"'Lato',sans-serif", flexDirection:'column', gap:12,
    }}>
      <div style={{ fontSize:32, animation:'pulse 1.5s ease-in-out infinite' }}>💗</div>
      <p style={{ color:'rgba(180,60,100,0.6)', fontSize:13, margin:0 }}>Loading your love space…</p>
      <style>{`@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.2)}}`}</style>
    </div>
  );

  if (screen === 'signup')    return <Signup onSignup={handleSignup} onBack={() => setScreen('login')} />;
  if (screen === 'profile')   return <Profile user={userData} onBack={() => setScreen('dashboard')} onUpdate={handleProfileUpdate} />;
  if (screen === 'dashboard') return <Dashboard user={userData} onOpenChat={() => setScreen('chat')} onOpenProfile={() => setScreen('profile')} onLogout={handleLogout} />;
  if (screen === 'chat')      return <Chat user={userData} onLogout={handleLogout} onOpenProfile={() => setScreen('dashboard')} />;
  return <Login onLogin={handleLogin} onSignup={() => setScreen('signup')} />;
}

export default App;