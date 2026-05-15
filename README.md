# ExpenseFlow 💸

A modern, real-time personal expense tracker built with HTML, CSS, JavaScript, and Firebase.

## Features

- 🔐 **Authentication** — Email/password login & registration via Firebase Auth
- 💰 **Dashboard** — Net balance, total income, total expenses summary cards
- 📋 **Transactions** — Add, edit, delete income & expense entries
- 🏷️ **Categories** — Visual breakdown of spending by category
- 🔍 **Filters** — Filter by type (all/income/expense) and by month
- ☁️ **Real-time sync** — Data stored in Firestore, synced live across devices
- 📱 **Responsive** — Works on mobile and desktop

## Tech Stack

- **Frontend**: HTML5, CSS3 (Vanilla), JavaScript (ESM)
- **Database**: Firebase Firestore
- **Auth**: Firebase Authentication
- **Hosting**: GitHub Pages

## Setup

### 1. Clone the repo
```bash
git clone https://github.com/YOUR_USERNAME/expense-tracker.git
cd expense-tracker
```

### 2. Create a Firebase project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. Enable **Authentication** → Email/Password
4. Enable **Firestore Database** (start in production mode)
5. In Project Settings → Your Apps → Add Web App → copy the config

### 3. Update Firebase config
Open `app.js` and replace the placeholder values:
```js
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### 4. Set Firestore Security Rules
In Firebase Console → Firestore → Rules, paste:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /transactions/{docId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.uid;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.uid;
    }
  }
}
```

### 5. Create Firestore Index
When you first load the app, check the browser console for an index creation link, or manually create a composite index:
- Collection: `transactions`
- Fields: `uid` (Ascending), `date` (Descending)

### 6. Deploy to GitHub Pages
1. Push to GitHub
2. Go to Settings → Pages
3. Set source to **main branch / root**
4. Your site will be live at `https://YOUR_USERNAME.github.io/expense-tracker/`

## License
MIT
