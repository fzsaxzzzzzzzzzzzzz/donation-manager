# 🔥 Firebase 설정 가이드

데이터 영구 저장을 위한 Firebase Realtime Database 연동 설정

## 📋 Firebase 프로젝트 생성

### 1. Firebase 콘솔 접속
- [https://console.firebase.google.com/](https://console.firebase.google.com/)
- Google 계정으로 로그인

### 2. 새 프로젝트 생성
```
프로젝트명: donation-tracker-[랜덤숫자]
국가/지역: 대한민국
Google Analytics: 사용 안함 (선택사항)
```

### 3. Realtime Database 활성화
1. **Build** → **Realtime Database** 클릭
2. **데이터베이스 만들기** 버튼
3. **지역**: `asia-southeast1 (Singapore)` 선택
4. **보안 규칙**: **테스트 모드에서 시작** (임시)

### 4. 서비스 계정 키 생성
1. **프로젝트 설정** (⚙️) → **서비스 계정**
2. **새 비공개 키 생성** → JSON 다운로드
3. 파일 안전하게 보관 ⚠️

## 🌐 Render 환경변수 설정

### 1. Render Dashboard 접속
- 배포된 프로젝트 → **Environment** 탭

### 2. 환경변수 추가
```bash
# Firebase 서비스 계정 (JSON 파일 전체 내용을 한 줄로)
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"your-project-id",...}

# Firebase Database URL (아시아 서버)
FIREBASE_DATABASE_URL=https://donation-tracker-xxxx-default-rtdb.asia-southeast1.firebasedatabase.app/
```

### 3. 서비스 계정 JSON 준비 방법
```javascript
// 다운로드한 JSON 파일을 열어서
{
  "type": "service_account",
  "project_id": "donation-tracker-xxxx",
  "private_key_id": "...",
  // ... 전체 내용을 복사
}

// 한 줄로 압축 (공백 제거)
{"type":"service_account","project_id":"donation-tracker-xxxx",...}
```

## 🔒 보안 규칙 설정

### 1. Database Rules
```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

⚠️ **주의**: 프로덕션에서는 더 엄격한 규칙 필요

### 2. 추천 보안 규칙 (선택사항)
```json
{
  "rules": {
    "donations": {
      ".read": true,
      ".write": true,
      ".validate": "newData.hasChildren(['streamer', 'name', 'amount', 'timestamp'])"
    },
    "settings": {
      ".read": true, 
      ".write": true
    },
    "streamers": {
      ".read": true,
      ".write": true
    },
    "emojis": {
      ".read": true,
      ".write": true
    }
  }
}
```

## ✅ 설정 확인

### 1. Render 재배포
- 환경변수 추가 후 자동 재배포 또는 수동 배포

### 2. 로그 확인
```bash
# Render 로그에서 확인
🔥 Firebase 연결 성공
🔥 Firebase에서 데이터 로드 성공
🔥 Firebase 저장 성공
```

### 3. 실시간 테스트
1. 관리자 페이지에서 후원 추가
2. Firebase Console → Database에서 실시간 데이터 확인
3. 서버 재시작 후 데이터 유지 확인

## 🚨 문제 해결

### Firebase 연결 실패 시
```bash
⚠️ Firebase 환경변수 없음 - 로컬 저장만 사용
❌ Firebase 초기화 실패
```

**해결책:**
1. 환경변수 이름 정확히 입력했는지 확인
2. JSON 문법 오류 없는지 확인 (따옴표, 콤마)
3. Database URL 정확한지 확인
4. Render 재배포 후 로그 다시 확인

### 권한 오류 시
```bash
❌ Firebase 저장 실패: Permission denied
```

**해결책:**
1. Database Rules에서 `.write: true` 확인
2. 서비스 계정에 Database 권한 부여

## 🎉 완료!

이제 **영구 데이터 저장**이 활성화되었습니다:
- ✅ 서버 재시작해도 데이터 유지
- ✅ Render Sleep 모드와 관계없음  
- ✅ 실시간 백업 및 동기화
- ✅ 로컬 파일도 백업으로 유지

---

**💡 Firebase 무료 플랜**: 1GB 저장용량, 10GB/월 전송량