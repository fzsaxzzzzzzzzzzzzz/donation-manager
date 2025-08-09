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
      <li><a href="/donation-sheet.html">📊 엑셀 스타일 시트</a> <span style="color: #28a745; font-weight: bold;">NEW!</span></li>
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
  console.log(`📡 [서버] dataUpdate 이벤트 전송 (${io.sockets.sockets.size}명 클라이언트)`);
  io.emit('dataUpdate', currentData);
  console.log(`📊 [서버] 전송된 데이터: ${currentData.donations.length}건`);
  
  res.json({ success: true, donation: newDonation });
});

app.post('/api/settings', async (req, res) => {
  currentData.settings = { ...currentData.settings, ...req.body };
  await saveData();
  
  // 설정 변경 시에도 실시간 업데이트
  io.emit('settingsUpdate', currentData.settings);
  
  res.json({ success: true, settings: currentData.settings });
});

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
    
    console.log('🗑️ 스트리머 삭제 요청:', streamerName);
    
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
    console.log(`\n🚀 실시간 후원 서버 부팅 완료! (포트: ${PORT})`);
    console.log(`📱 관리자 페이지: http://localhost:${PORT}/donation-manager-realtime.html`);
    console.log(`⚙️  관리자 설정: http://localhost:${PORT}/admin-settings.html`);
    console.log(`🎥 오버레이: http://localhost:${PORT}/overlay-realtime.html`);
    console.log(`📊 테이블: http://localhost:${PORT}/table-realtime.html`);
    console.log(`💾 현재 후원 데이터: ${currentData.donations.length}건`);
    console.log(`🕒 서버 부팅 시간: ${new Date().toISOString()}`);
    console.log(`🌐 Render 배포 상태: 정상 작동 - 이모지 복원됨`);
    console.log(`🔄 자동 재배포 트리거 성공`);
  });
}

startServer();