import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

const SOURCE_ROOT = join(process.cwd(), "src");
const GLOBAL_STYLES = join(SOURCE_ROOT, "app", "globals.css");
const SOURCE_EXTENSIONS = /\.(?:css|ts|tsx)$/;
const DIRECT_BRAND_COLOR = /(?:^|\s)(?:[\w-]+:)*(?:text|bg|border(?:-[lrtbxy])?|divide|ring|fill|stroke|accent|placeholder)-\[var\(--brand-[^)]+\)\]/;
const ARBITRARY_RAW_COLOR = /(?:[\w-]+:)*(?:text|bg|border|ring|fill|stroke|from|via|to)-\[(?:#[\da-f]{3,8}|rgba?\(|hsla?\()/i;
const INLINE_RAW_COLOR = /(?:color|background(?:Color)?|borderColor|boxShadow|fill|stroke)\s*:\s*["'`](?:#[\da-f]{3,8}|rgba?\(|hsla?\()/i;
const CSS_RAW_COLOR = /(?:#[\da-f]{3,8}\b|rgba?\(|hsla?\()/i;

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return SOURCE_EXTENSIONS.test(entry.name) ? [path] : [];
  });
}

test("brand colors use the global token source and Tailwind bridge", () => {
  const violations: string[] = [];
  for (const path of sourceFiles(SOURCE_ROOT)) {
    if (path === GLOBAL_STYLES) continue;
    const source = readFileSync(path, "utf8");
    if (DIRECT_BRAND_COLOR.test(source)) violations.push(`${relative(process.cwd(), path)}: direct brand CSS variable utility`);
    if (ARBITRARY_RAW_COLOR.test(source) || INLINE_RAW_COLOR.test(source)) violations.push(`${relative(process.cwd(), path)}: raw inline color`);
    if (path.endsWith(".css") && CSS_RAW_COLOR.test(source)) violations.push(`${relative(process.cwd(), path)}: raw CSS color`);
  }
  assert.deepEqual(violations, []);
});
