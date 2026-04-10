# Cloud Run / Firebase / GCS 운영 메모

이 문서는 Google Cloud 기반 운영 구조를 썼던 시기의 메모와, 나중에 GCP로 돌아갈 때 같은 비용 문제가 다시 생기지 않게 하기 위한 배포 원칙을 함께 정리한 메모다.

## 2026-04-08 정리 완료 상태
- `project=sds-surfing`에 남아 있던 Cloud Run 서비스 `sds-surfing`는 삭제했다.
- Firebase Hosting 사이트 `sds-surfing`는 비활성화했다.
- Artifact Registry 저장소 `cloud-run-source-deploy`는 삭제했다.
- Cloud Run source deploy가 쓰던 버킷 `run-sources-sds-surfing-asia-northeast3`는 삭제했다.
- 프로필 이미지용 GCS bucket `sds-surfing-profile-images-672913164413`도 삭제했다.
- 현재 GCP 쪽에서 남아 있는 것은 Cloud Logging 기본 버킷(`_Default`, `_Required`) 정도다.

## 먼저 바로잡을 점
- 예전에 말한 "GCS에 배포"는 정확한 표현이 아니었다.
- 실제 운영은 `Firebase Hosting -> Cloud Run` 구조였고, GCS는 사용자 프로필 이미지 저장과 Cloud Run source deploy의 소스 zip 저장에 쓰였다.
- 비용의 큰 원인은 사용자 이미지보다 `Cloud Run source deploy`가 배포할 때마다 만든 컨테이너 이미지가 Artifact Registry에 계속 쌓인 것이었다.
- 실제 확인값:
  - Artifact Registry `cloud-run-source-deploy`: 약 `5915 MB`
  - source zip bucket `run-sources-sds-surfing-asia-northeast3`: 약 `6.4 MB`
- 즉 다음에 GCP로 돌아가더라도 "GCS를 썼기 때문에 비쌌다"가 아니라 "Cloud Run source deploy를 무방비로 썼기 때문에 배포 산출물이 누적됐다"로 이해해야 한다.

## 이전 운영 구조
- GitHub `main` 브랜치가 배포 기준이다.
- 앱 런타임은 Google Cloud Run 서비스 `sds-surfing`를 사용한다.
- Firebase Hosting 사이트 `https://sds-surfing.web.app`가 모든 요청을 Cloud Run으로 rewrite한다.
- rewrite 설정은 [firebase.json](/workspace/surfing/firebase.json)에 있다.
- Cloud Run 리전은 `asia-northeast3`(서울)이다.
- 현재 운영은 request-based billing(`cpu-throttling`)을 사용한다.

## 현재 Cloud Run 주요 설정
- 서비스명: `sds-surfing`
- 리전: `asia-northeast3`
- 최대 인스턴스: `5`
- 최소 인스턴스: `1`
- CPU: `2`
- 메모리: `2Gi`
- Firebase Hosting이 앞단에 있으므로 공개 접속은 주로 `https://sds-surfing.web.app` 기준으로 본다.

## 현재 Firebase Hosting 구조
- Hosting 사이트: `sds-surfing`
- 공개 주소: `https://sds-surfing.web.app`
- 모든 경로를 Cloud Run 서비스 `sds-surfing`로 전달한다.
- 이 구조 때문에 일반 쿠키는 Hosting -> Cloud Run 경유 시 제거될 수 있다.
- 그래서 사용자 세션 쿠키 이름은 반드시 `__session`이어야 한다.

## 세션 / 인증 관련 중요 메모

### 사용자 로그인
- 사용자 세션 쿠키 이름은 [session.ts](/workspace/surfing/src/lib/session.ts)에서 `__session`으로 고정했다.
- Firebase Hosting 경유 환경에서는 이 이름이 아니면 로그인 유지가 깨진다.

### 관리자 로그인
- 예전 `admin_session` 별도 쿠키 방식은 Firebase Hosting 경유에서 깨졌다.
- 현재는 관리자 인증 여부도 같은 `__session` payload 안의 `adminAuthenticated` 플래그로 처리한다.
- 관련 파일:
  - [session.ts](/workspace/surfing/src/lib/session.ts)
  - [auth.ts](/workspace/surfing/src/lib/auth.ts)
  - [proxy.ts](/workspace/surfing/src/proxy.ts)
  - [page.tsx](/workspace/surfing/src/app/admin/login/page.tsx)
