const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    transports: ['websocket', 'polling'],
    allowEIO3: true
});

const PORT = process.env.PORT || 3000;

// JSON 파싱 미들웨어
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 정적 파일 서빙
app.use(express.static(path.join(__dirname)));

// 데이터 저장소 (메모리 기반, 실제 운영시에는 DB 사용 권장)
let serverData = {
    donations: [],
    streamers: ['엄삼용','손덕배','연기','주옥','불곰','이효팔','동동','남붕','옥긔','국고'],
    emojis: {'엄삼용': '🫅', '손덕배':'🌺', '연기': '🐧', '동동': '😎', '주옥': '👺', '불곰':'🎬', '이효팔': '🏝', '남붕': '🤠', '옥긔':'🦆', '국고':'🏦'},
    settings: {
        streamerSummaryHeader: '',
        streamerSummaryFooter: '',
        excludeGukgo: 'false',
        hiddenStreamers: '[]',
        simpleModeOnly: 'false',
        tableTitle: '🏆 스트리머별 후원 현황 🏆',
        showTotalRow: 'true',
        showUpdateTime: 'false',
        overlayTextAlign: 'left',
        overlayFontSize: '16',
        overlayStrokeWidth: '2',
        rankCount: '10'
    },
    rankNames: {},
    password: '2749'
};

// 데이터 파일에서 로드 (서버 재시작시 데이터 유지)
const DATA_FILE = 'server-data.json';

function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            serverData = { ...serverData, ...JSON.parse(data) };
            console.log('Server data loaded from file');
        }
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

function saveData() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(serverData, null, 2));
    } catch (error) {
        console.error('Error saving data:', error);
    }
}

// 서버 시작시 데이터 로드
loadData();

// API 엔드포인트들
app.get('/api/data', (req, res) => {
    res.json(serverData);
});

app.post('/api/donations', (req, res) => {
    const donation = req.body;
    donation.id = Date.now() + Math.random();
    donation.time = new Date().toISOString();
    
    serverData.donations.push(donation);
    saveData();
    
    // 모든 클라이언트에게 새 후원 알림
    io.emit('donation-added', donation);
    io.emit('data-updated', serverData);
    
    res.json({ success: true, donation });
});

app.put('/api/donations/:id', (req, res) => {
    const id = parseFloat(req.params.id);
    const index = serverData.donations.findIndex(d => d.id === id);
    
    if (index !== -1) {
        serverData.donations[index] = { ...serverData.donations[index], ...req.body };
        saveData();
        
        io.emit('data-updated', serverData);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Donation not found' });
    }
});

app.delete('/api/donations/:id', (req, res) => {
    const id = parseFloat(req.params.id);
    const index = serverData.donations.findIndex(d => d.id === id);
    
    if (index !== -1) {
        serverData.donations.splice(index, 1);
        saveData();
        
        io.emit('data-updated', serverData);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Donation not found' });
    }
});

app.post('/api/settings', (req, res) => {
    serverData.settings = { ...serverData.settings, ...req.body };
    saveData();
    
    io.emit('settings-updated', serverData.settings);
    io.emit('data-updated', serverData);
    
    res.json({ success: true });
});

app.post('/api/rank-names', (req, res) => {
    serverData.rankNames = { ...serverData.rankNames, ...req.body };
    saveData();
    
    io.emit('rank-names-updated', serverData.rankNames);
    io.emit('data-updated', serverData);
    
    res.json({ success: true });
});

app.post('/api/streamers', (req, res) => {
    serverData.streamers = req.body.streamers || serverData.streamers;
    saveData();
    
    io.emit('streamers-updated', serverData.streamers);
    io.emit('data-updated', serverData);
    
    res.json({ success: true });
});

app.post('/api/emojis', (req, res) => {
    serverData.emojis = { ...serverData.emojis, ...req.body };
    saveData();
    
    io.emit('emojis-updated', serverData.emojis);
    io.emit('data-updated', serverData);
    
    res.json({ success: true });
});

// 전체 데이터 리셋
app.post('/api/reset', (req, res) => {
    serverData.donations = [];
    saveData();
    
    io.emit('data-reset');
    io.emit('data-updated', serverData);
    
    res.json({ success: true });
});

// Socket.IO 연결 처리
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    // 클라이언트가 연결되면 현재 데이터 전송
    socket.emit('data-updated', serverData);
    
    // 클라이언트가 관리자 인증 요청
    socket.on('admin-verify', (password) => {
        const isAdmin = password === serverData.password;
        socket.emit('admin-verified', isAdmin);
    });
    
    // 실시간 후원 추가
    socket.on('add-donation', (donation) => {
        donation.id = Date.now() + Math.random();
        donation.time = new Date().toISOString();
        
        serverData.donations.push(donation);
        saveData();
        
        io.emit('donation-added', donation);
        io.emit('data-updated', serverData);
    });
    
    // 설정 업데이트
    socket.on('update-settings', (settings) => {
        serverData.settings = { ...serverData.settings, ...settings };
        saveData();
        
        io.emit('settings-updated', serverData.settings);
        io.emit('data-updated', serverData);
    });
    
    // 순번명 업데이트
    socket.on('update-rank-names', (rankNames) => {
        serverData.rankNames = { ...serverData.rankNames, ...rankNames };
        saveData();
        
        io.emit('rank-names-updated', serverData.rankNames);
        io.emit('data-updated', serverData);
    });
    
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// 기본 라우트
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'donation-manager.html'));
});

app.get('/overlay/donor', (req, res) => {
    res.sendFile(path.join(__dirname, 'donor-overlay-realtime.html'));
});

app.get('/overlay/table', (req, res) => {
    res.sendFile(path.join(__dirname, 'streamer-table-overlay-realtime.html'));
});

server.listen(PORT, () => {
    console.log(`🚀 Donation Server running on port ${PORT}`);
    console.log(`📊 Management: http://localhost:${PORT}`);
    console.log(`👥 Donor Overlay: http://localhost:${PORT}/overlay/donor`);
    console.log(`📋 Table Overlay: http://localhost:${PORT}/overlay/table`);
});