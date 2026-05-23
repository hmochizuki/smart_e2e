import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTmpDb, type TmpDb } from '../helpers/tmpDb.js';
import { SuiteRepository } from '../../src/repositories/suiteRepository.js';
import { NotFoundError } from '../../src/errors.js';

describe('SuiteRepository', () => {
  let tmp: TmpDb;
  let repo: SuiteRepository;

  beforeEach(() => {
    tmp = createTmpDb();
    repo = new SuiteRepository(tmp.db);
  });

  afterEach(() => {
    tmp.close();
  });

  describe('create', () => {
    it('Suite を作成して domain 型 (Date 入り) で返す', async () => {
      const before = Date.now();
      const s = await repo.create({ name: 'login flow' });
      expect(s.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(s.name).toBe('login flow');
      expect(s.description).toBeUndefined();
      expect(s.createdAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(s.updatedAt.getTime()).toBeGreaterThanOrEqual(before);
    });

    it('description optional を保存できる', async () => {
      const s = await repo.create({
        name: 'with desc',
        description: 'a description',
      });
      expect(s.description).toBe('a description');
    });

    it('zod 検証で失敗する (空文字 name)', async () => {
      await expect(repo.create({ name: '' })).rejects.toThrow();
    });
  });

  describe('findById', () => {
    it('存在すれば Suite を返す', async () => {
      const s = await repo.create({ name: 'a' });
      const found = await repo.findById(s.id);
      expect(found?.id).toBe(s.id);
    });

    it('存在しなければ null を返す', async () => {
      const found = await repo.findById('00000000-0000-0000-0000-000000000000');
      expect(found).toBeNull();
    });
  });

  describe('findByIdOrThrow', () => {
    it('存在しなければ NotFoundError', async () => {
      await expect(
        repo.findByIdOrThrow('00000000-0000-0000-0000-000000000000'),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('list', () => {
    it('全 Suite を作成日順で返す', async () => {
      const a = await repo.create({ name: 'a' });
      const b = await repo.create({ name: 'b' });
      const all = await repo.list();
      expect(all.map((s) => s.id)).toEqual([a.id, b.id]);
    });
  });

  describe('update', () => {
    it('名前を更新して updatedAt が進む', async () => {
      const s = await repo.create({ name: 'a' });
      await new Promise((resolve) => setTimeout(resolve, 2));
      const updated = await repo.update(s.id, { name: 'b' });
      expect(updated.name).toBe('b');
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(s.updatedAt.getTime());
    });

    it('description を undefined → 値 → undefined に更新できる', async () => {
      const s = await repo.create({ name: 'a' });
      const u1 = await repo.update(s.id, { description: 'hello' });
      expect(u1.description).toBe('hello');
      const u2 = await repo.update(s.id, { description: undefined });
      expect(u2.description).toBeUndefined();
    });

    it('存在しない id は NotFoundError', async () => {
      await expect(
        repo.update('00000000-0000-0000-0000-000000000000', { name: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('delete', () => {
    it('削除すると findById で null', async () => {
      const s = await repo.create({ name: 'a' });
      await repo.delete(s.id);
      expect(await repo.findById(s.id)).toBeNull();
    });
  });
});