- 프로필의 관리자 버튼은 직접 `/admin`으로 가지 않고 `/admin/login`으로 보낸다.
  - 이유: auto-login 흐름을 먼저 태우기 위해서다.

## 정산 확인 관련 운영 메모
- 정산 확인 여부는 `SettlementConfirmation`으로 관리한다.
- 확인 처리 기준은 실제 계좌 입금 완료가 아니라, 사용자가 홈 `알림 센터`의 정산 알림에서 아래 CTA 중 하나를 누른 시점이다.
  - `토스로 송금`
  - `계좌번호 복사`
- 사용자용 확인 기록 API는 [route.ts](/workspace/surfing/src/app/api/settlement/confirm/route.ts)다.
- 관리자용 홈 read-only 요약 API는 [route.ts](/workspace/surfing/src/app/api/admin/meetings/[id]/settlement-status/route.ts)다.
- 홈의 관리자 전용 `정산 현황` 탭은 이 요약 API를 사용하고, 기존 [route.ts](/workspace/surfing/src/app/api/admin/meetings/[id]/settlement/route.ts)는 편집 전용으로 유지한다.
- `정산 현황` 탭의 badge 숫자는 참가자 수가 아니라 `미확인 recipient 수`다.
- 미연동 동반인이 정회원 정산에 합산된 경우도 확인 단위는 recipient 1건으로 본다.

### 카카오 로그인
- 운영 기준 카카오 Redirect URI는 `https://sds-surfing.web.app/api/auth/kakao/callback`
- Cloud Run env `KAKAO_REDIRECT_URI`도 같은 값이어야 한다.
- 관련 파일:
  - [route.ts](/workspace/surfing/src/app/api/auth/kakao/route.ts)
  - [route.ts](/workspace/surfing/src/app/api/auth/kakao/callback/route.ts)

## 프로필 이미지 저장 구조

### 현재 구조
- 프로필 사진은 브라우저에서 먼저 크롭/압축 후 업로드한다.
- 운영에서는 GCS bucket에 저장한다.
- DB에는 공개 GCS URL이 아니라 앱 내부 프록시 URL을 저장한다.
- 저장 형식 예시:
  - `/api/profile/avatar/file/profiles/<kakaoId>/<timestamp>.webp`
- 이 URL은 앱 서버가 GCS에서 읽어와 반환한다.

### 관련 파일
- 업로드/삭제 API: [route.ts](/workspace/surfing/src/app/api/profile/avatar/route.ts)
- GCS 읽기 프록시: [route.ts](/workspace/surfing/src/app/api/profile/avatar/file/[...path]/route.ts)
- GCS 저장 유틸: [profile-image-storage.ts](/workspace/surfing/src/lib/profile-image-storage.ts)
- 프론트 크롭 UI: [ProfileImageUploader.tsx](/workspace/surfing/src/components/profile/ProfileImageUploader.tsx)
- 크롭 계산 유틸: [profile-image-client.ts](/workspace/surfing/src/lib/profile-image-client.ts)

### 현재 bucket
- bucket 이름: `sds-surfing-profile-images-672913164413`
- 목적: 프로필 이미지 저장
- Cloud Run 서비스 계정에 `roles/storage.objectAdmin`을 부여했다.

### 왜 GCS 프록시 URL을 쓰는가
- bucket을 공개로 열지 않아도 된다.
- 플랫폼 이동 시 저장소 URL 체계를 DB 전체에서 직접 바꾸지 않아도 된다.
- 앱이 계속 같은 `/api/profile/avatar/file/...` 경로를 유지하면 내부 저장소만 교체해도 된다.

## 로컬 개발 메모
- 로컬에서 운영 GCS 이미지를 보려면 `.env`에 아래 항목이 필요하다.
  - `GCS_PROFILE_IMAGE_BUCKET`
  - `GOOGLE_APPLICATION_CREDENTIALS`
