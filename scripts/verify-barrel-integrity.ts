/**
 * Barrel export integrity gate for packages/types.
 *
 * Usage:
 *   tsx scripts/verify-barrel-integrity.ts           — verify production barrels
 *   tsx scripts/verify-barrel-integrity.ts --self-test — run isolated fixture tests
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const TYPES_SRC = path.join(REPO_ROOT, "packages/types/src");
const TYPES_ROOT_INDEX = path.join(TYPES_SRC, "index.ts");
const TYPES_TSCONFIG = path.join(REPO_ROOT, "packages/types/tsconfig.json");

type Violation = {
  code: "BARREL_INTEGRITY_ERROR";
  file: string;
  line: number;
  specifier: string;
  reason: string;
  suggested?: string;
};

type RelativeExport = {
  line: number;
  specifier: string;
};

function posixRelative(fromRoot: string): string {
  return path.relative(REPO_ROOT, fromRoot).split(path.sep).join("/");
}

function discoverBarrelFiles(rootDir: string): string[] {
  const barrels: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && entry.name === "index.ts") {
        barrels.push(full);
      }
    }
  };
  walk(rootDir);
  return barrels.sort();
}

function parseRelativeExports(barrelPath: string): RelativeExport[] {
  const source = fs.readFileSync(barrelPath, "utf8");
  const sourceFile = ts.createSourceFile(
    barrelPath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const exports: RelativeExport[] = [];

  for (const statement of sourceFile.statements) {
    if (!ts.isExportDeclaration(statement) || !statement.moduleSpecifier) {
      continue;
    }
    if (!ts.isStringLiteral(statement.moduleSpecifier)) {
      continue;
    }
    const specifier = statement.moduleSpecifier.text;
    if (!specifier.startsWith(".")) {
      continue;
    }
    const { line } = sourceFile.getLineAndCharacterOfPosition(statement.moduleSpecifier.getStart());
    exports.push({ line: line + 1, specifier });
  }

  return exports;
}

function resolveExportTarget(barrelPath: string, specifier: string): string | null {
  const absoluteBase = path.resolve(path.dirname(barrelPath), specifier);
  const fileCandidate = `${absoluteBase}.ts`;
  if (fs.existsSync(fileCandidate)) {
    return fileCandidate;
  }
  const indexCandidate = path.join(absoluteBase, "index.ts");
  if (fs.existsSync(indexCandidate)) {
    return indexCandidate;
  }
  return null;
}

function isBarrelFile(filePath: string): boolean {
  return path.basename(filePath) === "index.ts";
}

function collectBarrelViolations(barrelFiles: string[], typesSrcRoot: string): Violation[] {
  const violations: Violation[] = [];
  const rel = (p: string) => posixRelative(p);

  for (const barrelPath of barrelFiles) {
    const relBarrel = rel(barrelPath);
    for (const { line, specifier } of parseRelativeExports(barrelPath)) {
      if (specifier.endsWith(".js")) {
        violations.push({
          code: "BARREL_INTEGRITY_ERROR",
          file: relBarrel,
          line,
          specifier,
          reason: ".js specifiers are prohibited in source barrel files.",
          suggested: specifier.replace(/\.js$/u, ""),
        });
        continue;
      }

      if (specifier === "./index" || specifier === "." || specifier.endsWith("/index")) {
        violations.push({
          code: "BARREL_INTEGRITY_ERROR",
          file: relBarrel,
          line,
          specifier,
          reason: "Barrel files must not self-reference through ./index or equivalent paths.",
          suggested: undefined,
        });
        continue;
      }

      const target = resolveExportTarget(barrelPath, specifier);
      if (!target) {
        violations.push({
          code: "BARREL_INTEGRITY_ERROR",
          file: relBarrel,
          line,
          specifier,
          reason: "Export target does not resolve to an existing .ts module or directory index.ts.",
          suggested: undefined,
        });
      }
    }
  }

  // Root barrel must not reference phantom .js index paths.
  const rootSource = fs.readFileSync(path.join(typesSrcRoot, "index.ts"), "utf8");
  for (const banned of ["./common/index.js", "./domain/index.js"]) {
    if (rootSource.includes(banned)) {
      violations.push({
        code: "BARREL_INTEGRITY_ERROR",
        file: "packages/types/src/index.ts",
        line: 1,
        specifier: banned,
        reason:
          "Root barrel references a non-resolvable .js path under direct TypeScript source imports.",
        suggested: banned.replace("/index.js", "").replace(".js", ""),
      });
    }
  }

  return violations;
}

function buildBarrelGraph(barrelFiles: string[]): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();

  for (const barrelPath of barrelFiles) {
    const deps = new Set<string>();
    for (const { specifier } of parseRelativeExports(barrelPath)) {
      const target = resolveExportTarget(barrelPath, specifier);
      if (target && isBarrelFile(target)) {
        deps.add(target);
      }
    }
    graph.set(barrelPath, deps);
  }

  return graph;
}

function detectBarrelCycles(barrelFiles: string[]): Violation[] {
  const graph = buildBarrelGraph(barrelFiles);
  const violations: Violation[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];

  const visit = (node: string): void => {
    if (visited.has(node)) {
      return;
    }
    if (visiting.has(node)) {
      const cycleStart = stack.indexOf(node);
      const cycle = stack.slice(cycleStart).concat(node);
      const cycleLabel = cycle.map((p) => posixRelative(p)).join(" → ");
      violations.push({
        code: "BARREL_INTEGRITY_ERROR",
        file: posixRelative(node),
        line: 1,
        specifier: cycleLabel,
        reason: "Simple barrel-to-barrel cycle detected.",
      });
      return;
    }

    visiting.add(node);
    stack.push(node);
    for (const dep of graph.get(node) ?? []) {
      visit(dep);
    }
    stack.pop();
    visiting.delete(node);
    visited.add(node);
  };

  for (const barrel of barrelFiles) {
    visit(barrel);
  }

  return violations;
}

function collectDuplicateExportViolations(): Violation[] {
  const configFile = ts.readConfigFile(TYPES_TSCONFIG, ts.sys.readFile);
  if (configFile.error) {
    throw new Error(ts.formatDiagnostic(configFile.error, formatHost()));
  }

  const parsed = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    path.dirname(TYPES_TSCONFIG),
  );

  const program = ts.createProgram([TYPES_ROOT_INDEX], parsed.options);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  const violations: Violation[] = [];

  for (const diagnostic of diagnostics) {
    if (diagnostic.code !== 2308) {
      continue;
    }
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
    const fileName = diagnostic.file
      ? posixRelative(diagnostic.file.fileName)
      : "packages/types/src/index.ts";
    const line = diagnostic.file
      ? diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start ?? 0).line + 1
      : 1;

    violations.push({
      code: "BARREL_INTEGRITY_ERROR",
      file: fileName,
      line,
      specifier: message,
      reason: "Duplicate public export detected (TS2308).",
    });
  }

  return violations;
}

function formatHost(): ts.FormatDiagnosticsHost {
  return {
    getCanonicalFileName: (f) => f,
    getCurrentDirectory: () => REPO_ROOT,
    getNewLine: () => "\n",
  };
}

function formatViolation(v: Violation): string {
  const lines = [
    "BARREL_INTEGRITY_ERROR",
    `File: ${v.file}`,
    `Line: ${v.line}`,
    `Specifier: ${v.specifier}`,
    `Reason: ${v.reason}`,
  ];
  if (v.suggested) {
    lines.push(`Suggested: ${v.suggested}`);
  }
  return lines.join("\n");
}

function reportViolations(violations: Violation[]): void {
  for (const violation of violations) {
    console.error(formatViolation(violation));
    console.error("");
  }
}

export function verifyBarrelIntegrity(
  options: {
    typesSrcRoot?: string;
    skipDuplicateCheck?: boolean;
  } = {},
): { barrelCount: number; violations: Violation[] } {
  const typesSrcRoot = options.typesSrcRoot ?? TYPES_SRC;
  const barrelFiles = discoverBarrelFiles(typesSrcRoot);
  const violations = [
    ...collectBarrelViolations(barrelFiles, typesSrcRoot),
    ...detectBarrelCycles(barrelFiles),
    ...(options.skipDuplicateCheck ? [] : collectDuplicateExportViolations()),
  ];

  return { barrelCount: barrelFiles.length, violations };
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`SELF_TEST_FAILED: ${message}`);
  }
}

function writeFixtureFile(root: string, rel: string, content: string): string {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, "utf8");
  return full;
}

async function runSelfTests(): Promise<void> {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "hu-barrel-integrity-"));
  try {
    const srcRoot = path.join(tempRoot, "src");
    writeFixtureFile(
      srcRoot,
      "index.ts",
      `export * from "./good";
export type { Example } from "./example";
`,
    );
    writeFixtureFile(srcRoot, "good.ts", "export type Good = string;\n");
    writeFixtureFile(srcRoot, "example.ts", "export type Example = string;\n");
    writeFixtureFile(
      srcRoot,
      "collective-decision/index.ts",
      `export type { DecisionId } from "./decision";
`,
    );
    writeFixtureFile(
      srcRoot,
      "collective-decision/decision.ts",
      "export type DecisionId = string;\n",
    );

    const baseline = verifyBarrelIntegrity({ typesSrcRoot: srcRoot, skipDuplicateCheck: true });
    assert(baseline.violations.length === 0, "baseline fixture barrels should pass");

    // 1. Missing module
    writeFixtureFile(srcRoot, "missing/index.ts", 'export * from "./does-not-exist";\n');
    const missing = verifyBarrelIntegrity({ typesSrcRoot: srcRoot, skipDuplicateCheck: true });
    assert(
      missing.violations.some((v) => v.specifier === "./does-not-exist"),
      "missing module should be detected",
    );
    fs.rmSync(path.join(srcRoot, "missing"), { recursive: true, force: true });

    // 2. Prohibited .js specifier
    writeFixtureFile(srcRoot, "bad-js/index.ts", 'export * from "./member.js";\n');
    writeFixtureFile(srcRoot, "bad-js/member.ts", "export type Member = string;\n");
    const badJs = verifyBarrelIntegrity({ typesSrcRoot: srcRoot, skipDuplicateCheck: true });
    assert(
      badJs.violations.some((v) => v.reason.includes(".js specifiers are prohibited")),
      ".js barrel specifier should be detected",
    );
    fs.rmSync(path.join(srcRoot, "bad-js"), { recursive: true, force: true });

    // 3. Directory index resolution (already in collective-decision/index.ts)
    const dirIndex = verifyBarrelIntegrity({ typesSrcRoot: srcRoot, skipDuplicateCheck: true });
    assert(
      !dirIndex.violations.some((v) => v.file.includes("collective-decision/index.ts")),
      "directory index resolution should pass",
    );

    // 4. Direct file resolution (example.ts via index.ts)
    assert(
      !baseline.violations.some((v) => v.specifier === "./example"),
      "direct file resolution should pass",
    );

    // 5. Self-reference
    writeFixtureFile(srcRoot, "self/index.ts", 'export * from "./index";\n');
    const selfRef = verifyBarrelIntegrity({ typesSrcRoot: srcRoot, skipDuplicateCheck: true });
    assert(
      selfRef.violations.some((v) => v.reason.includes("self-reference")),
      "self-reference should be detected",
    );
    fs.rmSync(path.join(srcRoot, "self"), { recursive: true, force: true });

    // 6. Simple cycle a <-> b
    writeFixtureFile(srcRoot, "a/index.ts", 'export * from "../b";\n');
    writeFixtureFile(srcRoot, "b/index.ts", 'export * from "../a";\n');
    const cycle = verifyBarrelIntegrity({ typesSrcRoot: srcRoot, skipDuplicateCheck: true });
    assert(
      cycle.violations.some((v) => v.reason.includes("cycle")),
      "barrel cycle should be detected",
    );
    fs.rmSync(path.join(srcRoot, "a"), { recursive: true, force: true });
    fs.rmSync(path.join(srcRoot, "b"), { recursive: true, force: true });

    // 7. Duplicate export via TypeScript API
    const dupRoot = fs.mkdtempSync(path.join(os.tmpdir(), "hu-barrel-dup-"));
    try {
      writeFixtureFile(
        dupRoot,
        "index.ts",
        `export * from "./common";
export * from "./domain";
`,
      );
      writeFixtureFile(dupRoot, "common/index.ts", 'export type { SharedId } from "./shared";\n');
      writeFixtureFile(dupRoot, "domain/index.ts", 'export type { SharedId } from "./shared";\n');
      writeFixtureFile(dupRoot, "common/shared.ts", "export type SharedId = string;\n");
      writeFixtureFile(dupRoot, "domain/shared.ts", "export type SharedId = number;\n");

      const configFile = ts.readConfigFile(TYPES_TSCONFIG, ts.sys.readFile);
      const parsed = ts.parseJsonConfigFileContent(
        configFile.config,
        ts.sys,
        path.dirname(TYPES_TSCONFIG),
      );
      const program = ts.createProgram([path.join(dupRoot, "index.ts")], parsed.options);
      const dupDiagnostics = ts.getPreEmitDiagnostics(program).filter((d) => d.code === 2308);
      assert(dupDiagnostics.length > 0, "duplicate export fixture should produce TS2308");
    } finally {
      fs.rmSync(dupRoot, { recursive: true, force: true });
    }

    console.log("verify-barrel-integrity self-tests passed (7 scenarios).");
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  if (process.argv.includes("--self-test")) {
    await runSelfTests();
    return;
  }

  const { barrelCount, violations } = verifyBarrelIntegrity();

  if (violations.length > 0) {
    reportViolations(violations);
    console.error(
      `verify:barrels FAILED — ${violations.length} violation(s) in ${barrelCount} barrel file(s).`,
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `verify:barrels PASSED — ${barrelCount} barrel file(s), all export targets resolve, no prohibited specifiers, no barrel cycles, no duplicate public exports.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
