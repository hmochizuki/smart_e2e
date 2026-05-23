#!/usr/bin/env node
// Tauri shell から spawn される runner ホスト。
// stdin から JSON で suite/steps/dbPath/migrationsFolder を受け取り、
// runSuite を起動して RunnerEvent を JSON Lines で stdout に流す。
// 並行で DrizzleRunnerPersistence に永続化する。
//
// stdin:  { suiteRunId, suite, steps: [{ stepRunId, step }], dbPath, migrationsFolder, useFakeLLM }
// stdout: JSON Lines (RunnerEvent)
// stderr: ログ
// 終了コード: 0=Suite成功, 1=Suite失敗/abort, 2=セットアップエラー

import { randomUUID } from 'node:crypto';
import {
  runSuite,
  createRunnerEmitter,
  createAnthropicLLMClient,
  nodeSpawnFn,
  realFileSystem,
  loadConfig,
} from '@smart-e2e/runner';
import {
  openDatabase,
  runMigrations,
  RunRepository,
  RepairRepository,
  ScriptHistoryRepository,
  DrizzleRunnerPersistence,
} from '@smart-e2e/persistence';

const log = (msg) => {
  process.stderr.write(`[run.mjs] ${msg}\n`);
};

const readAll = (stream) =>
  new Promise((resolve, reject) => {
    let data = '';
    stream.setEncoding('utf8');
    stream.on('data', (chunk) => {
      data += chunk;
    });
    stream.on('end', () => resolve(data));
    stream.on('error', reject);
  });

const writeEvent = (ev) => {
  process.stdout.write(
    `${JSON.stringify(ev, (_k, v) => (v instanceof Date ? v.toISOString() : v))}\n`,
  );
};

// Fake LLM: ANTHROPIC を呼ばずに「分類: transient」「修復: 固定スクリプト」を返す。
const createFakeLLMClient = () => ({
  complete: (_messages, options) => {
    const sys = options?.system ?? '';
    if (sys.includes('修復')) {
      return Promise.resolve(
        JSON.stringify({
          script: "import { test } from '@playwright/test';\ntest('repaired', async () => {});\n",
        }),
      );
    }
    return Promise.resolve(JSON.stringify({ classification: 'transient', rationale: 'fake' }));
  },
});

// Fake spawn: 常に成功 (exitCode 0) を返す。実 Playwright を起動しない fake モード用。
const createFakeSpawn = () => () =>
  Promise.resolve({
    exitCode: 0,
    stdout: '',
    stderr: '',
    timedOut: false,
    durationMs: 1,
  });

// 文字列日付を Date に戻す (cli.ts と同じ方針)
const reviveDates = (input) => {
  if (typeof input === 'string') {
    const m = /^\d{4}-\d{2}-\d{2}T/.exec(input);
    if (m !== null) {
      const d = new Date(input);
      if (!Number.isNaN(d.getTime())) return d;
    }
    return input;
  }
  if (Array.isArray(input)) return input.map(reviveDates);
  if (typeof input === 'object' && input !== null) {
    const result = {};
    for (const [k, v] of Object.entries(input)) {
      result[k] = reviveDates(v);
    }
    return result;
  }
  return input;
};