- 현재 로컬 `.env`에는 ADC 경로를 직접 넣어두었다.
- 로컬에서 GCS 인증이 안 되면 이미지 프록시 라우트는 `404`를 반환한다.
- 로컬 fallback 우선순위:
  1. `GCS_PROFILE_IMAGE_BUCKET`
  2. `BLOB_READ_WRITE_TOKEN`
  3. `public/uploads/`

## 현재 운영 env에서 중요한 값
- `DATABASE_URL`
- `SESSION_SECRET`
- `KAKAO_CLIENT_ID`
- `KAKAO_CLIENT_SECRET`
- `KAKAO_REDIRECT_URI`
- `NEXT_PUBLIC_KAKAO_JS_KEY`
- `ADMIN_PASSWORD`
- `GCS_PROFILE_IMAGE_BUCKET`

주의:
- `SESSION_SECRET`는 강한 랜덤 문자열이어야 한다.
- `ADMIN_PASSWORD`도 운영용 값으로 별도 관리해야 한다.

## Cloud Run에 실제로 반영한 것
- request-based billing 유지
- max instances를 `5`로 증가
- CPU를 `2`로 증가
- 메모리를 `2Gi`로 증가
- env에 `GCS_PROFILE_IMAGE_BUCKET=sds-surfing-profile-images-672913164413` 연결
- 당시 `min instances=1`도 켜져 있어서 유휴 시간에도 비용이 발생하는 구성이었다.

## 다음에 GCP로 돌아갈 때의 배포 전략

### 핵심 원칙
- 앱 런타임과 파일 저장소를 분리해서 생각한다.
- Cloud Run 실행 비용과 Artifact Registry 저장 비용은 별개다.
- 사용자 파일 bucket과 배포 산출물 저장소를 같은 문제로 취급하지 않는다.

### 금지할 방식
- 콘솔에서 `Cloud Run source deploy`를 반복해서 쓰는 방식을 기본 선택지로 쓰지 않는다.
- cleanup policy 없는 Artifact Registry 저장소를 계속 재사용하지 않는다.
- 성능 근거 없이 `min instances=1`, `CPU=2`, `메모리=2Gi`부터 시작하지 않는다.

### 권장 방식
- 가능하면 Cloud Run 배포는 "source upload"가 아니라 "명시적인 image deploy"로 한다.
- 전용 Artifact Registry 저장소를 따로 만들고, cleanup policy로 최신 몇 개만 남긴다.
- 배포 파이프라인은 아래 둘 중 하나만 쓴다.
  1. CI에서 이미지 빌드 -> Artifact Registry push -> Cloud Run deploy
  2. source deploy를 꼭 써야 하면, source bucket lifecycle과 Artifact Registry cleanup policy를 먼저 만든 뒤 배포

### 반드시 걸어둘 정책
- Artifact Registry cleanup policy:
  - `latest`와 최근 `3~5`개 digest만 유지
  - 나머지 이미지는 자동 삭제
- source bucket lifecycle:
  - `run-sources-*` 계열 bucket은 1일 또는 7일 후 자동 삭제
- Billing budget alert:
  - 예산 50%, 90%, 100% 알림을 기본으로 건다
- Cloud Logging:
  - `_Default`는 필요 이상 장기 보관하지 않는다
  - 불필요한 request log가 많으면 exclusion을 검토한다

### Cloud Run 기본 사양 출발점
- `min instances=0`
- `max instances=1~3`
- `CPU=1`
- `memory=512Mi` 또는 `1Gi`
- request-based billing 유지
- 실제 병목이 확인되기 전까지는 상향하지 않는다

### 파일 저장 전략
- 사용자 업로드 파일은 전용 bucket 하나로만 관리한다.
- 배포 산출물 저장소와 사용자 파일 bucket을 분리한다.
- 프로필 이미지처럼 장기 보관이 필요한 파일만 bucket에 둔다.
- 임시 파일, 배포 zip, 빌드 산출물은 lifecycle 없이는 저장하지 않는다.

### 운영 체크포인트
- GCP로 다시 갈 때는 배포 직후 아래 네 가지를 같이 확인한다.
  1. Cloud Run 서비스 사양이 과하지 않은가
  2. Artifact Registry cleanup policy가 걸려 있는가
  3. source bucket lifecycle이 걸려 있는가
  4. Billing budget alert가 켜져 있는가

