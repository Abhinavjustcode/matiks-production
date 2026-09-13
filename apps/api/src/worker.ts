import { execFile } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import Redis from "ioredis";
import { PrismaClient } from "@prisma/client";

const exec = promisify(execFile);
const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

type Case = { input: unknown[]; output: unknown };

const equal = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);

function jsHarness(slug: string, code: string, tc: Case[]) {
  const calls = tc.map(x => {
    const args = JSON.stringify(x.input).slice(1, -1);
    return `console.log(JSON.stringify(${slug === "two-sum" ? `twoSum(${args})` : slug === "reverse-string" ? `reverseString(${args})` : slug === "valid-parentheses" ? `isValid(${args})` : `search(${args})`}));`;
  }).join("\n");
  return `${code}\n${calls}\n`;
}

function pyHarness(slug: string, code: string, tc: Case[]) {
  const fn = slug === "two-sum" ? "two_sum" : slug === "reverse-string" ? "reverse_string" : slug === "valid-parentheses" ? "is_valid" : "search";
  const calls = tc.map(x => `import json; print(json.dumps(${fn}(${x.input.map(v => JSON.stringify(v)).join(", ")}), separators=(",",":")) )`).join("\n");
  return `${code}\n${calls}\n`;
}

function cppHarness(slug: string, code: string, tc: Case[]) {
  const fn = slug === "two-sum" ? "twoSum" : slug === "reverse-string" ? "reverseString" : slug === "valid-parentheses" ? "isValid" : "search";
  const calls = tc.map(x => {
    const [a,b] = x.input;
    if (slug === "two-sum") {
      const arr = `{${(a as number[]).join(",")}}`;
      return `auto r=${fn}(vector<int>${arr}, ${b}); cout << "[" << r[0] << "," << r[1] << "]\\n";`;
    }
    if (slug === "binary-search") {
      const arr = `{${(a as number[]).join(",")}}`;
      return `cout << ${fn}(vector<int>${arr}, ${b}) << "\\n";`;
    }
    if (slug === "reverse-string") return `cout << ${fn}("${String(a).replace(/"/g,'\\"')}") << "\\n";`;
    return `cout << (${fn}("${String(a)}") ? "true" : "false") << "\\n";`;
  }).join("\n");
  return `#include <bits/stdc++.h>\nusing namespace std;\n${code}\nint main(){${calls}}\n`;
}

function javaHarness(slug: string, code: string, tc: Case[]) {
  const fn = slug === "two-sum" ? "twoSum" : slug === "reverse-string" ? "reverseString" : slug === "valid-parentheses" ? "isValid" : "search";
  const calls = tc.map(x => {
    const [a,b] = x.input;
    if (slug === "two-sum") return `System.out.println(Arrays.toString(s.${fn}(new int[]{${(a as number[]).join(",")}}, ${b})));`;
    if (slug === "binary-search") return `System.out.println(s.${fn}(new int[]{${(a as number[]).join(",")}}, ${b}));`;
    if (slug === "reverse-string") return `System.out.println(s.${fn}("${String(a).replace(/"/g,'\\"')}"));`;
    return `System.out.println(s.${fn}("${String(a)}"));`;
  }).join("\n");
  return `${code}\nclass Main { public static void main(String[] args) { Solution s = new Solution(); ${calls} } }\n`;
}

async function runSubmission(id: string) {
  const sub = await prisma.submission.findUnique({ where: { id }, include: { problem: true } });
  if (!sub) return;

  const tests = Array.isArray(sub.problem.testCases) ? sub.problem.testCases as unknown as Case[] : [];
  const dir = await mkdtemp(join(tmpdir(), "matiks-"));
  const started = Date.now();

  await prisma.submission.update({ where: { id }, data: { status: "RUNNING" } });

  try {
    let file = "", args: string[] = [], command = "";
    if (sub.language === "javascript") {
      file = join(dir, "main.js"); await writeFile(file, jsHarness(sub.problem.slug, sub.code, tests)); command = "node"; args = [file];
    } else if (sub.language === "python") {
      file = join(dir, "main.py"); await writeFile(file, pyHarness(sub.problem.slug, sub.code, tests)); command = "python3"; args = [file];
    } else if (sub.language === "cpp") {
      file = join(dir, "main.cpp"); await writeFile(file, cppHarness(sub.problem.slug, sub.code, tests)); command = "g++"; args = [file, "-std=c++17", "-O2", "-o", join(dir, "main")];
    } else {
      file = join(dir, "Main.java"); await writeFile(file, javaHarness(sub.problem.slug, sub.code, tests)); command = "javac"; args = [file];
    }

    if (sub.language === "cpp" || sub.language === "java") {
      await exec(command, args, { cwd: dir, timeout: 10000, maxBuffer: 2_000_000 });
    }

    const runCommand = sub.language === "cpp" ? join(dir, "main") : sub.language === "java" ? "java" : command;
    const runArgs = sub.language === "java" ? ["-cp", dir, "Main"] : sub.language === "cpp" ? [] : args;
    const result = await exec(runCommand, runArgs, { cwd: dir, timeout: 3000, maxBuffer: 2_000_000 });

    const lines = result.stdout.trimEnd().split(/\r?\n/).filter(Boolean);
    let passed = 0;
    const normalized = tests.map(t => JSON.stringify(t.output));
    for (let i = 0; i < Math.min(lines.length, normalized.length); i++) {
      let actual: unknown;
      try { actual = JSON.parse(lines[i]); } catch { actual = lines[i].replace(/^['"]|['"]$/g, ""); }
      if (equal(actual, tests[i].output)) passed++;
    }

    const accepted = passed === tests.length;
    await prisma.submission.update({
      where: { id },
      data: {
        status: accepted ? "ACCEPTED" : "WRONG_ANSWER",
        passedTests: passed, totalTests: tests.length,
        score: tests.length ? Math.round((passed / tests.length) * 100) : 0,
        runtimeMs: Date.now() - started, output: result.stdout.slice(0, 10000),
      },
    });
  } catch (err: any) {
    const stderr = String(err?.stderr || err?.message || err).slice(0, 10000);
    const compile = ["g++", "javac"].includes(String(err?.cmd || "").split(/\s+/)[0]) ||
      /syntax|compile|error:.*expected/i.test(stderr);
    await prisma.submission.update({
      where: { id },
      data: {
        status: compile ? "COMPILE_ERROR" : "RUNTIME_ERROR",
        runtimeMs: Date.now() - started, error: stderr,
      },
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function main() {
  console.log("MATIKS coding worker online");
  for (;;) {
    const item = await redis.brpop("matiks:submissions", 0);
    if (!item) continue;
    try {
      const payload = JSON.parse(item[1]);
      await runSubmission(payload.id);
    } catch (e) {
      console.error("worker job failed", e);
    }
  }
}

main().catch(async e => {
  console.error(e);
  await prisma.$disconnect();
  await redis.quit();
  process.exit(1);
});
