// Firebase 설정 파일 - Realtime Database 사용
import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

// Firebase 프로젝트 설정 (실제 값으로 교체 필요)
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "donation-tracker-xxxx.firebaseapp.com", 
  databaseURL: "https://donation-tracker-xxxx-default-rtdb.asia-southeast1.firebasedatabase.app/",
  projectId: "donation-tracker-xxxx",
  storageBucket: "donation-tracker-xxxx.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

export { database };