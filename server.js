const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const admin = require('firebase-admin');
const session = require('express-session');

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

const PORT = process.env.PORT || 3001;

// 비밀번호 설정
const PASSWORDS = {
  admin: '1130',      // 일반 관리자 (조회만 가능)
  superadmin: '2749'  // 최고 관리자 (모든 권한)
};

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
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 세션 설정
app.use(session({
  secret: 'donation-tracker-secret-key-2025',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, // HTTP에서도 사용 (HTTPS에서는 true)
    maxAge: 24 * 60 * 60 * 1000 // 24시간
  }
}));

// 인증 미들웨어
function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) {
    return next();
  } else {
    // 현재 URL을 redirect 파라미터로 전달
    const redirectUrl = encodeURIComponent(req.originalUrl);
    return res.redirect(`/login.html?redirect=${redirectUrl}`);
  }
}

// 최고 관리자 권한 체크 미들웨어
function requireSuperAdmin(req, res, next) {
  if (req.session && req.session.authenticated && req.session.role === 'superadmin') {
    return next();
  } else if (req.session && req.session.authenticated) {
    return res.status(403).json({ error: '최고 관리자 권한이 필요합니다.' });
  } else {
    const redirectUrl = encodeURIComponent(req.originalUrl);
    return res.redirect(`/login.html?redirect=${redirectUrl}`);
  }
}

// 보호된 페이지들 (인증 필요)
const protectedPages = [
  'all-in-one.html',
  'donation-manager.html',
  'donation-manager-realtime.html', 
  'admin-settings.html',
  'settings-sheet.html',
  'donation-sheet.html'
];

// 최고 관리자만 접근 가능한 페이지들
const superAdminPages = [
  'admin-settings.html',
  'settings-sheet.html',
  'donation-manager.html',
  'donation-manager-realtime.html'
];

// 보호된 페이지들에 인증 적용
protectedPages.forEach(page => {
  if (superAdminPages.includes(page)) {
    app.get(`/${page}`, requireSuperAdmin, (req, res) => {
      res.sendFile(path.join(__dirname, page));
    });
  } else {
    app.get(`/${page}`, requireAuth, (req, res) => {
      res.sendFile(path.join(__dirname, page));
    });
  }
});

// 로그인 페이지는 인증 없이 접근 가능
app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

// 나머지 정적 파일들 (오버레이 등은 인증 없이 접근 가능)
app.use(express.static('.', {
  index: false // 기본 인덱스 파일 비활성화
}));

// 현재 데이터 저장소 (메모리 + 파일 백업)
let currentData = {
  donations: [],
  streamers: [
    "엄삼용", "연기", "주옥", "릴라", "도치", "익수", "국고"
  ],
  emojis: {
    "엄삼용": "🫅", "연기": "🐧", "주옥": "👺", 
    "릴라": "🐒", "도치": "👀", "익수": "🥰", "국고": "🏦"
  },
  missions: [],
  runningMissions: [],
  missionAdjustments: [], // 퇴근 미션 조정 기록 (총액에 반영되지 않음)
  settings: {
    "overlay-font-size": "24",
    "overlay-stroke-width": "3", 
    "overlay-text-align": "center",
    "overlay-line-height": "1.5",
    "table-opacity": "85",
    "table-number-size": "16",
    "table-font-size": "14",
    "table-text-color": "white",
    "hidden-streamers": "[]",
    "group-threshold": "2",
    "groupThreshold": 2,
    "includeSuperchat": false,
    "show-total-row": "true",
    "show-update-time": "false",
    "table-title": "🏆 스트리머별 후원 현황 🏆",
    "showKakaoBank": false,
    "kakaoBankSize": 100,
    "kakaoBankLineHeight": 1.2
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
      settings: { ...currentData.settings, ...(firebaseData.settings?.settings || firebaseData.settings || {}) }
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
      settings: { ...currentData.settings, ...(loadedData.settings?.settings || loadedData.settings || {}) }
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

// 인증 API 엔드포인트
app.post('/api/auth/login', (req, res) => {
  const { password, role } = req.body;
  
  // 입력값 검증
  if (!password || !role) {
    return res.status(400).json({ 
      success: false, 
      message: '비밀번호와 권한을 모두 입력해주세요.' 
    });
  }
  
  // 비밀번호 확인
  if (PASSWORDS[role] && PASSWORDS[role] === password) {
    req.session.authenticated = true;
    req.session.role = role;
    req.session.loginTime = new Date().toISOString();
    
    console.log(`🔐 [로그인 성공] ${role} 권한으로 로그인`);
    
    res.json({ 
      success: true, 
      message: '로그인 성공',
      role: role,
      permissions: role === 'superadmin' ? '모든 권한' : '조회 권한만'
    });
  } else {
    console.log(`❌ [로그인 실패] 잘못된 비밀번호 시도 - Role: ${role}`);
    res.status(401).json({ 
      success: false, 
      message: '비밀번호가 틀렸습니다.' 
    });
  }
});

app.post('/api/auth/logout', (req, res) => {
  const userRole = req.session.role;
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ 
        success: false, 
        message: '로그아웃 처리 중 오류가 발생했습니다.' 
      });
    }
    
    console.log(`🚪 [로그아웃] ${userRole} 권한 사용자 로그아웃`);
    res.json({ success: true, message: '로그아웃 되었습니다.' });
  });
});

