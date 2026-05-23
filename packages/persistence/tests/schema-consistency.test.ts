import { describe, expect, it, expectTypeOf } from 'vitest';
import { z } from 'zod';
import { getTableColumns } from 'drizzle-orm';
import type { Table } from 'drizzle-orm';
import {
  SuiteSchema,
  StepSchema,
  SuiteRunSchema,
  StepRunSchema,
  RepairAttemptSchema,
  ScriptHistorySchema,
  type Suite,
  type Step,
  type SuiteRun,
  type StepRun,
  type RepairAttempt,
  type ScriptHistory,
} from '@smart-e2e/shared';
import {
  suites,
  steps,
  suiteRuns,
  stepRuns,
  repairAttempts,
  scriptHistories,
  type SuiteRow,
  type StepRow,
  type SuiteRunRow,
  type StepRunRow,
  type RepairAttemptRow,
  type ScriptHistoryRow,
} from '../src/schema/index.js';

const sharedFields = (schema: z.ZodObject<z.ZodRawShape>): readonly string[] =>
  Object.keys(schema.shape).sort();

const drizzleFields = (table: Table): readonly string[] =>
  Object.keys(getTableColumns(table)).sort();

describe('schema consistency: shared zod <-> drizzle', () => {
  describe('Suite', () => {
    it('フィールド名 (camelCase) が一致する', () => {
      expect(drizzleFields(suites)).toEqual(sharedFields(SuiteSchema));
    });
    it('型レベル: name / id', () => {
      expectTypeOf<SuiteRow['id']>().toEqualTypeOf<Suite['id']>();
      expectTypeOf<SuiteRow['name']>().toEqualTypeOf<Suite['name']>();
    });
    it('型レベル: description (DB: string | null) は shared (string | null | undefined) に assign 可能', () => {
      expectTypeOf<SuiteRow['description']>().toEqualTypeOf<string | null>();
      expectTypeOf<SuiteRow['description']>().toMatchTypeOf<Suite['description']>();
    });
  });

  describe('Step', () => {
    it('フィールド名が一致する', () => {
      expect(drizzleFields(steps)).toEqual(sharedFields(StepSchema));
    });
    it('型レベル: 主要フィールド', () => {
      expectTypeOf<StepRow['id']>().toEqualTypeOf<Step['id']>();
      expectTypeOf<StepRow['suiteId']>().toEqualTypeOf<Step['suiteId']>();
      expectTypeOf<StepRow['order']>().toEqualTypeOf<Step['order']>();
      expectTypeOf<StepRow['script']>().toEqualTypeOf<Step['script']>();
    });
  });

  describe('SuiteRun', () => {
    it('フィールド名が一致する', () => {
      expect(drizzleFields(suiteRuns)).toEqual(sharedFields(SuiteRunSchema));
    });
    it('型レベル: id / suiteId', () => {
      expectTypeOf<SuiteRunRow['id']>().toEqualTypeOf<SuiteRun['id']>();
      expectTypeOf<SuiteRunRow['suiteId']>().toEqualTypeOf<SuiteRun['suiteId']>();
    });
    // 注意: status は DB は text 型 (= string)、shared は enum literal。
    // 型レベルでは乖離するため、rowToSuiteRun 内の RunStatusSchema.parse() で実行時に narrow する。
    // ここでは field 存在のみ確認する。
    it('型レベル: error (DB: string | null) は shared (string | null | undefined) に assign 可能', () => {
      expectTypeOf<SuiteRunRow['error']>().toEqualTypeOf<string | null>();
      expectTypeOf<SuiteRunRow['error']>().toMatchTypeOf<SuiteRun['error']>();
    });
  });

  describe('StepRun', () => {
    it('フィールド名が一致する', () => {
      expect(drizzleFields(stepRuns)).toEqual(sharedFields(StepRunSchema));
    });
    it('型レベル: 主要フィールド', () => {
      expectTypeOf<StepRunRow['id']>().toEqualTypeOf<StepRun['id']>();
      expectTypeOf<StepRunRow['attempts']>().toEqualTypeOf<StepRun['attempts']>();
    });
    // 注意: status は DB は text 型 (= string)、shared は enum literal。
    // 型レベルでは乖離するため、rowToStepRun 内の StepRunStatusSchema.parse() で実行時に narrow する。
    // ここでは field 存在のみ確認する。
    it('型レベル: finalScript は nullable', () => {
      expectTypeOf<StepRunRow['finalScript']>().toEqualTypeOf<StepRun['finalScript']>();
    });
  });

  describe('RepairAttempt', () => {
    it('フィールド名が一致する', () => {
      expect(drizzleFields(repairAttempts)).toEqual(sharedFields(RepairAttemptSchema));
    });
    it('型レベル: 主要フィールド', () => {
      expectTypeOf<RepairAttemptRow['id']>().toEqualTypeOf<RepairAttempt['id']>();
      expectTypeOf<RepairAttemptRow['n']>().toEqualTypeOf<RepairAttempt['n']>();
      expectTypeOf<RepairAttemptRow['errorLog']>().toEqualTypeOf<RepairAttempt['errorLog']>();
    });
    // 注意: classification / result は DB は text 型 (= string)、shared は enum literal。
    // 型レベルでは乖離するため、rowToRepairAttempt 内の
    // ErrorClassificationSchema.parse() / RepairResultSchema.parse() で実行時に narrow する。
    // ここでは field 存在のみ確認する。
  });

  describe('ScriptHistory', () => {
    it('フィールド名が一致する', () => {
      expect(drizzleFields(scriptHistories)).toEqual(sharedFields(ScriptHistorySchema));
    });
    it('型レベル: 主要フィールド', () => {
      expectTypeOf<ScriptHistoryRow['id']>().toEqualTypeOf<ScriptHistory['id']>();
      expectTypeOf<ScriptHistoryRow['script']>().toEqualTypeOf<ScriptHistory['script']>();
    });
    // 注意: source は DB は text 型 (= string)、shared は enum literal。
    // 型レベルでは乖離するため、rowToScriptHistory 内の ScriptSourceSchema.parse() で実行時に narrow する。
    // ここでは field 存在のみ確認する。
  });
});
