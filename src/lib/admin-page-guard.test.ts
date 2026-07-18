import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import ts from "typescript";

function findAdminPages(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "login" ? [] : findAdminPages(path);
    }
    return entry.name === "page.tsx" ? [path] : [];
  });
}

function defaultPageFunction(sourceFile: ts.SourceFile): ts.FunctionDeclaration {
  const page = sourceFile.statements.find(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement)
      && statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword) === true
  );
  assert.ok(page?.body, `${sourceFile.fileName}: default page function must have a body`);
  return page;
}

test("admin page guard AST order: every protected page awaits requireAdminPage first", () => {
  const pages = findAdminPages(join(process.cwd(), "src/app/admin"));
  assert.equal(pages.length, 9);

  for (const path of pages) {
    const source = readFileSync(path, "utf8");
    const sourceFile = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const page = defaultPageFunction(sourceFile);
    const firstStatement = page.body?.statements[0];

    assert.ok(firstStatement && ts.isExpressionStatement(firstStatement), `${path}: first statement must be an expression`);
    assert.ok(ts.isAwaitExpression(firstStatement.expression), `${path}: first statement must be awaited`);
    assert.ok(ts.isCallExpression(firstStatement.expression.expression), `${path}: first await must call requireAdminPage`);
    assert.ok(
      ts.isIdentifier(firstStatement.expression.expression.expression)
      && firstStatement.expression.expression.expression.text === "requireAdminPage",
      `${path}: requireAdminPage must be the first awaited operation`
    );
  }
});