app.get('/api/auth/status', (req, res) => {
  if (req.session && req.session.authenticated) {
    res.json({
      authenticated: true,
      role: req.session.role,
      loginTime: req.session.loginTime
    });
  } else {
    res.json({ authenticated: false });
  }
});

// 헬스체크 엔드포인트
app.get('/', (req, res) => {
  res.redirect('/login.html');
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

// API 엔드포인트 (인증 적용)
app.get('/api/data', requireAuth, (req, res) => {
  res.json(currentData);
});

app.post('/api/donations', requireSuperAdmin, async (req, res) => {
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
app.delete('/api/donations/:id', requireSuperAdmin, async (req, res) => {
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
app.put('/api/donations/bulk', requireSuperAdmin, async (req, res) => {
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
app.post('/api/streamers', requireSuperAdmin, async (req, res) => {
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

app.delete('/api/streamers/:name', requireSuperAdmin, async (req, res) => {
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

// 미션 관리 API
app.post('/api/missions', requireSuperAdmin, async (req, res) => {
  try {
    const { streamer, target, description } = req.body;
    
    if (!streamer || !target) {
      return res.status(400).json({ error: '스트리머와 목표액이 필요합니다.' });
    }
    
    console.log('🔍 미션 생성 요청:', { streamer, target, description });
    
    // 트림 처리 및 정규화
    const normalizedStreamer = streamer.trim();
    const foundStreamer = currentData.streamers.find(s => s.trim() === normalizedStreamer);
    
    if (!foundStreamer) {
      return res.status(400).json({ error: '존재하지 않는 스트리머입니다.', availableStreamers: currentData.streamers });
    }
    
    // 이미 진행중인 미션이 있는지 확인
    const existingMission = currentData.missions.find(m => m.streamer === streamer && m.status === 'running');
    if (existingMission) {
      return res.status(400).json({ error: '이미 진행중인 미션이 있습니다.' });
    }
    
    const newMission = {
      id: Date.now().toString(),
      streamer,
      target: parseFloat(target),
      description: description || `${streamer} 퇴근미션`,
      status: 'running',
      startTime: new Date().toISOString()
    };
    
    currentData.missions.push(newMission);
    currentData.runningMissions.push(newMission);
    await saveData();
    
    // 모든 클라이언트에게 실시간 업데이트 전송
    console.log(`🎯 [서버] 새 미션 생성: ${streamer} ${target}만원`);
    io.emit('dataUpdate', currentData);
    
    res.json({ success: true, mission: newMission });
  } catch (error) {
    console.error('미션 생성 실패:', error);
    res.status(500).json({ error: '서버 오류' });
  }
});


app.delete('/api/missions/:id', requireSuperAdmin, async (req, res) => {
  try {
    const missionId = req.params.id;
    
    const beforeCount = currentData.missions.length;
    currentData.missions = currentData.missions.filter(m => m.id !== missionId);
    currentData.runningMissions = currentData.runningMissions.filter(m => m.id !== missionId);
    const afterCount = currentData.missions.length;
    
    if (beforeCount === afterCount) {
      return res.status(404).json({ error: '미션을 찾을 수 없습니다.' });
    }
    
    await saveData();
    
    // 모든 클라이언트에게 실시간 업데이트 전송
    console.log(`🗑️ [서버] 미션 삭제: ${missionId}`);
    io.emit('dataUpdate', currentData);
    
    res.json({ success: true, message: '미션이 삭제되었습니다.' });
  } catch (error) {
    console.error('미션 삭제 실패:', error);
    res.status(500).json({ error: '서버 오류' });
  }
});

app.put('/api/missions/:id/complete', requireSuperAdmin, async (req, res) => {
  try {
    const missionId = req.params.id;
    
    const mission = currentData.missions.find(m => m.id === missionId);
    if (!mission) {
      return res.status(404).json({ error: '미션을 찾을 수 없습니다.' });
    }
    
    mission.status = 'completed';
    mission.completedTime = new Date().toISOString();
    
    // runningMissions에서도 상태 업데이트 (제거하지 않음)
    const runningMission = currentData.runningMissions.find(m => m.id === missionId);
    if (runningMission) {
        runningMission.status = 'completed';
        runningMission.completedTime = new Date().toISOString();
    }
    
    await saveData();
    
    // 모든 클라이언트에게 실시간 업데이트 전송
    console.log(`✅ [서버] 미션 완료: ${mission.streamer} ${mission.target}만원`);
    io.emit('dataUpdate', currentData);
    
    res.json({ success: true, mission });
  } catch (error) {
    console.error('미션 완료 실패:', error);
    res.status(500).json({ error: '서버 오류' });
  }
});

// 설정 초기화 API (디버깅용)
app.post('/api/reset-settings', async (req, res) => {
  try {
    console.log('🔄 설정 초기화 실행...');
    console.log('초기화 전:', JSON.stringify(currentData.settings, null, 2));
    
    // 기본 설정으로 완전히 재설정
    currentData.settings = {
      "overlay-font-size": "24",
      "overlay-stroke-width": "3", 
      "overlay-text-align": "center",
      "overlay-line-height": "1.5",
      "table-opacity": "85",
      "table-number-size": "16",
      "table-font-size": "14",
      "table-text-color": "white",
      "hidden-streamers": "[]",
      "group-threshold": "2",
      "groupThreshold": 2,
      "includeSuperchat": false,
      "show-total-row": "true",
      "show-update-time": "false",
      "table-title": "🏆 스트리머별 후원 현황 🏆"
    };
    
    await saveData(false);
    console.log('✅ 설정 초기화 완료');
    console.log('초기화 후:', JSON.stringify(currentData.settings, null, 2));
    
    // 모든 클라이언트에게 업데이트 전송
    io.emit('dataUpdate', currentData);
    io.emit('settingsUpdate', currentData.settings);
    
    res.json({ success: true, message: '설정이 초기화되었습니다.' });
  } catch (error) {
    console.error('❌ 설정 초기화 실패:', error);
    res.status(500).json({ error: '설정 초기화에 실패했습니다.' });
  }
});

// 설정 업데이트 API
app.post('/api/settings', requireSuperAdmin, async (req, res) => {
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
  
  // 데이터 요청 처리 (미션 그래프 오버레이용)
  socket.on('requestData', () => {
    console.log('📊 클라이언트 데이터 요청:', socket.id);
    socket.emit('dataUpdate', currentData);
  });
  
  // ping/pong으로 연결 상태 확인
  socket.on('ping', () => {
    socket.emit('pong');
  });
  
  // 오버레이 총액만 모드 설정 처리
  socket.on('overlayTotalOnlyMode', (isEnabled) => {
    console.log('오버레이 총액만 모드 설정:', isEnabled);
    // 모든 오버레이 클라이언트에게 전송
    io.emit('overlayTotalOnlyMode', isEnabled);
  });

  // 총액 오버레이 설정 업데이트
  socket.on('updateTotalOverlaySettings', (overlaySettings) => {
    console.log('🔧 총액 오버레이 설정 업데이트 수신:', overlaySettings);
    // 모든 총액 오버레이 클라이언트에게 전송
    io.emit('totalOverlaySettingsUpdate', overlaySettings);
  });

  // 카카오뱅크 설정 업데이트
  socket.on('updateKakaoBankSettings', (kakaoBankSettings) => {
    console.log('🔧 카카오뱅크 설정 업데이트 수신:', kakaoBankSettings);
    
    // 현재 데이터에 카카오뱅크 설정 저장
    currentData.settings.showKakaoBank = kakaoBankSettings.showKakaoBank;
    currentData.settings.kakaoBankSize = kakaoBankSettings.kakaoBankSize;
    currentData.settings.kakaoBankLineHeight = kakaoBankSettings.kakaoBankLineHeight;
    
    // 파일 저장
    saveData();
    
    // 모든 후원자 오버레이 클라이언트에게 설정 전송
    io.emit('settingsUpdate', {
      showKakaoBank: kakaoBankSettings.showKakaoBank,
      kakaoBankSize: kakaoBankSettings.kakaoBankSize,
      kakaoBankLineHeight: kakaoBankSettings.kakaoBankLineHeight
    });
    
    console.log('🏦 카카오뱅크 설정 저장 및 전송 완료');
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
      "엄삼용": "🫅", "연기": "🐧", "주옥": "👺", 
      "릴라": "🐒", "도치": "👀", "익수": "🥰", "국고": "🏦"
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
    console.log(`🐝🔥꿀동아리🔥🐝 | 🫅엄삼용(0) 🐧연기(0) 👺주옥(0) 🐒릴라(0) 👀도치(0) 🥰익수(0) 🏦국고(0) 💵총합(0) |🏧투네/계좌 [8:2] | 🎉슈퍼챗은 국고로~!`);
    console.log(`🌐 Render 배포 상태: 정상 작동 - 새로운 스트리머 라인업 적용됨`);
    console.log(`🔄 자동 재배포 트리거 성공`);
    console.log(`⚙️ 설정 시트 페이지 추가됨: /settings-sheet.html`);
    console.log(`🚀 서버 재시작 성공 - 꿀동아리 라인업 확정!`);
  });
}

startServer();