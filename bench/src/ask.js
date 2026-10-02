const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const readline = require('readline');
const { spawn } = require('child_process');
const pidusage = require('pidusage');

const ROOT = path.join(__dirname, '..', '..');
const BENCH_DIR = path.join(ROOT, 'bench');
const RESULTS_DIR = path.join(BENCH_DIR, 'results');
const K6_SCRIPT = path.join(BENCH_DIR, 'src', 'load.js');
const START_COMMAND = 'npm run dev';

const COMPRESSION_RUNS = [
  { name: 'off', acceptEncoding: '' },
  { name: 'gzip', acceptEncoding: 'gzip' },
  { name: 'brotli', acceptEncoding: 'br' },
  { name: 'zstd', acceptEncoding: 'zstd' },
];

function readPort() {
  const envPath = path.join(ROOT, '.env');
  const text = fs.readFileSync(envPath, 'utf8');
  const match = text.match(/^PORT=(\d+)\s*$/m);
  return match ? match[1] : '5002';
}

function targetUrl() {
  if (process.env.BENCH_TARGET_URL) return process.env.BENCH_TARGET_URL;
  return `http://127.0.0.1:${readPort()}/`;
}

function listenPort(url) {
  const parsed = new URL(url);
  if (parsed.port) return parsed.port;
  return parsed.protocol === 'https:' ? '443' : '80';
}

function ask(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

function findListeningPids(port) {
  const { execFileSync } = require('child_process');
  let output = '';
  if (process.platform === 'win32') {
    output = execFileSync('netstat', ['-ano', '-p', 'TCP'], { encoding: 'utf8' });
    const pids = new Set();
    const pattern = new RegExp(`:${port}\\s+\\S+\\s+LISTENING\\s+(\\d+)`, 'g');
    let match;
    while ((match = pattern.exec(output)) !== null) {
      const pid = Number(match[1]);
      if (pid > 0) pids.add(pid);
    }
    return [...pids];
  }

  try {
    output = execFileSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], {
      encoding: 'utf8',
    });
  } catch (error) {
    if (error.status === 1) return [];
    throw error;
  }
  return [...new Set(output.split(/\s+/).map(Number).filter((pid) => pid > 0))];
}

function requestOnce(targetUrl, acceptEncoding) {
  const url = new URL(targetUrl);
  const lib = url.protocol === 'https:' ? https : http;
  const headers = {};
  if (acceptEncoding) headers['Accept-Encoding'] = acceptEncoding;
  if (process.env.BENCH_BEARER) headers.Authorization = `Bearer ${process.env.BENCH_BEARER}`;

  return new Promise((resolve, reject) => {
    const req = lib.request(
      url,
      { method: 'GET', headers },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          resolve({
            status: res.statusCode || 0,
            encoding: String(res.headers['content-encoding'] || '').toLowerCase(),
            body: Buffer.concat(chunks),
          });
        });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

function gzipIsLevel1(body) {
  return body.length >= 10 && body[0] === 0x1f && body[1] === 0x8b && body[8] === 4;
}

function supportError(run, probe) {
  if (probe.status < 200 || probe.status >= 300 || probe.body.length === 0) {
    return `${run.name}: not supported (probe returned HTTP ${probe.status} with an empty or error body)`;
  }

  if (run.name === 'off') {
    if (probe.encoding && probe.encoding !== 'identity') {
      return `off: not supported (server sent Content-Encoding: ${probe.encoding})`;
    }
    return '';
  }

  if (probe.encoding !== run.acceptEncoding) {
    return `${run.name}: not supported (server did not send Content-Encoding: ${run.acceptEncoding})`;
  }

  if (run.name === 'gzip' && !gzipIsLevel1(probe.body)) {
    return 'gzip: not supported (response is gzip, but the header is not zlib level 1)';
  }

  if (run.name === 'brotli' || run.name === 'zstd') {
    return `${run.name}: not supported (Content-Encoding matched, but compression level 1 is not visible on the wire)`;
  }

  return '';
}

function average(values) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function startCpuSampler(pids) {
  const samples = [];
  let stopped = false;
  const timer = setInterval(async () => {
    if (stopped) return;
    try {
      const stats = await pidusage(pids);
      let cpu = 0;
      for (const pid of pids) cpu += stats[pid] ? stats[pid].cpu : 0;
      samples.push(cpu);
    } catch (_error) {
      // A sample can fail if the pid table is briefly busy. The next tick retries.
    }
  }, 250);

  return {
    stop() {
      stopped = true;
      clearInterval(timer);
      pidusage.clear();
      return average(samples);
    },
  };
}

function runK6(env, summaryPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'k6',
      ['run', '--summary-export', summaryPath, K6_SCRIPT],
      { stdio: 'inherit', env: { ...process.env, ...env } },
    );
    child.on('error', (error) => {
      if (error.code === 'ENOENT') {
        reject(new Error('k6 was not found on PATH. Install it, then run this command again.'));
        return;
      }
      reject(error);
    });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`k6 exited with code ${code}`));
    });
  });
}

