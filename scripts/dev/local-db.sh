#!/usr/bin/env bash
# 개발용 로컬 PostgreSQL 관리. 운영 DB와 완전히 분리된 127.0.0.1:54329/surfing_dev 를 사용한다.
#
#   local-db.sh start               서버 시작 (최초 실행 시 클러스터 생성)
#   local-db.sh stop                서버 중지
#   local-db.sh status              상태 확인
#   local-db.sh restore [dump]      백업(public.dump)으로 surfing_dev 를 덮어쓴다. 생략 시 가장 최근 백업
#   local-db.sh reset               surfing_dev 를 비우고 prisma db push 로 빈 스키마만 생성
#   local-db.sh psql                surfing_dev 에 psql 접속
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=pg-env.sh
source "$ROOT/scripts/dev/pg-env.sh"

DATA_DIR="$ROOT/.tmp/dev-db"
PORT=54329
DB=surfing_dev
BACKUP_ROOT="${SURFING_BACKUP_DIR:-$HOME/surfing-backups}"
export PGHOST=127.0.0.1 PGPORT=$PORT PGUSER=postgres

start() {
  if [ ! -f "$DATA_DIR/PG_VERSION" ]; then
    mkdir -p "$DATA_DIR"
    initdb -D "$DATA_DIR" -U postgres --auth=trust --encoding=UTF8 --locale=C.UTF-8 >/dev/null
  fi
  if pg_ctl -D "$DATA_DIR" status >/dev/null 2>&1; then
    echo "이미 실행 중 (port $PORT)"
  else
    pg_ctl -D "$DATA_DIR" -l "$DATA_DIR/server.log" -w \
      -o "-c listen_addresses=127.0.0.1 -c port=$PORT -c unix_socket_directories=$DATA_DIR" start >/dev/null
    echo "시작됨: postgresql://postgres@127.0.0.1:$PORT/$DB"
  fi
  psql -XAtq -d postgres -c "select 1 from pg_database where datname = '$DB'" | grep -q 1 ||
    createdb "$DB"
}

recreate_db() {
  dropdb --if-exists --force "$DB"
  createdb "$DB"
}

case "${1:-}" in
  start) start ;;
  stop) pg_ctl -D "$DATA_DIR" -w stop ;;
  status) pg_ctl -D "$DATA_DIR" status ;;
  restore)
    # 생략하면 완료 표시(COMPLETE)가 있는 가장 최근 백업. 표시가 생기기 전 백업만 있으면 가장 최근 것.
    latest_complete="$(ls -d "$BACKUP_ROOT"/*/COMPLETE 2>/dev/null | sort | tail -1)"
    dump="${2:-${latest_complete:+$(dirname "$latest_complete")/public.dump}}"
    dump="${dump:-$(ls -d "$BACKUP_ROOT"/*/public.dump 2>/dev/null | sort | tail -1)}"
    [ -f "$dump" ] || { echo "백업 파일이 없습니다: $dump" >&2; exit 1; }
    start
    recreate_db
    psql -Xq -d "$DB" -c "drop schema public cascade"  # 덤프가 public 스키마를 직접 생성한다
    pg_restore --no-owner --no-privileges -d "$DB" "$dump"
    # 백업 이후 저장소에 추가된 테이블/컬럼을 반영한다. 데이터 손실이 필요한 변경이면 prisma 가 중단한다.
    (cd "$ROOT" && DATABASE_URL="postgresql://postgres@127.0.0.1:$PORT/$DB" npx prisma db push --skip-generate)
    echo "복원 완료: $dump → $DB"
    ;;
  reset)
    start
    recreate_db
    (cd "$ROOT" && DATABASE_URL="postgresql://postgres@127.0.0.1:$PORT/$DB" npx prisma db push --skip-generate)
    ;;
  psql) exec psql -d "$DB" ;;
  *) sed -n '2,10p' "$0"; exit 1 ;;
esac
