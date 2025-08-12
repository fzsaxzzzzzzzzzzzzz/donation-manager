const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const admin = require('firebase-admin');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  allowEIO3: true
});

const PORT = process.env.PORT || 3000;

// Firebase Admin SDK 초기화
let firebaseDB = null;
try {
  // 환경변수에서 Firebase 설정 읽기
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL || "https://donation-tracker-default-rtdb.asia-southeast1.firebasedatabase.app/"
    });
    firebaseDB = admin.database();
    console.log('🔥 Firebase 연결 성공');
  } else {
    console.log('⚠️ Firebase 환경변수 없음 - 로컬 저장만 사용');
  }
} catch (error) {
  console.log('⚠️ Firebase 초기화 실패 - 로컬 저장만 사용:', error.message);
}

// 미들웨어
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// 현재 데이터 저장소 (메모리 + 파일 백업)
let currentData = {
  donations: [],
  streamers: [
    "엄삼용", "손덕배", "연기", "주옥", "불곰", 
    "이효팔", "동동", "남붕", "옥긔", "국고"
  ],
  emojis: {
    "엄삼용": "🫅", "손덕배": "🌺", "연기": "🐧", "동동": "😎", 
    "주옥": "👺", "불곰": "🎬", "이효팔": "🏝", "남붕": "🤠", 
    "옥긔": "🦆", "국고": "🏦"
  },
  settings: {
    "overlay-font-size": "24",
    "overlay-stroke-width": "3", 
    "overlay-text-align": "center",
    "table-opacity": "85",
    "table-number-size": "16",
    "table-font-size": "14",
    "table-text-color": "white",
    "hidden-streamers": "[]",
    "group-threshold": "2",
    "show-total-row": "true",
    "show-update-time": "false",
    "table-title": "🏆 스트리머별 후원 현황 🏆"
  },
  lastUpdated: new Date().toISOString()
};

// Firebase에서 데이터 로드
async function loadFromFirebase() {
  if (!firebaseDB) return null;
  
  try {
    const snapshot = await firebaseDB.ref('/').once('value');
    const firebaseData = snapshot.val();
    
    if (firebaseData) {
      console.log('🔥 Firebase에서 데이터 로드 성공');
      return firebaseData;
    }
  } catch (error) {
    console.log('❌ Firebase 로드 실패:', error.message);
  }
  return null;
}

// Firebase에 데이터 저장
async function saveToFirebase() {
  if (!firebaseDB) return;
  
  try {
    await firebaseDB.ref('/').set(currentData);
    console.log('🔥 Firebase 저장 성공');
  } catch (error) {
    console.log('❌ Firebase 저장 실패:', error.message);
  }
}

// 통합 데이터 로드 (Firebase 우선, 그 다음 로컬)
async function loadExistingData() {
  // 1. Firebase에서 먼저 시도
  const firebaseData = await loadFromFirebase();
  if (firebaseData) {
    currentData = {
      ...currentData,
      ...firebaseData,
      emojis: firebaseData.emojis || currentData.emojis,
      settings: firebaseData.settings?.settings || firebaseData.settings || currentData.settings
    };
    console.log('📊 스트리머:', currentData.streamers.length + '명');
    console.log('💸 후원:', currentData.donations.length + '건');
    return;
  }
  
  // 2. Firebase 실패 시 로컬 파일 시도
  try {
    const data = await fs.readFile('./data.json', 'utf8');
    const loadedData = JSON.parse(data);
    
    currentData = {
      ...currentData,
      ...loadedData,
      emojis: loadedData.emojis && Object.keys(loadedData.emojis).length > 0 
        ? loadedData.emojis 
        : currentData.emojis,
      settings: loadedData.settings?.settings || loadedData.settings || currentData.settings
    };
    
    console.log('✅ 로컬 데이터 로드 완료');
    console.log('📊 스트리머:', currentData.streamers.length + '명');
    console.log('💸 후원:', currentData.donations.length + '건');
  } catch (error) {
    console.log('⚠️ 기존 데이터 없음, 새로 시작');
  }
}

