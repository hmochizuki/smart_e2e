import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTmpDb, type TmpDb } from '../helpers/tmpDb.js';
import { SuiteRepository } from '../../src/repositories/suiteRepository.js';
import { StepRepository } from '../../src/repositories/stepRepository.js';
import { RunRepository } from '../../src/repositories/runRepository.js';
import { RepairRepository } from '../../src/repositories/repairRepository.js';
import { ConflictError } from '../../src/errors.js';

const SCRIPT = "await page.click('#login');";

describe('RepairRepository', () => {
  let tmp: TmpDb;
  let repairRepo: RepairRepository;
  let stepRunId: string;

  beforeEach(async () => {
    tmp = createTmpDb();
    const suiteRepo = new SuiteRepository(tmp.db);
    const stepRepo = new StepRepository(tmp.db);
    const runRepo = new RunRepository(tmp.db);
    repairRepo = new RepairRepository(tmp.db);

    const suite = await suiteRepo.create({ name: 's' });
    const step = await stepRepo.create({
      suiteId: suite.id,
      order: 0,
      name: 'st',
      script: SCRIPT,
    });
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
  });

  afterEach(() => {
    tmp.close();
  });

  describe('createRepairAttempt', () => {
    it('外部 id を受け取って全フィールド指定で成功', async () => {
      const id = randomUUID();
      const created = await repairRepo.createRepairAttempt(id, {
        stepRunId,
        n: 1,
        classification: 'ui_change',
        errorLog: 'selector not found',
        screenshotPath: '/tmp/x.png',
        domSnapshot: '<html></html>',
        llmInputScript: SCRIPT,
        llmOutputScript: 'await page.click("#new");',
        result: 'success',
        createdAt: new Date(),
      });
      expect(created.id).toBe(id);
      expect(created.stepRunId).toBe(stepRunId);
      expect(created.n).toBe(1);
      expect(created.classification).toBe('ui_change');
      expect(created.screenshotPath).toBe('/tmp/x.png');
    });

    it('nullable フィールドを null にできる', async () => {
      const created = await repairRepo.createRepairAttempt(randomUUID(), {
        stepRunId,
        n: 1,
        classification: 'transient',
        errorLog: 'flaky',
        screenshotPath: null,
        domSnapshot: null,
        llmInputScript: SCRIPT,
        llmOutputScript: null,
        result: 'failure',
        createdAt: new Date(),
      });
      expect(created.screenshotPath).toBeNull();
      expect(created.domSnapshot).toBeNull();
      expect(created.llmOutputScript).toBeNull();
    });

    it('同一 (stepRunId, n) は UNIQUE 違反で ConflictError', async () => {
      await repairRepo.createRepairAttempt(randomUUID(), {
        stepRunId,
        n: 1,
        classification: 'transient',
        errorLog: 'a',
        screenshotPath: null,
        domSnapshot: null,
        llmInputScript: SCRIPT,
        llmOutputScript: null,
        result: 'failure',
        createdAt: new Date(),
      });
      await expect(
        repairRepo.createRepairAttempt(randomUUID(), {
          stepRunId,
          n: 1,
          classification: 'transient',
          errorLog: 'b',
          screenshotPath: null,
          domSnapshot: null,
          llmInputScript: SCRIPT,
          llmOutputScript: null,
          result: 'failure',
          createdAt: new Date(),
        }),
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it('存在しない stepRunId は FK エラーで ConflictError', async () => {
      await expect(
        repairRepo.createRepairAttempt(randomUUID(), {
          stepRunId: '00000000-0000-0000-0000-000000000000',
          n: 1,
          classification: 'transient',
          errorLog: 'a',
          screenshotPath: null,
          domSnapshot: null,
          llmInputScript: SCRIPT,
          llmOutputScript: null,
          result: 'failure',
          createdAt: new Date(),
        }),
      ).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe('list / find', () => {
    it('listRepairAttemptsByStepRunId: n 昇順で返す', async () => {
      const a = await repairRepo.createRepairAttempt(randomUUID(), {
        stepRunId,
        n: 2,
        classification: 'transient',
        errorLog: 'second',
        screenshotPath: null,
        domSnapshot: null,
        llmInputScript: SCRIPT,
        llmOutputScript: null,
        result: 'failure',
        createdAt: new Date(),
      });
      const b = await repairRepo.createRepairAttempt(randomUUID(), {
        stepRunId,
        n: 1,
        classification: 'transient',
        errorLog: 'first',
        screenshotPath: null,
        domSnapshot: null,
        llmInputScript: SCRIPT,
        llmOutputScript: null,
        result: 'failure',
        createdAt: new Date(),
      });
      const list = await repairRepo.listRepairAttemptsByStepRunId(stepRunId);
      expect(list.map((r) => r.n)).toEqual([1, 2]);
      expect(list.map((r) => r.id)).toEqual([b.id, a.id]);
    });

    it('findRepairAttemptById', async () => {
      const id = randomUUID();
      await repairRepo.createRepairAttempt(id, {
        stepRunId,
        n: 1,
        classification: 'transient',
        errorLog: 'x',
        screenshotPath: null,
        domSnapshot: null,
        llmInputScript: SCRIPT,
        llmOutputScript: null,
        result: 'failure',
        createdAt: new Date(),
      });
      const found = await repairRepo.findRepairAttemptById(id);
      expect(found?.id).toBe(id);
    });
  });
});
