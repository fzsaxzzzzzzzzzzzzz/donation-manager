const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;

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

// 기존 data.json 로드
async function loadExistingData() {
  try {
    const data = await fs.readFile('./data.json', 'utf8');
    currentData = JSON.parse(data);
    console.log('기존 데이터 로드 완료');
  } catch (error) {
    console.log('기존 데이터 없음, 새로 시작');
  }
}

// 데이터 저장 (에러 방지)
async function saveData() {
  try {
    currentData.lastUpdated = new Date().toISOString();
    await fs.writeFile('./data.json', JSON.stringify(currentData, null, 2));
    console.log('✅ 데이터 저장 성공:', currentData.donations.length, '건');
  } catch (error) {
    console.error('❌ 데이터 저장 실패 (계속 진행):', error.message);
    // 파일 저장 실패해도 메모리 데이터는 유지
  }
}

// 헬스체크 엔드포인트
app.get('/', (req, res) => {
  res.send(`
    <h1>🎬 실시간 후원 시스템</h1>
    <p>서버가 정상 작동 중입니다!</p>
    <ul>
      <li><a href="/donation-manager.html">📱 관리자 페이지</a></li>
      <li><a href="/admin-settings.html">⚙️ 관리자 설정</a></li>
      <li><a href="/donor-overlay.html">🎥 후원자 오버레이</a></li>
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
  io.emit('dataUpdate', currentData);
  
  res.json({ success: true, donation: newDonation });
});

app.post('/api/settings', async (req, res) => {
  currentData.settings = { ...currentData.settings, ...req.body };
  await saveData();
  
  // 설정 변경 시에도 실시간 업데이트
  io.emit('settingsUpdate', currentData.settings);
  
  res.json({ success: true, settings: currentData.settings });
});

// Socket.IO 연결 처리
io.on('connection', (socket) => {
  console.log('🔗 클라이언트 연결:', socket.id, '(총', io.sockets.sockets.size, '명)');
  
  // 새 클라이언트에게 현재 데이터 전송
  socket.emit('initialData', currentData);
  
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
  
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 실시간 후원 서버 시작됨!`);
    console.log(`📱 관리자 페이지: http://localhost:${PORT}/donation-manager-realtime.html`);
    console.log(`⚙️  관리자 설정: http://localhost:${PORT}/admin-settings.html`);
    console.log(`🎥 오버레이: http://localhost:${PORT}/overlay-realtime.html`);
    console.log(`📊 테이블: http://localhost:${PORT}/table-realtime.html`);
  });
}

startServer();