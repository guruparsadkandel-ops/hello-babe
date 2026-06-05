const express = require('express');
const cors = require('cors');
const { RtcTokenBuilder, RtcRole } = require('agora-token');

const app = express();
app.use(cors());

const APP_ID = 'aeb134a2be64445a943d3b8c5e40ee0a';
const APP_CERTIFICATE = '0d9244bf0dfe459ba1c018404b0cbdb5';

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