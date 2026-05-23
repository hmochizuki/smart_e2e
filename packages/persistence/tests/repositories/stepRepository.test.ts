import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTmpDb, type TmpDb } from '../helpers/tmpDb.js';
import { SuiteRepository } from '../../src/repositories/suiteRepository.js';
import { StepRepository } from '../../src/repositories/stepRepository.js';
import { NotFoundError, ConflictError } from '../../src/errors.js';

const SCRIPT = "await page.goto('http://example.com');";

describe('StepRepository', () => {
  let tmp: TmpDb;
  let suiteRepo: SuiteRepository;
  let stepRepo: StepRepository;
  let suiteId: string;

  beforeEach(async () => {
    tmp = createTmpDb();
    suiteRepo = new SuiteRepository(tmp.db);
    stepRepo = new StepRepository(tmp.db);
    const suite = await suiteRepo.create({ name: 'suite' });
    suiteId = suite.id;
  });

  afterEach(() => {
    tmp.close();
  });

  describe('create', () => {
    it('Step を作成して返す', async () => {
      const s = await stepRepo.create({
        suiteId,
        order: 0,
        name: 'goto',
        script: SCRIPT,
      });
      expect(s.suiteId).toBe(suiteId);
      expect(s.order).toBe(0);
      expect(s.script).toBe(SCRIPT);
    });

    it('同じ (suite_id, order) は UNIQUE 違反で ConflictError', async () => {
      await stepRepo.create({
        suiteId,
        order: 0,
        name: 'a',
        script: SCRIPT,
      });
      await expect(
        stepRepo.create({
          suiteId,
          order: 0,
          name: 'b',
          script: SCRIPT,
        }),
      ).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe('listBySuite', () => {
    it('order 昇順で返す', async () => {
      await stepRepo.create({ suiteId, order: 1, name: 'b', script: SCRIPT });
      await stepRepo.create({ suiteId, order: 0, name: 'a', script: SCRIPT });
      const all = await stepRepo.listBySuite(suiteId);
      expect(all.map((s) => s.name)).toEqual(['a', 'b']);
    });
  });

  describe('update', () => {
    it('script だけ更新できる', async () => {
      const s = await stepRepo.create({
        suiteId,
        order: 0,
        name: 'a',
        script: SCRIPT,
      });
      const u = await stepRepo.update(s.id, { script: 'new' });
      expect(u.script).toBe('new');
      expect(u.name).toBe('a');
    });

    it('存在しない id は NotFoundError', async () => {
      await expect(
        stepRepo.update('00000000-0000-0000-0000-000000000000', {
          name: 'x',
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('CASCADE delete', () => {
    it('Suite 削除で Step も消える', async () => {
      const s = await stepRepo.create({
        suiteId,
        order: 0,
        name: 'a',
        script: SCRIPT,
      });
      await suiteRepo.delete(suiteId);
      expect(await stepRepo.findById(s.id)).toBeNull();
    });
  });
});
