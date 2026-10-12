#!/usr/bin/env bash
# 운영 Supabase DB 에 스키마 추가분 SQL 을 적용한다. 운영 DB 를 바꾸는 유일한 스크립트다.
#
#   scripts/deploy/apply-prod-schema.sh scripts/deploy/20261012-additive-schema.sql
#
# 안전장치
# - 최근 1시간 안의 운영 백업(npm run db:backup:prod)이 없으면 멈춘다.
# - SQL 은 BEGIN/COMMIT 으로 감싸져 있어야 하고, ON_ERROR_STOP 으로 실행해 실패하면 전부 취소된다.
# - 적용 전에 "apply" 를 직접 입력해야 진행한다.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=../dev/pg-env.sh
source "$ROOT/scripts/dev/pg-env.sh"

SQL="${1:?적용할 SQL 파일 경로를 주세요}"
[ -f "$SQL" ] || { echo "파일이 없습니다: $SQL" >&2; exit 1; }
grep -q '^BEGIN;' "$SQL" && grep -q '^COMMIT;' "$SQL" || { echo "SQL 이 BEGIN/COMMIT 으로 감싸져 있지 않습니다." >&2; exit 1; }

BACKUP_ROOT="${SURFING_BACKUP_DIR:-$HOME/surfing-backups}"
latest="$(find "$BACKUP_ROOT" -mindepth 2 -maxdepth 2 -name public.dump -mmin -60 2>/dev/null | sort | tail -1)"
if [ -z "$latest" ]; then
  echo "최근 1시간 안의 운영 백업이 없습니다. 먼저 'npm run db:backup:prod' 를 실행하세요." >&2
  exit 1
fi
echo "확인한 백업: $(dirname "$latest")"

cd "$ROOT"
creds="$(supabase db dump --linked --dry-run 2>/dev/null | grep -E '^export PG(HOST|PORT|USER|PASSWORD|DATABASE)=' || true)"
[ -n "$creds" ] || { echo "Supabase 접속 정보를 얻지 못했습니다. 'supabase login' 과 'supabase link' 를 확인하세요." >&2; exit 1; }
eval "$creds"
export PGSSLMODE=require

echo "대상: $PGHOST / $PGDATABASE"
echo "적용할 SQL: $SQL"
read -r -p "운영 DB 에 적용하려면 apply 를 입력하세요: " answer
[ "$answer" = "apply" ] || { echo "취소했습니다."; exit 1; }

psql -X -v ON_ERROR_STOP=1 -f "$SQL"
echo "적용 완료."