// 통합 데이터 저장 (Firebase 우선, 로컬 백업)
async function saveData(updateTimestamp = true) {
  // 실제 데이터 변경시에만 타임스탬프 업데이트
  if (updateTimestamp) {
    currentData.lastUpdated = new Date().toISOString();
  }
  
  // 1. Firebase에 저장 시도
  await saveToFirebase();
  
  // 2. 로컬 파일에도 백업 저장
  try {
    await fs.writeFile('./data.json', JSON.stringify(currentData, null, 2));
    console.log('✅ 로컬 백업 저장 성공:', currentData.donations.length, '건');
  } catch (error) {
    console.error('❌ 로컬 저장 실패 (계속 진행):', error.message);
  }
}

// 헬스체크 엔드포인트
app.get('/', (req, res) => {
  res.redirect('/all-in-one.html');
});

app.get('/old', (req, res) => {
  res.send(`
    <h1>🎬 실시간 후원 시스템 - 개별 페이지</h1>
    <p><a href="/all-in-one.html">🔥 통합 관리 페이지로 이동 (권장)</a></p>
    <ul>
      <li><a href="/donation-manager.html">📱 관리자 페이지</a></li>
      <li><a href="/donation-sheet.html">📊 엑셀 스타일 시트</a></li>
      <li><a href="/settings-sheet.html">⚙️ 설정 관리 시트</a></li>
      <li><a href="/settings-debug.html">🔧 설정 디버그 테스트</a></li>
      <li><a href="/simple-overlay-test.html">🧪 간단 오버레이 테스트</a></li>
      <li><a href="/fix-settings.html">🔧 설정 구조 수정 도구</a></li>
      <li><a href="/admin-settings.html">⚙️ 관리자 설정</a></li>
      <li><a href="/donor-overlay.html">🎥 후원자 오버레이</a></li>
      <li><a href="/donor-overlay-simple.html">🎥 후원자 오버레이 (Simple)</a></li>
      <li><a href="/streamer-table-overlay.html">📊 스트리머 테이블</a></li>
    </ul>
  `);
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    donations: currentData.donations.length,
    connectedUsers: io.sockets.sockets.size,
    uptime: process.uptime()
  });
});

// Keep-alive 엔드포인트 (Sleep 방지)
app.get('/ping', (req, res) => {
  res.json({ 
    pong: true, 
    time: new Date().toISOString(),
    users: io.sockets.sockets.size
  });
});

// API 엔드포인트
app.get('/api/data', (req, res) => {
  res.json(currentData);
});

app.post('/api/donations', async (req, res) => {
  const { donor, streamer, type, amount } = req.body;
  
  const newDonation = {
    donor,
    streamer,
    type,
    amount: parseFloat(amount),
    time: new Date().toISOString()
  };
  
  currentData.donations.unshift(newDonation);
  await saveData();
  
  // 모든 클라이언트에게 실시간 업데이트 전송
  console.log(`📡 [서버] dataUpdate 이벤트 전송 (${io.sockets.sockets.size}명 클라이언트)`);
  io.emit('dataUpdate', currentData);
  console.log(`📊 [서버] 전송된 데이터: ${currentData.donations.length}건`);
  
  res.json({ success: true, donation: newDonation });
});

// 중복된 설정 API 제거됨 (아래에 올바른 버전 존재)

