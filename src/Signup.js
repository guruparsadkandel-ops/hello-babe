import { useState } from 'react';
import { auth, db } from './firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

function Signup({ onSignup, onBack }) {
  const [name, setName]           = useState('');
  const [email, setEmail]         = useState('');
  const [partnerEmail, setPartnerEmail] = useState('');
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);

  const handleSignup = async () => {
    setError('');
    if (!name.trim())                        return setError('Please enter your name.');
    if (!email.trim())                       return setError('Please enter your email.');
    if (!partnerEmail.trim())                return setError('Please enter your partner\'s email.');
    if (email === partnerEmail)              return setError('Your email and partner\'s email must be different.');
    if (password.length < 6)                return setError('Password must be at least 6 characters.');
    if (password !== confirm)               return setError('Passwords do not match.');

    setLoading(true);
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      const uid = result.user.uid;

      // Generate a consistent coupleId from both emails (sorted so both partners get same ID)
      const coupleId = [email.toLowerCase(), partnerEmail.toLowerCase()].sort().join('_');

      // Save user profile to Firestore
      await setDoc(doc(db, 'users', uid), {
        name:         name.trim(),
        email:        email.toLowerCase(),
        partnerEmail: partnerEmail.toLowerCase(),
        coupleId,
        createdAt:    new Date(),
      });

      onSignup({ name: name.trim(), coupleId, email: email.toLowerCase() });
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') setError('This email is already registered. Please log in.');
      else if (err.code === 'auth/invalid-email')   setError('Invalid email address.');
      else                                           setError('Something went wrong. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div style={{
      height: '100vh', width: '100vw', overflow: 'hidden',
      background: 'linear-gradient(180deg, #FFFFFF 0%, #FDF6ED 50%, #FAF0E0 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', fontFamily: "'Arial Black', sans-serif",
      position: 'relative', boxSizing: 'border-box',
    }}>

      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 200,
        background: 'linear-gradient(180deg, #F5DEB3 0%, transparent 100%)',
        opacity: 0.45, pointerEvents: 'none'
      }}/>

      {/* Card */}
      <div style={{
        width: '88%', maxWidth: 340,
        background: '#FFFFFF', borderRadius: 24,
        border: '1.5px solid rgba(200,149,108,0.3)',
        padding: '28px 22px 22px',
        boxShadow: '0 8px 30px rgba(139,90,32,0.12)',
        zIndex: 10, boxSizing: 'border-box',
      }}>
        {/* Logo row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 4 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: 'linear-gradient(135deg, #C8956C, #8B5A20)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid #fff', boxShadow: '0 3px 10px rgba(139,90,32,0.2)'
          }}>
            <span style={{ fontFamily:"'Arial Black',sans-serif", fontWeight:900, fontSize:9, color:'white' }}>Hii!</span>
          </div>
          <span style={{ fontFamily:"'Arial Black',sans-serif", fontWeight:900, fontSize:16, color:'#8B5A20', letterSpacing:2 }}>HELLO BABE</span>
        </div>

        <h2 style={{ color:'#5C3810', textAlign:'center', fontSize:17, margin:'10px 0 3px', fontWeight:900 }}>Create Account</h2>
        <p style={{ color:'#A0692E', textAlign:'center', fontSize:11, margin:'0 0 18px', fontFamily:'Arial,sans-serif' }}>Start your private world together 💛</p>

        {error && <p style={{ color:'#C0392B', textAlign:'center', fontSize:12, marginBottom:10, fontFamily:'Arial,sans-serif', background:'#FFF0F0', borderRadius:8, padding:'8px' }}>{error}</p>}

        <input type="text" placeholder="Your name" value={name} onChange={e => setName(e.target.value)}
          style={{ width:'100%', padding:'10px 16px', borderRadius:20, border:'1.5px solid #E8D5B8', background:'#FDFAF5', color:'#5C3810', fontSize:13, marginBottom:9, outline:'none', boxSizing:'border-box', fontFamily:'Arial,sans-serif' }}/>

        <input type="email" placeholder="Your email" value={email} onChange={e => setEmail(e.target.value)}
          style={{ width:'100%', padding:'10px 16px', borderRadius:20, border:'1.5px solid #E8D5B8', background:'#FDFAF5', color:'#5C3810', fontSize:13, marginBottom:9, outline:'none', boxSizing:'border-box', fontFamily:'Arial,sans-serif' }}/>

        <input type="email" placeholder="Partner's email" value={partnerEmail} onChange={e => setPartnerEmail(e.target.value)}
          style={{ width:'100%', padding:'10px 16px', borderRadius:20, border:'1.5px solid #E8D5B8', background:'#FDFAF5', color:'#5C3810', fontSize:13, marginBottom:9, outline:'none', boxSizing:'border-box', fontFamily:'Arial,sans-serif' }}/>

        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
          style={{ width:'100%', padding:'10px 16px', borderRadius:20, border:'1.5px solid #E8D5B8', background:'#FDFAF5', color:'#5C3810', fontSize:13, marginBottom:9, outline:'none', boxSizing:'border-box', fontFamily:'Arial,sans-serif' }}/>

        <input type="password" placeholder="Confirm password" value={confirm} onChange={e => setConfirm(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSignup()}
          style={{ width:'100%', padding:'10px 16px', borderRadius:20, border:'1.5px solid #E8D5B8', background:'#FDFAF5', color:'#5C3810', fontSize:13, marginBottom:16, outline:'none', boxSizing:'border-box', fontFamily:'Arial,sans-serif' }}/>

        <button onClick={handleSignup} disabled={loading} style={{
          width:'100%', padding:'12px', borderRadius:22, border:'none',
          background: loading ? '#C8956C' : 'linear-gradient(135deg,#C8956C,#8B5A20)',
          color:'white', fontSize:14, fontWeight:900, letterSpacing:2,
          cursor: loading ? 'not-allowed' : 'pointer',
          fontFamily:"'Arial Black',sans-serif",
          boxShadow:'0 4px 16px rgba(139,90,32,0.3)', marginBottom:14
        }}>
          {loading ? 'CREATING...' : 'SIGN UP'}
        </button>

        <p style={{ textAlign:'center', fontSize:12, color:'#A0692E', margin:0, fontFamily:'Arial,sans-serif' }}>
          Already have an account?{' '}
          <span onClick={onBack} style={{ color:'#8B5A20', cursor:'pointer', fontWeight:'bold' }}>Log in</span>
        </p>
      </div>

      {/* Bottom bar */}
      <div style={{ position:'absolute', bottom:0, width:'100%' }}>
        <div style={{ height:4, background:'#C8956C' }}/>
        <div style={{ height:4, background:'#8B5A20' }}/>
      </div>
    </div>
  );
}

export default Signup;