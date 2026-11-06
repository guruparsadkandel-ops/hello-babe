# Hello Babe

A private real-time messaging app for two people: chat, voice notes, audio and video calls, and a shared dashboard. It was my first React project, built as an installable PWA for my partner and me while we live in different countries.

The stack I set up here (React + Firebase + Vercel) became the base for everything I built afterwards, including [KitchenHand](https://kitchen-saas-six.vercel.app).

## Features

- **Real-time chat** on Firestore listeners: typing indicator, sent/delivered/seen receipts, replies, emoji reactions, unread badge count
- **Voice messages** recorded in the browser with the MediaRecorder API
- **Photo sharing** through the imgbb API, with upload progress
- **Audio calls** over WebRTC using the Agora RTC SDK, with token-based authentication
- **Video calls** with picture-in-picture self view, camera toggle and front/back camera switch (in testing)
- **Shared dashboard**: days-together counter, birthday and anniversary countdowns, love notes, shared goals, daily mood check-in
- **Auth**: email/password and Google sign-in, password reset, partner linking by email
- **PWA**: installable on phones, service worker, Firebase Cloud Messaging setup

## Stack

| Layer | Tech |
| --- | --- |
| Front end | React 19 (Create React App), inline-styled components, Canvas animations |
| Data and auth | Firebase Firestore, Firebase Auth |
| Calls | Agora RTC SDK (`agora-rtc-sdk-ng`), Node/Express token server |
| Media | imgbb API, MediaRecorder API |
| Hosting | Vercel |

## How calls work

1. The caller requests a short-lived RTC token from the token service for a fixed channel and a random UID.
2. The client joins the Agora channel with that token and publishes its microphone (and camera) tracks.
3. When the partner publishes, the client subscribes and plays their audio and video.
4. Leaving the call stops and closes the local tracks and leaves the channel.

`token-server.js` is a minimal Express version of the token service. It reads the Agora credentials from environment variables, so no secret is stored in the repo.

## Run locally

```bash
npm install
cp .env.example .env   # fill in your keys
npm start
```

Token server (optional, for your own Agora project):

```bash
AGORA_APP_ID=... AGORA_APP_CERTIFICATE=... node token-server.js
```

## Known limitations

These are the things I would change now that I know more:

- Voice notes and videos are stored as base64 inside Firestore documents. Firestore caps a document at 1 MB, so large media fails. The fix is to upload media to object storage (Cloudinary or Firebase Storage) and store only the URL, which is how I built media handling in KitchenHand.
- Push notifications are written to a Firestore queue, but no server function sends them yet, so they only arrive while the app is open. A Cloud Function triggered on the queue would complete it.
- There is no call signalling. Both people have to open the call screen; there is no ringing on the other device.
- Components are large single files with inline styles. In later projects I split UI into smaller components.

## Author

Ganesh, Computer Science student in Copenhagen. [GitHub](https://github.com/guruparsadkandel-ops)
