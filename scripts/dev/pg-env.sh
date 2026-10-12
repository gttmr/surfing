# shellcheck shell=bash
# 공용 PostgreSQL 클라이언트/서버 경로 설정. 다른 스크립트에서 source 한다.
# 시스템에 PostgreSQL 18 이 설치돼 있으면 그대로 쓰고,
# 없으면 ~/.local/pgclient (sudo 없이 deb 를 풀어 둔 위치)를 사용한다.

PG_LOCAL_ROOT="${PG_LOCAL_ROOT:-$HOME/.local/pgclient}"

if [ -z "${PG_BIN:-}" ]; then
  if [ -x "$PG_LOCAL_ROOT/usr/lib/postgresql/18/bin/pg_dump" ]; then
    PG_BIN="$PG_LOCAL_ROOT/usr/lib/postgresql/18/bin"
    export LD_LIBRARY_PATH="$PG_LOCAL_ROOT/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
  elif [ -x /usr/lib/postgresql/18/bin/pg_dump ]; then
    PG_BIN=/usr/lib/postgresql/18/bin
  else
    echo "PostgreSQL 18 클라이언트를 찾지 못했습니다. PG_BIN 을 지정하세요." >&2
    exit 1
  fi
fi
export PG_BIN
export PATH="$PG_BIN:$PATH"
