# 오버레이 파일 정리 완료

## 현재 활성 오버레이 파일

### 1. `donor-overlay.html` (메인 오버레이)
- **용도**: 폰방송용 후원자 오버레이 v2.0
- **크기**: 28,447 bytes (696 lines)
- **최종 수정**: 2025-09-03 03:25
- **특징**: 
  - 모바일 최적화 (하드웨어 가속 최소화)
  - 배터리 절약 최적화
  - 미디어 쿼리 지원

### 2. `mobile-donor-overlay.html` (모바일 전용)
- **용도**: 모바일 전용 후원자 오버레이
- **크기**: 17,770 bytes (490 lines)
- **최종 수정**: 2025-09-03 03:22
- **특징**:
  - 완전한 모바일 최적화
  - 하드웨어 가속 완전 비활성화
  - 애니메이션 효과 제거
  - 더 작은 폰트 사이즈 (16px)

## 아카이브된 파일

### `overlay-archive/donor-overlay-old.html`
- **원래 위치**: `cafe24-upload/donor-overlay.html`
- **용도**: 구 버전 실시간 후원자별 총액 오버레이
- **크기**: 11,700 bytes (297 lines)
- **상태**: 구버전으로 판단되어 아카이브 처리

## 권장 사용법

- **데스크톱/일반 방송**: `donor-overlay.html`
- **모바일 방송**: `mobile-donor-overlay.html`
- **구버전 필요시**: `overlay-archive/donor-overlay-old.html`