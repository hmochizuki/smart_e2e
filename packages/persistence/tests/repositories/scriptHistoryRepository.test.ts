import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTmpDb, type TmpDb } from '../helpers/tmpDb.js';
import { SuiteRepository } from '../../src/repositories/suiteRepository.js';
import { StepRepository } from '../../src/repositories/stepRepository.js';
import { RunRepository } from '../../src/repositories/runRepository.js';
import { RepairRepository } from '../../src/repositories/repairRepository.js';
import { ScriptHistoryRepository } from '../../src/repositories/scriptHistoryRepository.js';

const SCRIPT = "await page.click('#x');";

describe('ScriptHistoryRepository', () => {
  let tmp: TmpDb;
  let shRepo: ScriptHistoryRepository;
  let repairRepo: RepairRepository;
  let stepId: string;
  let repairAttemptId: string;
  let stepRunId: string;

  beforeEach(async () => {
    tmp = createTmpDb();
    const suiteRepo = new SuiteRepository(tmp.db);
    const stepRepo = new StepRepository(tmp.db);
    const runRepo = new RunRepository(tmp.db);
    repairRepo = new RepairRepository(tmp.db);
    shRepo = new ScriptHistoryRepository(tmp.db);

    const suite = await suiteRepo.create({ name: 's' });
    const step = await stepRepo.create({
      suiteId: suite.id,
      order: 0,
      name: 'st',
      script: SCRIPT,
    });
    stepId = step.id;
    const suiteRunId = randomUUID();
    await runRepo.createSuiteRun(suiteRunId, {
      suiteId: suite.id,
      status: 'running',
      startedAt: new Date(),
      finishedAt: null,
    });
    stepRunId = randomUUID();
    await runRepo.createStepRun(stepRunId, {
      suiteRunId,
      stepId: step.id,
      status: 'running',
      attempts: 1,
      startedAt: new Date(),
      finishedAt: null,
      finalScript: SCRIPT,
    });
    repairAttemptId = randomUUID();
    await repairRepo.createRepairAttempt(repairAttemptId, {
      stepRunId,
      n: 1,
      classification: 'ui_change',
      errorLog: 'x',
      screenshotPath: null,
      domSnapshot: null,
      llmInputScript: SCRIPT,
      llmOutputScript: 'fix',
      result: 'success',
      createdAt: new Date(),
    });
  });

  afterEach(() => {
    tmp.close();
  });

  describe('createScriptHistory', () => {
    it('codegen + sourceRepairAttemptId=null で作成可能', async () => {
      const sh = await shRepo.createScriptHistory({
        stepId,
        script: SCRIPT,
        source: 'codegen',
        sourceRepairAttemptId: null,
        createdAt: new Date(),
      });
      expect(sh.source).toBe('codegen');
      expect(sh.sourceRepairAttemptId).toBeNull();
    });

    it('auto_repair + sourceRepairAttemptId が指定で作成可能', async () => {
      const sh = await shRepo.createScriptHistory({
        stepId,
        script: 'fixed',
        source: 'auto_repair',
        sourceRepairAttemptId: repairAttemptId,
        createdAt: new Date(),
      });
      expect(sh.source).toBe('auto_repair');
      expect(sh.sourceRepairAttemptId).toBe(repairAttemptId);
    });

    it('refine 違反: codegen + sourceRepairAttemptId 非null で parse エラー', async () => {
      await expect(
        shRepo.createScriptHistory({
          stepId,
          script: SCRIPT,
          source: 'codegen',
          sourceRepairAttemptId: repairAttemptId,
          createdAt: new Date(),
        }),
      ).rejects.toThrow();
    });

    it('refine 違反: auto_repair + sourceRepairAttemptId=null で parse エラー', async () => {
      await expect(
        shRepo.createScriptHistory({
          stepId,
          script: SCRIPT,
          source: 'auto_repair',
          sourceRepairAttemptId: null,
          createdAt: new Date(),
        }),
      ).rejects.toThrow();
    });
  });

  describe('CASCADE', () => {
    it('RepairAttempt を消すと、それを参照する auto_repair ScriptHistory も消える (shared refine 整合)', async () => {
      const sh = await shRepo.createScriptHistory({
        stepId,
        script: 'fixed',
        source: 'auto_repair',
        sourceRepairAttemptId: repairAttemptId,
        createdAt: new Date(),
      });
      tmp.raw.prepare('DELETE FROM repair_attempts WHERE id = ?').run(repairAttemptId);
      const found = await shRepo.findScriptHistoryById(sh.id);
      expect(found).toBeNull();
    });
  });

  describe('list / find', () => {
    it('listScriptHistoriesByStepId: createdAt 昇順', async () => {
      const a = await shRepo.createScriptHistory({
        stepId,
        script: 'a',
        source: 'codegen',
        sourceRepairAttemptId: null,
        createdAt: new Date(1000),
      });
      const b = await shRepo.createScriptHistory({
        stepId,
        script: 'b',
        source: 'user_edit',
        sourceRepairAttemptId: null,
        createdAt: new Date(2000),
      });
      const list = await shRepo.listScriptHistoriesByStepId(stepId);
      expect(list.map((s) => s.id)).toEqual([a.id, b.id]);
    });

    it('findScriptHistoryById', async () => {
      const sh = await shRepo.createScriptHistory({
        stepId,
        script: 'x',
        source: 'codegen',
        sourceRepairAttemptId: null,
        createdAt: new Date(),
      });
      const found = await shRepo.findScriptHistoryById(sh.id);
      expect(found?.id).toBe(sh.id);
    });
  });
});