function readSummary(summaryPath) {
  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  const metrics = summary.metrics || {};
  const checks = metrics.checks && metrics.checks.values ? metrics.checks.values : {};
  const reqs = metrics.http_reqs && metrics.http_reqs.values ? metrics.http_reqs.values : {};
  const data = metrics.data_received && metrics.data_received.values ? metrics.data_received.values : {};
  const duration = metrics.http_req_duration && metrics.http_req_duration.values
    ? metrics.http_req_duration.values
    : {};
  const dropped = metrics.dropped_iterations && metrics.dropped_iterations.values
    ? metrics.dropped_iterations.values.count || 0
    : 0;

  return {
    rps: Number(reqs.rate || 0),
    dataOut: Number(data.rate || 0),
    p95: Number(duration['p(95)'] || 0),
    pass: Number(checks.passes || 0),
    fail: Number(checks.fails || 0),
    dropped,
  };
}

function formatRow(result) {
  const cpu = result.cpu == null ? 'n/a' : `${result.cpu.toFixed(1)}%`;
  return `| ${result.compression} | ${result.rps.toFixed(2)} | ${Math.round(result.dataOut)} B/s | ${cpu} | ${result.p95.toFixed(2)} ms | ${result.pass} | ${result.fail} |`;
}

function failRate(result) {
  const total = result.pass + result.fail;
  if (total === 0) return 1;
  return result.fail / total;
}

function pickWinner(results) {
  const eligible = results.filter((result) => failRate(result) < 0.01);
  eligible.sort((a, b) => {
    const rpsDelta = Number(b.rps.toFixed(2)) - Number(a.rps.toFixed(2));
    if (rpsDelta !== 0) return rpsDelta;
    return Number(a.p95.toFixed(2)) - Number(b.p95.toFixed(2));
  });
  return eligible[0] || null;
}

function renderReport({ serverUrl, pids, notes, results }) {
  const lines = [];
  const processLabel = pids.length === 1 ? '1 process' : `${pids.length} processes`;
  lines.push(`### vertical — ${serverUrl} (${processLabel}, pid ${pids.join(', ')})`);
  if (pids.length > 1) {
    lines.push('');
    lines.push('CPU is the sum of those server processes.');
  }
  lines.push('');
  lines.push('| Compression | Req/s | Data out | CPU | p95 | Pass | Fail |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- |');
  for (const result of results) lines.push(formatRow(result));
  if (notes.length > 0) {
    lines.push('');
    for (const note of notes) lines.push(note);
  }
  for (const result of results) {
    if (result.dropped > 0) {
      lines.push(`${result.compression}: k6 dropped ${result.dropped} iterations (not counted as Pass or Fail).`);
    }
  }
  lines.push('');
  const winner = pickWinner(results);
  if (!winner) {
    lines.push('Winner: none (no run with fail rate under 1%)');
  } else {
    lines.push(`Winner: ${winner.compression}`);
  }
  lines.push('');
  return lines.join('\n');
}