### 한 줄 전략
- 다음에 GCP로 돌아갈 때는 `Cloud Run source deploy를 기본으로 쓰지 말고`, 꼭 써야 하면 `Artifact Registry cleanup policy + source bucket lifecycle + min instances 0`를 먼저 만든 뒤 배포한다.

## 나중에 Vercel 등으로 옮길 때 다시 바꿔야 하는 것

### 1. Firebase Hosting 제거 여부
- Vercel로 완전히 옮기면 Firebase Hosting rewrite는 더 이상 필요 없다.
- 그 경우 [firebase.json](/workspace/surfing/firebase.json)은 운영 경로에서 빠진다.
- `sds-surfing.web.app`를 계속 유지할지, 새 도메인으로 갈지 결정해야 한다.

### 2. 카카오 Redirect URI 재설정
- 현재는 `https://sds-surfing.web.app/api/auth/kakao/callback`
- Vercel로 옮기면 실제 서비스 도메인 기준으로 다시 바꿔야 한다.
- Cloud Run env와 카카오 개발자 콘솔 Redirect URI를 함께 수정해야 한다.

### 3. 세션 쿠키 이름
- Firebase Hosting이 앞단에 있을 때는 `__session`이 사실상 필수다.
- Firebase Hosting을 완전히 제거하면 기술적으로는 다른 쿠키 이름도 가능하다.
- 다만 지금은 사용자/관리자 인증이 모두 `__session` 기준으로 정리돼 있으니 굳이 다시 나눌 이유는 없다.
- 즉 Vercel로 옮겨도 그대로 `__session`을 유지하는 편이 안전하다.

### 4. 프로필 이미지 저장소
- 지금 구조는 GCS 프록시 URL이므로, Vercel로 옮겨도 아래 두 가지 선택지가 있다.
  - GCS를 그대로 유지한다.
  - 다시 Vercel Blob으로 바꾼다.
- GCS를 그대로 유지하면 앱 코드 변경이 가장 적다.
- Vercel Blob으로 돌아가려면 [route.ts](/workspace/surfing/src/app/api/profile/avatar/route.ts)의 우선순위를 다시 바꿔야 한다.
- DB에 저장된 기존 `customProfileImageUrl` 값이 `/api/profile/avatar/file/...` 형식이므로, GCS 프록시 라우트를 없애면 기존 이미지가 깨질 수 있다.
- 저장소를 바꾸려면 아래 중 하나를 해야 한다.
  - 기존 GCS 프록시 라우트를 계속 유지한다.
  - DB의 `customProfileImageUrl`을 새 URL 체계로 마이그레이션한다.

### 5. GCP 리소스 정리 여부
- Vercel로 완전히 이전하고 GCS도 안 쓸 경우 정리 대상:
  - Cloud Run 서비스 `sds-surfing`
  - GCS bucket `sds-surfing-profile-images-672913164413`
  - Firebase Hosting rewrite
- 단, 이미지가 아직 GCS에 남아 있으면 bucket을 바로 지우면 안 된다.

## 플랫폼 이동 시 권장 순서
1. 새 플랫폼 도메인 확정
2. 카카오 Redirect URI 변경
3. 프로필 이미지 저장소 유지 여부 결정
4. 세션 쿠키와 인증 흐름 검증
5. staging 성격의 배포에서 로그인/관리자/프로필 업로드 테스트
6. 운영 트래픽 전환
7. 마지막으로 Cloud Run/Firebase/GCS 정리 여부 결정

## 빠른 점검 체크리스트
- 일반 로그인 유지가 되는가
- 관리자 auto-login이 되는가
- 관리자 비밀번호 로그인도 되는가
- 프로필 이미지 업로드가 되는가
- 업로드 후 즉시 이미지가 보이는가
- 다른 기기/새 세션에서도 이미지가 보이는가
- `web.app`와 직통 `run.app` 둘 다 같은 동작을 보이는가

## GCP 복귀 전 체크리스트
- 지금처럼 비용 문제가 싫다면, 배포 전에 아래가 없으면 진행하지 않는다.
- Artifact Registry cleanup policy
- source bucket lifecycle
- Billing budget alert
- Cloud Run 최소 사양 설정