// emitter のイベントを受けて RunnerPersistence に書き出すサブスクライバ。
// スクリプトは step_started / step_attempt の最後を一時保持し、
// step_finished / repair_classified 等のタイミングで永続化する。
const bindPersistence = (emitter, persistence, suiteRunId, suiteId, stepIdByStepRunId) => {
  // step 進行の一時状態
  const stepState = new Map();
  // repair_classified 受信時に直近の attempt スクリプトを覚えておく
  const attemptScripts = new Map();
  let suiteRunCreated = false;

  const ensureSuiteRun = async (startedAt) => {
    if (suiteRunCreated) return;
    suiteRunCreated = true;
    try {
      await persistence.createSuiteRun({
        suiteRunId,
        suiteId,
        status: 'running',
        startedAt,
      });
    } catch (e) {
      log(`createSuiteRun failed: ${String(e)}`);
    }
  };

  emitter.on((ev) => {
    void (async () => {
      try {
        switch (ev.type) {
          case 'suite_started': {
            await ensureSuiteRun(ev.startedAt instanceof Date ? ev.startedAt : new Date());
            break;
          }
          case 'step_started': {
            const stepId = stepIdByStepRunId.get(ev.stepRunId) ?? ev.stepId;
            stepState.set(ev.stepRunId, { stepId, attempts: 1 });
            await persistence.createStepRun({
              stepRunId: ev.stepRunId,
              suiteRunId,
              stepId,
              status: 'running',
              attempts: 1,
              startedAt: new Date(),
              finalScript: null,
            });
            break;
          }
          case 'step_attempt': {
            attemptScripts.set(`${ev.stepRunId}:${String(ev.attempt)}`, ev.script);
            const s = stepState.get(ev.stepRunId);
            if (s) s.attempts = ev.attempt;
            await persistence.updateStepRun(ev.stepRunId, { attempts: ev.attempt });
            break;
          }
          case 'repair_classified': {
            const llmInput = attemptScripts.get(`${ev.stepRunId}:${String(ev.attempt)}`) ?? '';
            // この時点では repair の最終結果が未確定なので、
            // result は暫定的に 'failure' で書き込み (この試行は失敗してここに来ているので)。
            // 後続の repair_generated で同じ attempt の llmOutputScript を上書きする運用にする。
            const id = randomUUID();
            attemptScripts.set(`${ev.stepRunId}:${String(ev.attempt)}:repairId`, id);
            try {
              await persistence.createRepairAttempt({
                repairAttemptId: id,
                stepRunId: ev.stepRunId,
                n: ev.attempt,
                classification: ev.classification,
                errorLog: ev.errorLog,
                screenshotPath: null,
                domSnapshot: null,
                llmInputScript: llmInput.length > 0 ? llmInput : '/* unknown */',
                llmOutputScript: null,
                result: 'failure',
              });
            } catch (e) {
              log(`createRepairAttempt failed: ${String(e)}`);
            }
            break;
          }
          case 'repair_generated': {
            const sourceRepairId = attemptScripts.get(
              `${ev.stepRunId}:${String(ev.attempt)}:repairId`,
            );
            // diff だけだとフルスクリプトに復元できないので、script_history は別途 step_finished
            // 時に finalScript を保存する運用。ここでは llmOutputScript を更新できないため
            // 暫定的にイベントログとしては stdout に流すだけにする。
            if (typeof sourceRepairId === 'string') {
              // result/output の更新インターフェースは現状の RunnerPersistence に無い。
              // 簡略化: 何もしない。今後追加。
            }
            break;
          }
          case 'step_finished': {
            const s = stepState.get(ev.stepRunId);
            const stepId = s?.stepId ?? stepIdByStepRunId.get(ev.stepRunId) ?? '';
            await persistence.updateStepRun(ev.stepRunId, {
              status: ev.status,
              attempts: ev.attempts,
              finishedAt: new Date(),
              finalScript: ev.finalScript,
            });
            if (stepId.length > 0) {
              try {
                await persistence.saveScriptHistory({
                  stepId,
                  script: ev.finalScript,
                  source: ev.attempts > 1 ? 'repaired' : 'initial',
                  sourceRepairAttemptId: null,
                  createdAt: new Date(),
                });
              } catch (e) {
                log(`saveScriptHistory failed: ${String(e)}`);
              }
            }
            break;
          }
          case 'step_skipped': {
            const stepId = stepIdByStepRunId.get(ev.stepRunId) ?? '';
            // skip は createStepRun されていない可能性がある (suite_started直後にabort等) ので
            // findOrCreate 相当の挙動: 失敗時に createStepRun してから update する。
            try {
              await persistence.updateStepRun(ev.stepRunId, {
                status: 'skipped',
                finishedAt: new Date(),
              });
            } catch {
              if (stepId.length > 0) {
                try {
                  await persistence.createStepRun({
                    stepRunId: ev.stepRunId,
                    suiteRunId,
                    stepId,
                    status: 'skipped',
                    attempts: 1,
                    startedAt: new Date(),
                    finalScript: null,
                  });
                } catch (e2) {
                  log(`createStepRun(skipped) failed: ${String(e2)}`);
                }
              }
            }
            break;
          }
          case 'suite_finished': {
            await persistence.updateSuiteRun(suiteRunId, {
              status: ev.status,
              finishedAt: ev.finishedAt instanceof Date ? ev.finishedAt : new Date(),
            });
            break;
          }
          default:
            break;
        }
      } catch (e) {
        log(`persistence error on ${ev.type}: ${String(e)}`);
      }
    })();
  });
};

