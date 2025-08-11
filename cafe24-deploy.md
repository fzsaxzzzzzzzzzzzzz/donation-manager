# 🏢 카페24 Node.js 호스팅 배포 가이드

## 📋 준비사항

### 1. 카페24 Node.js 호스팅 신청
- 카페24 웹호스팅 > Node.js 호스팅 상품 선택
- 도메인 설정 (서브도메인 무료 제공)

### 2. 현재 코드 수정사항
✅ **포트 설정**: 이미 `process.env.PORT` 사용으로 준비 완료
✅ **CORS 설정**: 이미 `origin: "*"` 설정으로 준비 완료

## 🚀 배포 단계

### 1단계: 파일 준비
```bash
# 필요한 파일들만 압축
- server.js
- package.json 
- package-lock.json
- data.json (기존 데이터)
- *.html (모든 웹페이지)
- firebase-config.js
- render.yaml (참고용)
```

### 2단계: FTP 업로드
1. 카페24 제공 FTP 정보로 접속
2. `public_html` 또는 `htdocs` 폴더에 업로드
3. Node.js 앱 폴더 생성 (예: `/nodejs`)

### 3단계: 패키지 설치
```bash
# SSH 접속 후
cd public_html/nodejs
npm install
```

### 4단계: 앱 실행 설정
- 카페24 관리자 페이지에서 Node.js 앱 등록
- 시작 파일: `server.js`
- 자동 재시작 설정

## 🔧 카페24 특화 설정

### package.json 스크립트 수정
```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "node server.js",
    "cafe24": "NODE_ENV=production node server.js"
  }
}
```

### 환경변수 설정
카페24 관리자 페이지에서 설정:
- `NODE_ENV=production`
- `PORT` (자동 할당됨)

## 🌐 도메인 접속
```
관리자 페이지: https://yourdomain.cafe24.com/
후원 오버레이: https://yourdomain.cafe24.com/overlay-realtime.html
스트리머 테이블: https://yourdomain.cafe24.com/table-realtime.html
```

## 📊 모니터링
- 카페24 제공 로그 확인
- `console.log` 출력 모니터링
- 에러 발생시 자동 재시작

## 🔄 업데이트 방법
1. 로컬에서 수정
2. FTP로 파일 업로드
3. 카페24에서 앱 재시작

---

**💡 팁**: 카페24는 한국 서버라 Render보다 빠르고, 24시간 상시 가동되어 실시간 시스템에 최적입니다!