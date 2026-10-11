#!/usr/bin/env bash
# 운영 Supabase DB(public 스키마)를 로컬로 백업한다. 읽기 전용(pg_dump)이며 운영 DB를 변경하지 않는다.
#
# 준비: `supabase login` 후 저장소 루트에서 `supabase link --project-ref <ref>` 를 한 번 실행.
# 접속 정보는 Supabase CLI 가 발급하는 임시 로그인 역할(cli_login_postgres)을 사용하므로
# DB 비밀번호를 따로 보관할 필요가 없다.
#
# 결과: $SURFING_BACKUP_DIR/<타임스탬프>/
#   public.dump   pg_restore 용 custom 포맷 (복구/로컬 개발 DB 적재에 사용)
#   public.sql    사람이 읽을 수 있는 INSERT 문 포함 SQL
#   schema.sql    스키마만
#   row-counts.txt, schema.prisma, git-commit.txt
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=pg-env.sh
source "$ROOT/scripts/dev/pg-env.sh"

BACKUP_ROOT="${SURFING_BACKUP_DIR:-$HOME/surfing-backups}"
OUT="$BACKUP_ROOT/$(date +%Y%m%d-%H%M%S)"

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
opts=(--role=postgres --schema=public --no-owner --no-privileges)

echo "운영 DB 백업 중 → $OUT"
pg_dump "${opts[@]}" -Fc -f "$OUT/public.dump"
pg_dump "${opts[@]}" --column-inserts -f "$OUT/public.sql"
pg_dump "${opts[@]}" --schema-only -f "$OUT/schema.sql"

psql -XAt -c "set role postgres" -c "
  select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where c.relkind = 'r' and n.nspname = 'public' order by 1" | tail -n +2 |
while read -r table; do
  count="$(psql -XAt -c "set role postgres" -c "select count(*) from public.\"$table\"" | tail -1)"
  printf '%s\t%s\n' "$table" "$count"
done > "$OUT/row-counts.txt"

cp prisma/schema.prisma "$OUT/"
git rev-parse HEAD > "$OUT/git-commit.txt" 2>/dev/null || true

dumped="$(pg_restore -l "$OUT/public.dump" | grep -c 'TABLE DATA')"
inserts="$(grep -c '^INSERT INTO' "$OUT/public.sql" || true)"
expected="$(awk -F'\t' '{s += $2} END {print s + 0}' "$OUT/row-counts.txt")"
echo "테이블 ${dumped}개, INSERT ${inserts}행 (운영 행 수 합계 ${expected})"
if [ "$inserts" != "$expected" ]; then
  echo "경고: 덤프 행 수가 운영 행 수와 다릅니다. 백업 중 데이터가 바뀌었을 수 있습니다." >&2
fi
echo "완료: $OUT"
