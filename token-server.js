const express = require('express');
const cors = require('cors');
const { RtcTokenBuilder, RtcRole } = require('agora-token');

const app = express();
app.use(cors());

const APP_ID = process.env.AGORA_APP_ID;
const APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE;

if (!APP_ID || !APP_CERTIFICATE) {
  console.error('Set AGORA_APP_ID and AGORA_APP_CERTIFICATE environment variables.');
  process.exit(1);
}

app.get('/token', (req, res) => {
  const channel = req.query.channel || 'srijana-ganesh-2';
  const uid = parseInt(req.query.uid) || 0;
  const role = RtcRole.PUBLISHER;
  const expireTime = 3600;
  const currentTime = Math.floor(Date.now() / 1000);
  const privilegeExpireTime = currentTime + expireTime;

  const token = RtcTokenBuilder.buildTokenWithUid(
    APP_ID, APP_CERTIFICATE, channel, uid, role, privilegeExpireTime, privilegeExpireTime
  );

  res.json({ token });
});

app.listen(5000, () => console.log('Token server running on port 5000'));