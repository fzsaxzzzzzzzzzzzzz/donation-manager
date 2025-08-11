# 🚀 카페24 업로드 완전 가이드

## 📋 1단계: FTP 접속 정보 확인
카페24 관리자 페이지에서 확인:
- **FTP 주소**: yourdomain.cafe24.com
- **포트**: 21
- **계정**: 호스팅 계정명
- **비밀번호**: 호스팅 비밀번호

## 📦 2단계: 업로드할 파일 목록

### ✅ **필수 파일들**
```
📁 업로드할 파일들
├── 🔧 server.js                     # 메인 서버
├── 📦 package.json                  # 의존성 정보
├── 🔒 package-lock.json             # 정확한 버전 정보
├── 🔥 firebase-config.js            # OAuth 설정
├── 📊 data.json                     # 기존 데이터
├── 🌐 all-in-one.html              # 메인 관리 페이지
├── 📱 donation-manager-realtime.html
├── 📊 table-realtime.html
├── ⚙️ admin-settings.html
├── 📋 donation-sheet.html
├── 🎛️ settings-sheet.html
├── 🎥 donor-overlay.html
└── 📊 streamer-table-overlay.html
```

### ❌ **업로드하지 말 것**
- `node_modules/` 폴더
- `*.bat` 파일들 (윈도우 배치)
- `*-debug.html`, `*-test.html` 파일들
- README, 문서 파일들

## 🌐 3단계: FTP 업로드 방법

### FileZilla 사용법
1. **연결**: 호스트, 사용자명, 비밀번호 입력
2. **폴더**: `/public_html/` 또는 `/htdocs/` 이동
3. **업로드**: 위 필수 파일들만 드래그앤드롭

### 명령어 업로드 (고급)
```bash
# FTP 접속
ftp yourdomain.cafe24.com
# 로그인 후
cd public_html
put server.js
put package.json
# ... (모든 필수 파일 업로드)
```

## ⚙️ 4단계: 카페24 설정

### Node.js 앱 등록
1. **카페24 관리자** → **웹호스팅** → **Node.js 관리**
2. **앱 추가**: 
   - 앱명: `donation-tracker`
   - 시작파일: `server.js`
   - 자동재시작: **ON**

### 패키지 설치
SSH 또는 관리자 페이지에서:
```bash
cd public_html
npm install
```

## 🔄 5단계: 실행 및 확인

### 앱 시작
카페24 관리자에서 **앱 시작** 클릭

### 접속 테스트
```
메인: https://yourdomain.cafe24.com/
관리자: https://yourdomain.cafe24.com/all-in-one.html
```

## 🎯 6단계: OBS 설정 변경

기존 Render URL을 카페24 URL로 변경:
```
OLD: https://yourapp.onrender.com/donor-overlay.html
NEW: https://yourdomain.cafe24.com/donor-overlay.html
```

---

## 🚨 주의사항
- **node_modules**는 절대 업로드하지 마세요 (용량 초과)
- **package.json**만 업로드하고 서버에서 `npm install`
- **포트**는 자동 할당됩니다 (3000 고정 아님)

## 🎉 완료!
이제 24시간 안정적인 실시간 후원 시스템이 가동됩니다!