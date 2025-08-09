# 🚀 Render 배포 가이드

실시간 후원 시스템을 Render에 배포해서 온라인에서 사용하기!

## 📋 배포 단계

### 1. **Render 계정 준비**
- [render.com](https://render.com) 회원가입
- GitHub 계정 연동

### 2. **새 Web Service 생성**
1. Dashboard → "New" → "Web Service"
2. GitHub 저장소 연결: `donation-manager`
3. 설정값 입력:

```
Name: donation-tracker
Environment: Node
Branch: main
Build Command: npm install
Start Command: npm start
```

### 3. **환경 변수 설정** (선택사항)
```
NODE_ENV = production
PORT = (자동 할당됨)
```

### 4. **배포 완료!**
- 자동 빌드 시작
- 5-10분 후 완료
- 제공된 URL로 접속 가능

## 🌐 배포 후 주소 예시

**Render가 제공하는 URL:**
```
https://donation-tracker-xxxx.onrender.com
```

**접속 페이지들:**
- **관리자**: `https://[URL]/donation-manager-realtime.html`
- **설정**: `https://[URL]/admin-settings.html`
- **오버레이**: `https://[URL]/overlay-realtime.html`
- **테이블**: `https://[URL]/table-realtime.html`

## 🎯 OBS 설정

**브라우저 소스 URL:**
```
https://[실제URL]/overlay-realtime.html
https://[실제URL]/table-realtime.html
```

## ⚙️ 자동 배포 설정

- GitHub에 Push하면 자동 재배포
- `render.yaml` 파일로 설정 관리
- 무료 플랜: 한 달 750시간 사용 가능

## 🔧 배포 후 확인사항

1. **서버 상태**: Render Dashboard에서 로그 확인
2. **실시간 통신**: Socket.io 연결 상태 확인
3. **데이터 동기화**: 관리자→오버레이 실시간 반영 테스트

## 💡 무료 플랜 한계

- **Sleep 모드**: 15분 비활성 후 잠자기
- **Cold Start**: 첫 접속 시 30초 정도 로딩
- **해결책**: 유료 플랜 또는 정기적 ping

## 🚨 주의사항

1. **데이터 백업**: 서버 재시작 시 메모리 데이터 초기화
2. **HTTPS**: Render는 자동으로 SSL 적용
3. **도메인**: 커스텀 도메인 연결 가능

---

**🎉 이제 전 세계 어디서든 실시간 후원 시스템 사용 가능!**