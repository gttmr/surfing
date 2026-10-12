#!/usr/bin/env bash
# 운영 Supabase DB(public 스키마)를 로컬로 백업한다. 읽기 전용(pg_dump)이며 운영 DB를 변경하지 않는다.
#
# 준비: `supabase login` 후 저장소 루트에서 `supabase link --project-ref <ref>` 를 한 번 실행.
# 접속 정보는 Supabase CLI 가 발급하는 임시 로그인 역할(cli_login_postgres)을 사용하므로
# DB 비밀번호를 따로 보관할 필요가 없다.
#
# Supabase 풀러는 새 연결의 인증이 가끔 시간 초과(EAUTHQUERY)되므로 운영 DB 연결은 두 번만 하고
# (덤프 1번, 행 수 1번) 각각 다시 시도한다. 나머지 파일은 덤프에서 로컬로 만든다.
#
# 결과: $SURFING_BACKUP_DIR/<타임스탬프>/
#   public.dump   pg_restore 용 custom 포맷 (복구/로컬 개발 DB 적재에 사용)
#   public.sql    사람이 읽을 수 있는 SQL (데이터는 COPY 형식, psql 로 복구 가능)
#   schema.sql    스키마만
#   row-counts.txt, schema.prisma, git-commit.txt
#   COMPLETE      모든 단계와 행 수 검증이 끝났을 때만 생긴다. 운영 적용 스크립트는 이 백업만 인정한다.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=pg-env.sh
source "$ROOT/scripts/dev/pg-env.sh"

BACKUP_ROOT="${SURFING_BACKUP_DIR:-$HOME/surfing-backups}"
OUT="$BACKUP_ROOT/$(date +%Y%m%d-%H%M%S)"

retry() {
  local attempt
  for attempt in 1 2 3; do
    "$@" && return 0
    [ "$attempt" = 3 ] && break
    echo "운영 DB 연결 실패, 다시 시도합니다 ($attempt/3)" >&2
    sleep $((attempt * 3))
  done
  return 1
}

cd "$ROOT"
creds="$(supabase db dump --linked --dry-run 2>/dev/null | grep -E '^export PG(HOST|PORT|USER|PASSWORD|DATABASE)=' || true)"
if [ -z "$creds" ]; then
  echo "Supabase 접속 정보를 얻지 못했습니다. 'supabase login' 과 'supabase link' 를 확인하세요." >&2
  exit 1
fi
eval "$creds"
export PGSSLMODE=require

umask 077
mkdir -p "$OUT"
trap 'if [ ! -f "$OUT/COMPLETE" ]; then
  echo "백업이 끝나지 않았습니다: $OUT (이 백업은 운영 적용에 쓰이지 않습니다)" >&2
fi' EXIT

echo "운영 DB 백업 중 → $OUT"
retry pg_dump --role=postgres --schema=public --no-owner --no-privileges -Fc -f "$OUT/public.dump"

count_rows() {
  psql -XAt -F$'\t' -c "set role postgres" -c "
    select c.relname,
           (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from public.%I', c.relname), false, true, '')))[1]::text
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'r' and n.nspname = 'public'
    order by 1" | grep -v '^SET$' > "$OUT/row-counts.txt"
}
retry count_rows

pg_restore -f "$OUT/public.sql" "$OUT/public.dump"
pg_restore --schema-only -f "$OUT/schema.sql" "$OUT/public.dump"
cp prisma/schema.prisma "$OUT/"
git rev-parse HEAD > "$OUT/git-commit.txt" 2>/dev/null || true

# 테이블마다 덤프 안의 행 수(COPY 블록 줄 수)가 운영 행 수와 같은지 확인한다.
dumped="$(awk '
  /^COPY public\./ { table = $2; sub(/^public\./, "", table); gsub(/"/, "", table); rows[table] = 0; inside = 1; next }
  /^\\\.$/ { inside = 0; next }
  inside { rows[table]++ }
  END { for (t in rows) printf "%s\t%d\n", t, rows[t] }' "$OUT/public.sql" | sort)"
expected="$(sort "$OUT/row-counts.txt")"
if [ "$dumped" != "$expected" ]; then
  echo "덤프 행 수가 운영 행 수와 다릅니다. 백업 중 데이터가 바뀌었을 수 있으니 다시 실행하세요." >&2
  diff <(echo "$expected") <(echo "$dumped") >&2 || true
  exit 1
fi

tables="$(wc -l < "$OUT/row-counts.txt" | tr -d ' ')"
total="$(awk -F'\t' '{s += $2} END {print s + 0}' "$OUT/row-counts.txt")"
date -Iseconds > "$OUT/COMPLETE"
echo "테이블 ${tables}개, ${total}행 확인"
echo "완료: $OUT"