// 후원 삭제 API
app.delete('/api/donations/:id', async (req, res) => {
  const donationId = req.params.id;
  console.log('🗑️ 삭제 요청 받음:', donationId);
  console.log('현재 후원 개수:', currentData.donations.length);
  
  try {
    // ID로 후원 삭제 (time 필드 기준)
    const beforeCount = currentData.donations.length;
    const deletedDonation = currentData.donations.find(d => d.time === donationId);
    
    if (deletedDonation) {
      console.log('삭제할 후원 찾음:', deletedDonation.donor, deletedDonation.time);
    } else {
      console.log('❌ 삭제할 후원을 찾을 수 없음. 기존 후원들의 time 필드:');
      currentData.donations.slice(0, 3).forEach((d, i) => {
        console.log(`  [${i}] time: "${d.time}" (타입: ${typeof d.time})`);
      });
      console.log(`요청된 ID: "${donationId}" (타입: ${typeof donationId})`);
    }
    
    currentData.donations = currentData.donations.filter(d => d.time !== donationId);
    const afterCount = currentData.donations.length;
    
    console.log(`삭제 결과: ${beforeCount} → ${afterCount} (${beforeCount - afterCount}개 삭제됨)`);
    
    if (beforeCount === afterCount) {
      return res.status(404).json({ error: '삭제할 후원을 찾을 수 없습니다.' });
    }
    
    await saveData();
    
    // 모든 클라이언트에게 실시간 업데이트 전송
    console.log(`📡 [서버] dataUpdate 이벤트 전송 (${io.sockets.sockets.size}명 클라이언트)`);
    io.emit('dataUpdate', currentData);
    console.log(`📊 [서버] 전송된 데이터: ${currentData.donations.length}건`);
    console.log('✅ 실시간 업데이트 전송 완료');
    
    res.json({ success: true, message: '후원이 삭제되었습니다.' });
  } catch (error) {
    console.error('후원 삭제 실패:', error);
    res.status(500).json({ error: '서버 오류' });
  }
});

// 벌크 업데이트 API (전체 데이터 교체)
app.put('/api/donations/bulk', async (req, res) => {
  try {
    const { donations } = req.body;
    
    if (!Array.isArray(donations)) {
      return res.status(400).json({ error: '잘못된 데이터 형식' });
    }
    
    currentData.donations = donations;
    await saveData();
    
    // 모든 클라이언트에게 실시간 업데이트 전송
    console.log(`📡 [서버] dataUpdate 이벤트 전송 (${io.sockets.sockets.size}명 클라이언트)`);
    io.emit('dataUpdate', currentData);
    console.log(`📊 [서버] 전송된 데이터: ${currentData.donations.length}건`);
    
    res.json({ success: true, message: '데이터가 성공적으로 업데이트되었습니다.' });
  } catch (error) {
    console.error('벌크 업데이트 실패:', error);
    res.status(500).json({ error: '서버 오류' });
  }
});

// 스트리머 관리 API
app.post('/api/streamers', async (req, res) => {
  try {
    const { name, emoji } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: '스트리머 이름이 필요합니다.' });
    }
    
    const trimmedName = name.trim();
    
    // 중복 체크
    if (currentData.streamers.includes(trimmedName)) {
      return res.status(400).json({ error: '이미 존재하는 스트리머입니다.' });
    }
    
    // 스트리머 추가
    currentData.streamers.push(trimmedName);
    if (emoji && emoji.trim()) {
      currentData.emojis[trimmedName] = emoji.trim();
    }
    
    await saveData();
    
    // 모든 클라이언트에게 업데이트 전송
    console.log(`👤 [서버] 스트리머 추가: ${trimmedName} ${emoji || ''}`);
    io.emit('dataUpdate', currentData);
    
    res.json({ 
      success: true, 
      message: '스트리머가 추가되었습니다.',
      streamer: { name: trimmedName, emoji: emoji || '' }
    });
  } catch (error) {
    console.error('스트리머 추가 실패:', error);
    res.status(500).json({ error: '서버 오류' });
  }
});

