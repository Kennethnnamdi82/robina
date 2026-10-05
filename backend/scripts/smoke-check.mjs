import { readdirSync, existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

function listFiles(rootDir, exts) {
  if (!existsSync(rootDir)) return [];
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) {
        walk(full);
        continue;
      }
      if (exts.some((ext) => full.endsWith(ext))) out.push(full);
    }
  };
  walk(rootDir);
  return out;
}

function checkSyntax(files) {
  const failed = [];
  for (const file of files) {
    const run = spawnSync(process.execPath, ["--check", file], {
      stdio: "pipe",
      encoding: "utf8",
    });
    if (run.status !== 0) {
      failed.push({
        file,
        stderr: String(run.stderr || "").trim(),
      });
    }
  }
  return failed;
}

async function importModules(files) {
  const failed = [];
  for (const file of files) {
    try {
      await import(pathToFileURL(resolve(file)).href);
    } catch (err) {
      failed.push({
        file,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return failed;
}

async function withHealthProbe() {
  const port = Number(process.env.SMOKE_PORT || 4100);
  const server = spawn(process.execPath, ["src/server.js"], {
    env: { ...process.env, PORT: String(port) },
    stdio: "ignore",
  });

  const deadline = Date.now() + 25000;
  let lastError = "unknown";
  try {
    while (Date.now() < deadline) {
      if (server.exitCode !== null) {
        throw new Error(`server exited early with code ${server.exitCode}`);
      }
      try {
        const res = await fetch(`http://127.0.0.1:${port}/health`);
        if (res.ok) {
          const body = await res.json();
          if (body?.ok === true) return body;
          lastError = `unexpected health body: ${JSON.stringify(body)}`;
        } else {
          lastError = `health returned status ${res.status}`;
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
      await sleep(1000);
    }
    throw new Error(`health probe timeout: ${lastError}`);
  } finally {
    if (!server.killed) {
      server.kill();
    }
  }
}

async function main() {
  const withHealth = process.argv.includes("--with-health");
  const codeFiles = [
    ...listFiles("src", [".js", ".mjs"]),
    ...listFiles("scripts", [".js", ".mjs"]),
  ];
  const srcModuleFiles = listFiles("src", [".js"]).filter(
    (f) => !f.endsWith(join("src", "server.js")),
  );

  const syntaxFailures = checkSyntax(codeFiles);
  if (syntaxFailures.length) {
    console.error(`Syntax check failed in ${syntaxFailures.length} file(s):`);
    for (const f of syntaxFailures) {
      console.error(`- ${f.file}`);
      if (f.stderr) console.error(`  ${f.stderr.split("\n")[0]}`);
    }
    process.exit(1);
  }

  const importFailures = await importModules(srcModuleFiles);
  if (importFailures.length) {
    console.error(`Module import failed in ${importFailures.length} file(s):`);
    for (const f of importFailures) {
      console.error(`- ${f.file}`);
      console.error(`  ${f.error}`);
    }
    process.exit(1);
  }

  console.log(
    `Smoke checks passed: syntax(${codeFiles.length}), imports(${srcModuleFiles.length})`,
  );

  if (withHealth) {
    const health = await withHealthProbe();
    console.log(`Health probe passed: ${JSON.stringify(health)}`);
  }
}

await main();