async function main() {
  const serverUrl = targetUrl();
  const port = listenPort(serverUrl);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const scaling = (await ask(rl, 'Scaling (vertical/horizontal): ')).toLowerCase();
  if (scaling === 'horizontal') {
    console.log('not supported yet');
    rl.close();
    return;
  }
  if (scaling !== 'vertical') {
    console.log('Scaling must be vertical or horizontal.');
    rl.close();
    process.exitCode = 1;
    return;
  }

  const processAnswer = await ask(rl, 'Processes (default 1): ');
  const processes = processAnswer === '' ? 1 : Number(processAnswer);
  if (!Number.isInteger(processes) || processes < 1) {
    console.log('Processes must be a whole number, 1 or more.');
    rl.close();
    process.exitCode = 1;
    return;
  }

  const rate = Number(await ask(rl, 'Req/s: '));
  if (!Number.isFinite(rate) || rate <= 0) {
    console.log('Req/s must be a number greater than 0.');
    rl.close();
    process.exitCode = 1;
    return;
  }

  const duration = await ask(rl, 'Duration (for example 30s or 1m): ');
  if (!/^\d+(ms|s|m|h)$/.test(duration)) {
    console.log('Duration must look like 30s or 1m.');
    rl.close();
    process.exitCode = 1;
    return;
  }

  const compressionAnswer = (await ask(rl, 'Compression (all, off, gzip, brotli, zstd): ')).toLowerCase();
  rl.close();

  const allowed = ['all', 'off', 'gzip', 'brotli', 'zstd'];
  if (!allowed.includes(compressionAnswer)) {
    console.log('Compression must be all, off, gzip, brotli, or zstd.');
    process.exitCode = 1;
    return;
  }

  const selected = compressionAnswer === 'all'
    ? COMPRESSION_RUNS
    : COMPRESSION_RUNS.filter((run) => run.name === compressionAnswer);

  let pids = [];
  try {
    pids = findListeningPids(port);
  } catch (error) {
    console.log(`Could not list listeners on port ${port}: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  if (pids.length !== processes) {
    console.log(`Requested ${processes} server process(es). Found ${pids.length} listening on port ${port}${pids.length ? ` (pid ${pids.join(', ')})` : ''}.`);
    console.log(`Command: ${START_COMMAND}`);
    console.log('Reason: this bench only measures server processes that are already listening. It will not start, stop, or restart anything.');
    process.exitCode = 1;
    return;
  }

  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const notes = [];
  const results = [];

  for (const run of selected) {
    let probe;
    try {
      probe = await requestOnce(serverUrl, run.acceptEncoding);
    } catch (error) {
      console.log(`Could not reach ${serverUrl}: ${error.message}`);
      console.log(`Command: ${START_COMMAND}`);
      console.log('Reason: the server is not accepting connections, and this bench will not start it.');
      process.exitCode = 1;
      return;
    }

    const problem = supportError(run, probe);
    if (problem) {
      notes.push(problem);
      console.log(problem);
      continue;
    }

    const summaryPath = path.join(RESULTS_DIR, `${stamp}-${run.name}.json`);
    const sampler = startCpuSampler(pids);
    try {
      await runK6(
        {
          TARGET_URL: serverUrl,
          RATE: String(rate),
          DURATION: duration,
          ACCEPT_ENCODING: run.acceptEncoding,
          BEARER_TOKEN: process.env.BENCH_BEARER || '',
        },
        summaryPath,
      );
    } catch (error) {
      sampler.stop();
      console.log(error.message);
      process.exitCode = 1;
      return;
    }
    const cpu = sampler.stop();
    const summary = readSummary(summaryPath);
    results.push({ compression: run.name, cpu, ...summary });
  }

  const report = renderReport({ serverUrl, pids, notes, results });
  const reportPath = path.join(RESULTS_DIR, `${stamp}.md`);
  fs.writeFileSync(reportPath, report);
  console.log('');
  console.log(report);
  console.log(`Saved ${reportPath}`);
}

main().catch((error) => {
  console.log(error.message);
  process.exitCode = 1;
});