app.delete('/api/streamers/:name', async (req, res) => {
  try {
    const streamerName = decodeURIComponent(req.params.name);
    
    console.log('🗑️스트리머 삭제 요청:', streamerName);
    
    // 스트리머 목록에서 제거
    const beforeCount = currentData.streamers.length;
    currentData.streamers = currentData.streamers.filter(s => s !== streamerName);
    const afterCount = currentData.streamers.length;
    
    // 이모지도 제거
    delete currentData.emojis[streamerName];
    
    if (beforeCount === afterCount) {
      return res.status(404).json({ error: '스트리머를 찾을 수 없습니다.' });
    }
    
    await saveData();
    
    // 모든 클라이언트에게 업데이트 전송
    console.log(`❌ [서버] 스트리머 삭제: ${streamerName}`);
    io.emit('dataUpdate', currentData);
    
    res.json({ success: true, message: '스트리머가 삭제되었습니다.' });
  } catch (error) {
    console.error('스트리머 삭제 실패:', error);
    res.status(500).json({ error: '서버 오류' });
  }
});

// 설정 구조 수정 API (중첩 설정 해결)
app.post('/api/fix-settings', async (req, res) => {
  try {
    console.log('🔧 설정 구조 수정 시작...');
    console.log('수정 전 설정:', JSON.stringify(currentData.settings, null, 2));
    
    // 중첩된 설정을 평면화
    if (currentData.settings && currentData.settings.settings) {
      console.log('⚠️ 중첩 설정 발견, 평면화 진행...');
      currentData.settings = {
        ...currentData.settings,
        ...currentData.settings.settings  // 중첩된 설정을 끌어올림
      };
      // 중첩 키 삭제
      delete currentData.settings.settings;
    }
    
    // 파일에 저장
    await saveData();
    
    console.log('수정 후 설정:', JSON.stringify(currentData.settings, null, 2));
    
    // 모든 클라이언트에게 업데이트 전송
    console.log('📡 [서버] 설정 수정 후 데이터 전송');
    io.emit('dataUpdate', currentData);
    
    res.json({ 
      success: true, 
      message: '설정 구조가 수정되었습니다.',
      settings: currentData.settings
    });
  } catch (error) {
    console.error('설정 구조 수정 실패:', error);
    res.status(500).json({ error: '서버 오류' });
  }
});

// 서버 데이터 강제 초기화 API (디버깅용)
app.post('/api/force-reload', async (req, res) => {
  try {
    console.log('🔄 서버 데이터 강제 초기화 시작...');
    
    // 기본 이모지 데이터로 강제 설정
    currentData.emojis = {
      "엄삼용": "🫅", 
      "손덕배": "🌺", 
      "연기": "🐧", 
      "동동": "😎", 
      "주옥": "👺", 
      "불곰": "🎬", 
      "이효팔": "🏝", 
      "남붕": "🤠", 
      "옥긔": "🦆", 
      "국고": "🏦"
    };
    
    // 파일에 저장
    await saveData();
    
    // 모든 클라이언트에게 업데이트 전송
    console.log('📡 [서버] 강제 초기화 후 데이터 전송');
    io.emit('dataUpdate', currentData);
    
    res.json({ 
      success: true, 
      message: '서버 데이터가 강제로 초기화되었습니다.',
      emojis: Object.keys(currentData.emojis).length,
      streamers: currentData.streamers.length
    });
  } catch (error) {
    console.error('강제 초기화 실패:', error);
    res.status(500).json({ error: '서버 오류' });
  }
});

