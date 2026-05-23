import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTmpDb, type TmpDb } from '../helpers/tmpDb.js';
import { SuiteRepository } from '../../src/repositories/suiteRepository.js';
import { StepRepository } from '../../src/repositories/stepRepository.js';
import { RunRepository } from '../../src/repositories/runRepository.js';
import { NotFoundError } from '../../src/errors.js';

const SCRIPT = "await page.goto('http://example.com');";

describe('RunRepository', () => {
  let tmp: TmpDb;
  let suiteRepo: SuiteRepository;
  let stepRepo: StepRepository;
  let runRepo: RunRepository;
  let suiteId: string;
  let stepId: string;

  beforeEach(async () => {
    tmp = createTmpDb();
    suiteRepo = new SuiteRepository(tmp.db);
    stepRepo = new StepRepository(tmp.db);
    runRepo = new RunRepository(tmp.db);
    const suite = await suiteRepo.create({ name: 'suite' });
    suiteId = suite.id;
    const step = await stepRepo.create({
      suiteId,
      order: 0,
      name: 'go',
      script: SCRIPT,
    });
    stepId = step.id;
  });

  afterEach(() => {
    tmp.close();
  });

  describe('SuiteRun', () => {
    it('createSuiteRun: 外部 id を受け取り、その id で保存する', async () => {
      const id = randomUUID();
      const startedAt = new Date('2026-05-23T00:00:00.000Z');
      const sr = await runRepo.createSuiteRun(id, {
        suiteId,
        status: 'pending',
        startedAt,
        finishedAt: null,
      });
      expect(sr.id).toBe(id);
      expect(sr.status).toBe('pending');
      expect(sr.finishedAt).toBeNull();
    });

    it('findSuiteRunById: 存在すれば返す', async () => {
      const id = randomUUID();
      await runRepo.createSuiteRun(id, {
        suiteId,
        status: 'running',
        startedAt: new Date(),
        finishedAt: null,
      });
      const found = await runRepo.findSuiteRunById(id);
      expect(found?.id).toBe(id);
    });

    it('findSuiteRunById: 存在しなければ null', async () => {
      expect(await runRepo.findSuiteRunById('00000000-0000-0000-0000-000000000000')).toBeNull();
    });

    it('listSuiteRunsBySuiteId: startedAt 昇順で返す', async () => {
      const idA = randomUUID();
      const idB = randomUUID();
      await runRepo.createSuiteRun(idA, {
        suiteId,
        status: 'pending',
        startedAt: new Date(1000),
        finishedAt: null,
      });
      await runRepo.createSuiteRun(idB, {
        suiteId,
        status: 'pending',
        startedAt: new Date(2000),
        finishedAt: null,
      });
      const list = await runRepo.listSuiteRunsBySuiteId(suiteId);
      expect(list.map((s) => s.id)).toEqual([idA, idB]);
    });

    it('updateSuiteRun: status / finishedAt / error を更新できる', async () => {
      const id = randomUUID();
      await runRepo.createSuiteRun(id, {
        suiteId,
        status: 'running',
        startedAt: new Date(),
        finishedAt: null,
      });
      const finishedAt = new Date('2026-05-23T01:00:00.000Z');
      await runRepo.updateSuiteRun(id, {
        status: 'failed',
        finishedAt,
        error: 'boom',
      });
      const updated = await runRepo.findSuiteRunById(id);
      expect(updated?.status).toBe('failed');
      expect(updated?.finishedAt?.toISOString()).toBe(finishedAt.toISOString());
      expect(updated?.error).toBe('boom');
    });

    it('updateSuiteRun: status のみ optional 指定でも動く', async () => {
      const id = randomUUID();
      await runRepo.createSuiteRun(id, {
        suiteId,
        status: 'running',
        startedAt: new Date(),
        finishedAt: null,
      });
      await runRepo.updateSuiteRun(id, { status: 'succeeded' });
      const updated = await runRepo.findSuiteRunById(id);
      expect(updated?.status).toBe('succeeded');
    });

    it('updateSuiteRun: 何も指定しなくても NotFoundError は出さない (op no-op)', async () => {
      const id = randomUUID();
      await runRepo.createSuiteRun(id, {
        suiteId,
        status: 'running',
        startedAt: new Date(),
        finishedAt: null,
      });
      await runRepo.updateSuiteRun(id, {});
      const updated = await runRepo.findSuiteRunById(id);
      expect(updated?.status).toBe('running');
    });

    it('updateSuiteRun: 存在しない id は NotFoundError', async () => {
      await expect(
        runRepo.updateSuiteRun('00000000-0000-0000-0000-000000000000', {
          status: 'failed',
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it('createSuiteRun: 不正な status は zod parse エラー', async () => {
      await expect(
        runRepo.createSuiteRun(randomUUID(), {
          suiteId,
          // @ts-expect-error 不正値を渡すテスト
          status: 'unknown',
          startedAt: new Date(),
          finishedAt: null,
        }),
      ).rejects.toThrow();
    });
  });

  describe('StepRun', () => {
    let suiteRunId: string;

    beforeEach(async () => {
      suiteRunId = randomUUID();
      await runRepo.createSuiteRun(suiteRunId, {
        suiteId,
        status: 'running',
        startedAt: new Date(),
        finishedAt: null,
      });
    });

    it('createStepRun: 外部 id を受け取って保存', async () => {
      const id = randomUUID();
      const sr = await runRepo.createStepRun(id, {
        suiteRunId,
        stepId,
        status: 'pending',
        attempts: 1,
        startedAt: new Date(),
        finishedAt: null,
        finalScript: SCRIPT,
      });
      expect(sr.id).toBe(id);
      expect(sr.attempts).toBe(1);
      expect(sr.finalScript).toBe(SCRIPT);
    });

    it('createStepRun: finalScript=null でも成功', async () => {
      const id = randomUUID();
      const sr = await runRepo.createStepRun(id, {
        suiteRunId,
        stepId,
        status: 'pending',
        attempts: 1,
        startedAt: new Date(),
        finishedAt: null,
        finalScript: null,
      });
      expect(sr.finalScript).toBeNull();
    });

    it('createStepRun: attempts を 2 で開始できる', async () => {
      const id = randomUUID();
      const sr = await runRepo.createStepRun(id, {
        suiteRunId,
        stepId,
        status: 'running',
        attempts: 2,
        startedAt: new Date(),
        finishedAt: null,
        finalScript: SCRIPT,
      });
      expect(sr.attempts).toBe(2);
    });

    it('listStepRunsBySuiteRunId: 全件返す', async () => {
      await runRepo.createStepRun(randomUUID(), {
        suiteRunId,
        stepId,
        status: 'pending',
        attempts: 1,
        startedAt: new Date(),
        finishedAt: null,
        finalScript: SCRIPT,
      });
      const list = await runRepo.listStepRunsBySuiteRunId(suiteRunId);
      expect(list.length).toBe(1);
    });

    it('updateStepRun: status / attempts / finalScript を更新できる', async () => {
      const id = randomUUID();
      await runRepo.createStepRun(id, {
        suiteRunId,
        stepId,
        status: 'pending',
        attempts: 1,
        startedAt: new Date(),
        finishedAt: null,
        finalScript: SCRIPT,
      });
      const finishedAt = new Date();
      await runRepo.updateStepRun(id, {
        status: 'succeeded',
        attempts: 2,
        finishedAt,
        finalScript: 'updated',
      });
      const updated = await runRepo.findStepRunById(id);
      expect(updated?.status).toBe('succeeded');
      expect(updated?.attempts).toBe(2);
      expect(updated?.finalScript).toBe('updated');
    });

    it('updateStepRun: 任意のフィールドのみで更新できる', async () => {
      const id = randomUUID();
      await runRepo.createStepRun(id, {
        suiteRunId,
        stepId,
        status: 'pending',
        attempts: 1,
        startedAt: new Date(),
        finishedAt: null,
        finalScript: SCRIPT,
      });
      await runRepo.updateStepRun(id, { attempts: 3 });
      const updated = await runRepo.findStepRunById(id);
      expect(updated?.attempts).toBe(3);
      expect(updated?.status).toBe('pending');
    });

    it('updateStepRun: 存在しない id は NotFoundError', async () => {
      await expect(
        runRepo.updateStepRun('00000000-0000-0000-0000-000000000000', {
          status: 'succeeded',
          attempts: 1,
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it('CASCADE: SuiteRun 削除で StepRun も消える (整合性確認)', async () => {
      const id = randomUUID();
      await runRepo.createStepRun(id, {
        suiteRunId,
        stepId,
        status: 'pending',
        attempts: 1,
        startedAt: new Date(),
        finishedAt: null,
        finalScript: SCRIPT,
      });
      await runRepo.deleteSuiteRun(suiteRunId);
      expect(await runRepo.findStepRunById(id)).toBeNull();
    });
  });
});
