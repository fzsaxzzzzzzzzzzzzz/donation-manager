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
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// 미들웨어
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// 현재 데이터 저장소 (나중에 Firebase로 교체)
let currentData = {
  donations: [],
  streamers: [],
  emojis: {},
  settings: {},
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

// 데이터 저장
async function saveData() {
  try {
    await fs.writeFile('./data.json', JSON.stringify(currentData, null, 2));
    currentData.lastUpdated = new Date().toISOString();
  } catch (error) {
    console.error('데이터 저장 실패:', error);
  }
}

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
  console.log('클라이언트 연결:', socket.id);
  
  // 새 클라이언트에게 현재 데이터 전송
  socket.emit('initialData', currentData);
  
  socket.on('disconnect', () => {
    console.log('클라이언트 연결 해제:', socket.id);
  });
});

// 서버 시작
async function startServer() {
  await loadExistingData();
  
  server.listen(PORT, () => {
    console.log(`\n🚀 실시간 후원 서버 시작됨!`);
    console.log(`📱 관리자 페이지: http://localhost:${PORT}/donation-manager-realtime.html`);
    console.log(`⚙️  관리자 설정: http://localhost:${PORT}/admin-settings.html`);
    console.log(`🎥 오버레이: http://localhost:${PORT}/overlay-realtime.html`);
    console.log(`📊 테이블: http://localhost:${PORT}/table-realtime.html`);
  });
}

startServer();