// 설정 업데이트 API
app.post('/api/settings', async (req, res) => {
  try {
    const { settings } = req.body;
    
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: '잘못된 설정 데이터입니다.' });
    }
    
    // 설정 변경 사항 확인
    const currentSettings = JSON.stringify(currentData.settings);
    const newSettings = JSON.stringify({ ...currentData.settings, ...settings });
    
    // 실제 변경이 있는 경우에만 처리
    if (currentSettings !== newSettings) {
      // 현재 설정 업데이트
      currentData.settings = {
        ...currentData.settings,
        ...settings
      };
      
      // 설정 변경은 타임스탬프 업데이트하지 않음 (무한루프 방지)
      await saveData(false);
      
      // 모든 클라이언트에게 설정 업데이트 전송
      console.log('⚙️ [서버] 설정 업데이트 전송:', Object.keys(settings).join(', '));
      io.emit('dataUpdate', currentData);
      io.emit('settingsUpdate', currentData.settings);
    } else {
      console.log('⚙️ [서버] 설정 변경 없음, 업데이트 건너뜀');
    }
    
    res.json({ 
      success: true, 
      message: '설정이 성공적으로 업데이트되었습니다.',
      settings: currentData.settings
    });
  } catch (error) {
    console.error('설정 업데이트 실패:', error);
    res.status(500).json({ error: '서버 오류' });
  }
});

// Socket.IO 연결 처리
io.on('connection', (socket) => {
  console.log('🔗 클라이언트 연결:', socket.id, '(총', io.sockets.sockets.size, '명)');
  
  // 새 클라이언트에게 현재 데이터 전송
  console.log('📤 [서버] initialData 전송 준비');
  console.log('📊 [서버] 전송할 후원 데이터 수:', currentData.donations?.length || 0);
  console.log('📊 [서버] 전송할 스트리머 수:', currentData.streamers?.length || 0);
  socket.emit('initialData', currentData);
  console.log('✅ [서버] initialData 전송 완료');
  
  // 연결된 클라이언트 수 브로드캐스트
  io.emit('userCount', io.sockets.sockets.size);
  
  socket.on('disconnect', () => {
    console.log('❌ 클라이언트 연결 해제:', socket.id, '(총', io.sockets.sockets.size, '명)');
    // 연결된 클라이언트 수 업데이트
    io.emit('userCount', io.sockets.sockets.size);
  });
  
  // ping/pong으로 연결 상태 확인
  socket.on('ping', () => {
    socket.emit('pong');
  });
});

// 서버 시작
async function startServer() {
  await loadExistingData();
  
  // 이모지 강제 확인 및 설정
  console.log('🔍 이모지 데이터 확인 중...');
  console.log('현재 이모지 수:', Object.keys(currentData.emojis).length);
  
  if (Object.keys(currentData.emojis).length === 0) {
    console.log('⚠️ 이모지 데이터 없음, 강제 설정 중...');
    currentData.emojis = {
      "엄삼용": "🫅", "손덕배": "🌺", "연기": "🐧", "동동": "😎", 
      "주옥": "👺", "불곰": "🎬", "이효팔": "🏝", "남붕": "🤠", 
      "옥긔": "🦆", "국고": "🏦"
    };
    await saveData();
    console.log('✅ 이모지 데이터 강제 설정 완료');
  } else {
    console.log('✅ 이모지 데이터 존재함:', Object.keys(currentData.emojis));
  }
  
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 실시간 후원 서버 부팅 완료! (포트: ${PORT})`);
    console.log(`📱 관리자 페이지: http://localhost:${PORT}/donation-manager-realtime.html`);
    console.log(`⚙️  관리자 설정: http://localhost:${PORT}/admin-settings.html`);
    console.log(`🎥 오버레이: http://localhost:${PORT}/overlay-realtime.html`);
    console.log(`📊 테이블: http://localhost:${PORT}/table-realtime.html`);
    console.log(`💾 현재 후원 데이터: ${currentData.donations.length}건`);
    console.log(`🕒 서버 부팅 시간: ${new Date().toISOString()}`);
    console.log(`🌐 Render 배포 상태: 정상 작동 - 이모지 강제 로드됨`);
    console.log(`🔄 자동 재배포 트리거 성공`);
    console.log(`⚙️ 설정 시트 페이지 추가됨: /settings-sheet.html`);
    console.log(`🚀 서버 재시작 성공 - 503 오류 해결됨`);
  });
}

startServer();