# Cloud Run / Firebase / GCS 운영 메모

이 문서는 현재 운영 배포 구조와, 나중에 다른 플랫폼으로 옮길 때 다시 바꿔야 하는 항목을 정리한 메모다.

## 현재 운영 구조
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