const main = async () => {
  const stdinRaw = await readAll(process.stdin);
  let input;
  try {
    input = JSON.parse(stdinRaw);
  } catch (e) {
    log(`invalid stdin JSON: ${String(e)}`);
    process.exit(2);
  }

  const useFakeLLM =
    input.useFakeLLM === true ||
    process.env['RUNNER_USE_FAKE_LLM'] === 'true' ||
    process.env['RUNNER_USE_FAKE_LLM'] === '1';

  // Fake モードでは ANTHROPIC_API_KEY が無くても動かせるよう placeholder を入れる。
  const envForConfig = { ...process.env };
  if (useFakeLLM) {
    envForConfig['ANTHROPIC_API_KEY'] = envForConfig['ANTHROPIC_API_KEY'] ?? 'fake-key';
    envForConfig['RUNNER_USE_FAKE_LLM'] = 'true';
  }

  const configResult = loadConfig(envForConfig);
  if (!configResult.ok) {
    log(`config error: ${configResult.error.message}`);
    process.exit(2);
  }
  const config = configResult.value;

  if (typeof input.dbPath !== 'string' || typeof input.migrationsFolder !== 'string') {
    log('dbPath / migrationsFolder must be strings');
    process.exit(2);
  }

  const { db, close } = openDatabase({ path: input.dbPath });
  runMigrations(db, { migrationsFolder: input.migrationsFolder });

  const persistence = new DrizzleRunnerPersistence(
    new RunRepository(db),
    new RepairRepository(db),
    new ScriptHistoryRepository(db),
  );

  const emitter = createRunnerEmitter();
  emitter.on(writeEvent);

  const suite = reviveDates(input.suite);
  const stepEntries = Array.isArray(input.steps) ? input.steps : [];
  const steps = stepEntries.map((e) => reviveDates(e.step));
  const stepRunIdByStepId = new Map();
  const stepIdByStepRunId = new Map();
  for (const e of stepEntries) {
    if (typeof e.stepRunId === 'string' && typeof e.step?.id === 'string') {
      stepRunIdByStepId.set(e.step.id, e.stepRunId);
      stepIdByStepRunId.set(e.stepRunId, e.step.id);
    }
  }

  bindPersistence(emitter, persistence, input.suiteRunId, suite.id, stepIdByStepRunId);

  const llmClient = useFakeLLM
    ? createFakeLLMClient()
    : createAnthropicLLMClient({ apiKey: config.anthropicApiKey, model: config.anthropicModel });

  const spawnFn = useFakeLLM ? createFakeSpawn() : nodeSpawnFn;

  let result;
  try {
    result = await runSuite(
      { suite, steps },
      {
        spawnFn,
        fs: realFileSystem,
        llmClient,
        emitter,
        workDir: config.workDir,
        stepTimeoutMs: config.stepTimeoutMs,
        maxAttempts: config.maxRepairAttempts,
        suiteRunId: input.suiteRunId,
        stepRunIdFor: (step) => stepRunIdByStepId.get(step.id) ?? randomUUID(),
      },
    );
  } catch (e) {
    log(`runSuite threw: ${String(e)}`);
    close();
    process.exit(1);
  }

  close();
  if (!result.ok) {
    process.exit(1);
  }
  process.exit(result.value.status === 'succeeded' ? 0 : 1);
};

main().catch((e) => {
  log(`fatal: ${String(e)}`);
  process.exit(2);
});
