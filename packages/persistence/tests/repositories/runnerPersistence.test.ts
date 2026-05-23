import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTmpDb, type TmpDb } from '../helpers/tmpDb.js';
import { SuiteRepository } from '../../src/repositories/suiteRepository.js';
import { StepRepository } from '../../src/repositories/stepRepository.js';
import { RunRepository } from '../../src/repositories/runRepository.js';
import { RepairRepository } from '../../src/repositories/repairRepository.js';
import { ScriptHistoryRepository } from '../../src/repositories/scriptHistoryRepository.js';
import { DrizzleRunnerPersistence } from '../../src/repositories/runnerPersistence.js';

const SCRIPT = "await page.goto('http://x.test/');";

describe('DrizzleRunnerPersistence', () => {
  let tmp: TmpDb;
  let rp: DrizzleRunnerPersistence;
  let suiteId: string;
  let stepId: string;
  let runRepo: RunRepository;
  let repairRepo: RepairRepository;
  let shRepo: ScriptHistoryRepository;

  beforeEach(async () => {
    tmp = createTmpDb();
    const suiteRepo = new SuiteRepository(tmp.db);
    const stepRepo = new StepRepository(tmp.db);
    runRepo = new RunRepository(tmp.db);
    repairRepo = new RepairRepository(tmp.db);
    shRepo = new ScriptHistoryRepository(tmp.db);
    rp = new DrizzleRunnerPersistence(runRepo, repairRepo, shRepo);

    const suite = await suiteRepo.create({ name: 'flow' });
    suiteId = suite.id;
    const step = await stepRepo.create({
      suiteId,
      order: 0,
      name: 'st',
      script: SCRIPT,
    });
    stepId = step.id;
  });

  afterEach(() => {
    tmp.close();
  });

  it('createSuiteRun: 外部 id をそのまま返し、その id で保存される', async () => {
    const id = randomUUID();
    const startedAt = new Date();
    const returned = await rp.createSuiteRun({
      suiteRunId: id,
      suiteId,
      status: 'running',
      startedAt,
    });
    expect(returned).toBe(id);
    const found = await runRepo.findSuiteRunById(id);
    expect(found?.id).toBe(id);
    expect(found?.status).toBe('running');
  });

  it('updateSuiteRun: status / finishedAt / error を更新', async () => {
    const id = randomUUID();
    await rp.createSuiteRun({
      suiteRunId: id,
      suiteId,
      status: 'running',
      startedAt: new Date(),
    });
    const finishedAt = new Date();
    await rp.updateSuiteRun(id, {
      status: 'failed',
      finishedAt,
      error: 'oops',
    });
    const found = await runRepo.findSuiteRunById(id);
    expect(found?.status).toBe('failed');
    expect(found?.error).toBe('oops');
  });

  it('createStepRun: 外部 id と attempts を渡し、finalScript=null も許容', async () => {
    const suiteRunId = randomUUID();
    await rp.createSuiteRun({
      suiteRunId,
      suiteId,
      status: 'running',
      startedAt: new Date(),
    });
    const id = randomUUID();
    const returned = await rp.createStepRun({
      stepRunId: id,
      suiteRunId,
      stepId,
      status: 'pending',
      attempts: 1,
      startedAt: new Date(),
      finalScript: null,
    });
    expect(returned).toBe(id);
    const found = await runRepo.findStepRunById(id);
    expect(found?.finalScript).toBeNull();
  });

  it('createStepRun: attempts=2 で再試行開始も保存できる', async () => {
    const suiteRunId = randomUUID();
    await rp.createSuiteRun({
      suiteRunId,
      suiteId,
      status: 'running',
      startedAt: new Date(),
    });
    const id = randomUUID();
    await rp.createStepRun({
      stepRunId: id,
      suiteRunId,
      stepId,
      status: 'running',
      attempts: 2,
      startedAt: new Date(),
      finalScript: SCRIPT,
    });
    const found = await runRepo.findStepRunById(id);
    expect(found?.attempts).toBe(2);
  });

  it('updateStepRun: attempts と finalScript を更新', async () => {
    const suiteRunId = randomUUID();
    await rp.createSuiteRun({
      suiteRunId,
      suiteId,
      status: 'running',
      startedAt: new Date(),
    });
    const id = randomUUID();
    await rp.createStepRun({
      stepRunId: id,
      suiteRunId,
      stepId,
      status: 'pending',
      attempts: 1,
      startedAt: new Date(),
      finalScript: SCRIPT,
    });
    await rp.updateStepRun(id, {
      status: 'succeeded',
      attempts: 2,
      finishedAt: new Date(),
      finalScript: 'updated',
    });
    const found = await runRepo.findStepRunById(id);
    expect(found?.status).toBe('succeeded');
    expect(found?.attempts).toBe(2);
    expect(found?.finalScript).toBe('updated');
  });

  it('createRepairAttempt: 外部 id をそのまま返す', async () => {
    const suiteRunId = randomUUID();
    await rp.createSuiteRun({
      suiteRunId,
      suiteId,
      status: 'running',
      startedAt: new Date(),
    });
    const stepRunId = randomUUID();
    await rp.createStepRun({
      stepRunId,
      suiteRunId,
      stepId,
      status: 'running',
      attempts: 1,
      startedAt: new Date(),
      finalScript: SCRIPT,
    });
    const id = randomUUID();
    const returned = await rp.createRepairAttempt({
      repairAttemptId: id,
      stepRunId,
      n: 1,
      classification: 'ui_change',
      errorLog: 'fail',
      screenshotPath: null,
      domSnapshot: null,
      llmInputScript: SCRIPT,
      llmOutputScript: 'fixed',
      result: 'success',
      createdAt: new Date(),
    });
    expect(returned).toBe(id);
    const found = await repairRepo.findRepairAttemptById(id);
    expect(found?.id).toBe(id);
    expect(found?.classification).toBe('ui_change');
  });

  it('saveScriptHistory: codegen と auto_repair の両方を保存', async () => {
    await rp.saveScriptHistory({
      stepId,
      script: SCRIPT,
      source: 'codegen',
      sourceRepairAttemptId: null,
      createdAt: new Date(),
    });
    const suiteRunId = randomUUID();
    await rp.createSuiteRun({
      suiteRunId,
      suiteId,
      status: 'running',
      startedAt: new Date(),
    });
    const stepRunId = randomUUID();
    await rp.createStepRun({
      stepRunId,
      suiteRunId,
      stepId,
      status: 'running',
      attempts: 1,
      startedAt: new Date(),
      finalScript: SCRIPT,
    });
    const raId = randomUUID();
    await rp.createRepairAttempt({
      repairAttemptId: raId,
      stepRunId,
      n: 1,
      classification: 'ui_change',
      errorLog: 'fail',
      screenshotPath: null,
      domSnapshot: null,
      llmInputScript: SCRIPT,
      llmOutputScript: 'fixed',
      result: 'success',
      createdAt: new Date(),
    });
    await rp.saveScriptHistory({
      stepId,
      script: 'fixed',
      source: 'auto_repair',
      sourceRepairAttemptId: raId,
      createdAt: new Date(),
    });
    const list = await shRepo.listScriptHistoriesByStepId(stepId);
    expect(list.length).toBe(2);
    expect(list.map((s) => s.source)).toEqual(['codegen', 'auto_repair']);
  });

  it('一連のフロー: SuiteRun → StepRun → RepairAttempt → ScriptHistory → update', async () => {
    const suiteRunId = randomUUID();
    await rp.createSuiteRun({
      suiteRunId,
      suiteId,
      status: 'running',
      startedAt: new Date(),
    });
    const stepRunId = randomUUID();
    await rp.createStepRun({
      stepRunId,
      suiteRunId,
      stepId,
      status: 'running',
      attempts: 1,
      startedAt: new Date(),
      finalScript: SCRIPT,
    });
    const raId = randomUUID();
    await rp.createRepairAttempt({
      repairAttemptId: raId,
      stepRunId,
      n: 1,
      classification: 'ui_change',
      errorLog: 'sel not found',
      screenshotPath: '/tmp/x.png',
      domSnapshot: '<html></html>',
      llmInputScript: SCRIPT,
      llmOutputScript: 'await page.click("#new");',
      result: 'success',
      createdAt: new Date(),
    });
    await rp.saveScriptHistory({
      stepId,
      script: 'await page.click("#new");',
      source: 'auto_repair',
      sourceRepairAttemptId: raId,
      createdAt: new Date(),
    });
    await rp.updateStepRun(stepRunId, {
      status: 'succeeded',
      attempts: 2,
      finishedAt: new Date(),
      finalScript: 'await page.click("#new");',
    });
    await rp.updateSuiteRun(suiteRunId, {
      status: 'succeeded',
      finishedAt: new Date(),
    });

    const sr = await runRepo.findSuiteRunById(suiteRunId);
    expect(sr?.status).toBe('succeeded');
    expect(sr?.finishedAt).not.toBeNull();

    const stepRun = await runRepo.findStepRunById(stepRunId);
    expect(stepRun?.status).toBe('succeeded');
    expect(stepRun?.attempts).toBe(2);

    const ras = await repairRepo.listRepairAttemptsByStepRunId(stepRunId);
    expect(ras.length).toBe(1);

    const histories = await shRepo.listScriptHistoriesByStepId(stepId);
    expect(histories.length).toBe(1);
  });
});
