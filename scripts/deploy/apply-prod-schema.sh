#!/usr/bin/env bash
# 운영 Supabase DB 에 스키마 추가분 SQL 을 적용한다. 운영 DB 를 바꾸는 유일한 스크립트다.
#
#   scripts/deploy/apply-prod-schema.sh scripts/deploy/20261012-additive-schema.sql
#   scripts/deploy/apply-prod-schema.sh --rehearse postgresql://postgres@127.0.0.1:54329/prod_shadow <sql>
#
# 안전장치
# - 최근 1시간 안의 "완료된" 운영 백업(npm run db:backup:prod, COMPLETE 표시)이 없으면 멈춘다.
# - 오래 열린 트랜잭션이 있으면 적용 전에 보여 준다. 우리 도구(같은 DB 계정)가 남긴 유휴 세션이면
#   직접 확인한 뒤에만 끊고, 앱 세션이면 멈춘다. (ALTER TABLE 은 그 세션이 끝날 때까지 잠금을 기다린다)
# - SQL 은 BEGIN/COMMIT 으로 감싸져 있어야 하고, ON_ERROR_STOP 으로 실행해 실패하면 전부 취소된다.
# - 적용 전에 "apply" 를 직접 입력해야 진행한다.
# --rehearse <loopback URL>: 로컬 사본에 같은 절차를 그대로 돌려 본다(백업 확인은 건너뜀).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=../dev/pg-env.sh
source "$ROOT/scripts/dev/pg-env.sh"

REHEARSE_URL=""
if [ "${1:-}" = "--rehearse" ]; then
  REHEARSE_URL="${2:?리허설 DB URL 을 주세요}"
  shift 2
  case "$REHEARSE_URL" in
    postgresql://*@127.0.0.1:*|postgresql://*@localhost:*) ;;
    *) echo "리허설은 로컬 DB 에만 할 수 있습니다." >&2; exit 1 ;;
  esac
fi

SQL="${1:?적용할 SQL 파일 경로를 주세요}"
[ -f "$SQL" ] || { echo "파일이 없습니다: $SQL" >&2; exit 1; }
grep -q '^BEGIN;' "$SQL" && grep -q '^COMMIT;' "$SQL" || { echo "SQL 이 BEGIN/COMMIT 으로 감싸져 있지 않습니다." >&2; exit 1; }

cd "$ROOT"
if [ -n "$REHEARSE_URL" ]; then
  PSQL=(psql -X "$REHEARSE_URL")
  echo "리허설 대상: $REHEARSE_URL"
else
  BACKUP_ROOT="${SURFING_BACKUP_DIR:-$HOME/surfing-backups}"
  latest="$(find "$BACKUP_ROOT" -mindepth 2 -maxdepth 2 -name COMPLETE -mmin -60 2>/dev/null | sort | tail -1)"
  if [ -z "$latest" ]; then
    echo "최근 1시간 안의 완료된 운영 백업이 없습니다. 먼저 'npm run db:backup:prod' 를 실행하세요." >&2
    exit 1
  fi
  echo "확인한 백업: $(dirname "$latest")"

  creds="$(supabase db dump --linked --dry-run 2>/dev/null | grep -E '^export PG(HOST|PORT|USER|PASSWORD|DATABASE)=' || true)"
  [ -n "$creds" ] || { echo "Supabase 접속 정보를 얻지 못했습니다. 'supabase login' 과 'supabase link' 를 확인하세요." >&2; exit 1; }
  eval "$creds"
  export PGSSLMODE=require
  PSQL=(psql -X)
  echo "대상: $PGHOST / $PGDATABASE"
fi

# 오래(기본 30초) 열린 트랜잭션. 다른 계정 세션의 상태까지 보려고 postgres 역할로 조회한다.
# mine=t 는 접속 계정(session_user, 백업·CLI 도구)이 남긴 유휴 세션이다.
MIN_AGE="${BLOCKER_MIN_AGE:-30 seconds}"
blockers() {
  "${PSQL[@]}" -At -F'|' -c "set role postgres" -c "
    select pid, (usename = session_user and state like 'idle in transaction%') as mine,
           usename, coalesce(application_name, ''), state,
           date_trunc('second', now() - xact_start), left(regexp_replace(query, '\s+', ' ', 'g'), 60)
    from pg_stat_activity
    where pid <> pg_backend_pid() and datname = current_database()
      and xact_start is not null and now() - xact_start > interval '$MIN_AGE'
    order by xact_start" | grep -v '^SET$' || true
}

rows="$(blockers)"
if [ -n "$rows" ]; then
  echo "오래 열린 트랜잭션이 있습니다 (pid|우리 도구|계정|앱|상태|경과|쿼리):"
  echo "$rows"
  if echo "$rows" | grep -q '^[0-9]*|f|'; then
    echo "앱이나 다른 사용자의 세션입니다. 끝날 때까지 기다렸다가 다시 실행하세요." >&2
    exit 1
  fi
  read -r -p "위 세션은 끊긴 백업 등 우리 도구가 남긴 유휴 세션입니다. 끊으려면 kill 을 입력하세요: " answer
  [ "$answer" = "kill" ] || { echo "취소했습니다."; exit 1; }
  pids="$(echo "$rows" | cut -d'|' -f1 | paste -sd, -)"
  # 같은 계정의 세션이므로 권한 승격 없이 끊을 수 있다.
  "${PSQL[@]}" -At -c "select pid, pg_terminate_backend(pid) from pg_stat_activity
    where pid in ($pids) and usename = current_user and state like 'idle in transaction%'"
  sleep 1
  if [ -n "$(blockers)" ]; then
    echo "세션이 아직 남아 있습니다. 잠시 뒤 다시 실행하세요." >&2
    exit 1
  fi
fi

echo "적용할 SQL: $SQL"
read -r -p "DB 에 적용하려면 apply 를 입력하세요: " answer
[ "$answer" = "apply" ] || { echo "취소했습니다."; exit 1; }

"${PSQL[@]}" -v ON_ERROR_STOP=1 -f "$SQL"
echo "적용 완료."
