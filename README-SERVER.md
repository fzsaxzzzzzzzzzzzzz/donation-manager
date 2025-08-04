# 실시간 후원 관리 시스템 - 서버 버전

## 🚀 설치 및 실행

### 1. 의존성 설치
```bash
npm install
```

### 2. 로컬 실행
```bash
npm start
```

### 3. 개발 모드 (자동 재시작)
```bash
npm run dev
```

## 📡 실시간 기능

### 주요 특징
- **실시간 동기화**: 모든 기기에서 즉시 업데이트
- **Socket.io**: 양방향 실시간 통신
- **멀티 기기 지원**: 폰, PC, 태블릿 모두 동기화
- **자동 백업**: 서버에 데이터 자동 저장

### URL 구조
- **메인 관리**: `http://localhost:3000/`
- **후원자 오버레이**: `http://localhost:3000/overlay/donor` 
- **스트리머 테이블**: `http://localhost:3000/overlay/table`

## 🌐 클라우드 배포

### Railway (무료)
1. [Railway](https://railway.app) 가입
2. GitHub 연동
3. Deploy from GitHub Repository
4. 자동 배포 완료

### Heroku (무료)
1. [Heroku](https://heroku.com) 가입
2. Heroku CLI 설치
3. 배포 명령어:
```bash
heroku create your-app-name
git push heroku main
```

### Render (무료)
1. [Render](https://render.com) 가입
2. Web Service 생성
3. GitHub 연동으로 자동 배포

## 📱 사용법

### 스패너(파트너) 환경
1. **메인 PC**: 관리 페이지에서 후원 입력
2. **폰/다른 기기**: 오버레이 URL로 실시간 확인
3. **OBS**: 오버레이 URL을 브라우저 소스로 추가

### 실시간 동기화 확인
- 연결 상태: 페이지 우상단 표시
- 🟢 연결됨: 실시간 동기화 활성
- 🔴 연결 끊어짐: 로컬 모드로 전환

## 🔧 기술 스택

- **Backend**: Node.js + Express
- **Real-time**: Socket.io
- **Frontend**: Vanilla JavaScript
- **Storage**: JSON 파일 (확장 가능)

## 📂 파일 구조

```
donation-manager/
├── server.js                          # Node.js 서버
├── package.json                       # 의존성 설정
├── donation-manager.html              # 메인 관리 페이지
├── donor-overlay-realtime.html        # 실시간 후원자 오버레이
├── streamer-table-overlay-realtime.html # 실시간 스트리머 테이블
└── server-data.json                   # 데이터 저장 (자동 생성)
```

## 🔒 보안

- 관리자 비밀번호: **2749**
- 서버 데이터 자동 백업
- CORS 정책 적용
- 안전한 실시간 통신