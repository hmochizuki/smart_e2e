import { describe, it, expectTypeOf } from 'vitest';
import type {
  Suite,
  NewSuiteInput,
  Step,
  NewStepInput,
  SuiteRun,
  NewSuiteRunInput,
  StepRun,
  NewStepRunInput,
  RepairAttempt,
  NewRepairAttemptInput,
  ScriptHistory,
  NewScriptHistory,
  RunnerEvent,
} from '../src/index.js';

describe('Suite types', () => {
  it('description は string | null | undefined (nullish)', () => {
    expectTypeOf<Suite['description']>().toEqualTypeOf<string | null | undefined>();
  });

  it('Suite.id は string', () => {
    expectTypeOf<Suite['id']>().toEqualTypeOf<string>();
  });

  it('NewSuiteInput は id / createdAt / updatedAt を含まない', () => {
    expectTypeOf<NewSuiteInput>().not.toHaveProperty('id');
    expectTypeOf<NewSuiteInput>().not.toHaveProperty('createdAt');
    expectTypeOf<NewSuiteInput>().not.toHaveProperty('updatedAt');
    expectTypeOf<NewSuiteInput>().toHaveProperty('name');
  });
});

describe('Step types', () => {
  it('Step は order: number を持つ', () => {
    expectTypeOf<Step['order']>().toEqualTypeOf<number>();
  });

  it('NewStepInput は id を含まない', () => {
    expectTypeOf<NewStepInput>().not.toHaveProperty('id');
  });
});

describe('Run / StepRun types', () => {
  it('SuiteRun.finishedAt は Date | null', () => {
    expectTypeOf<SuiteRun['finishedAt']>().toEqualTypeOf<Date | null>();
  });

  it('SuiteRun.error は string | null | undefined (nullish)', () => {
    expectTypeOf<SuiteRun['error']>().toEqualTypeOf<string | null | undefined>();
  });

  it('StepRun.attempts は number', () => {
    expectTypeOf<StepRun['attempts']>().toEqualTypeOf<number>();
  });

  it('StepRun.finalScript は string | null', () => {
    expectTypeOf<StepRun['finalScript']>().toEqualTypeOf<string | null>();
  });

  it('NewSuiteRunInput は id を含まない', () => {
    expectTypeOf<NewSuiteRunInput>().not.toHaveProperty('id');
    expectTypeOf<NewSuiteRunInput>().toHaveProperty('suiteId');
  });

  it('NewStepRunInput は id を含まない', () => {
    expectTypeOf<NewStepRunInput>().not.toHaveProperty('id');
    expectTypeOf<NewStepRunInput>().toHaveProperty('stepId');
  });
});

describe('RepairAttempt types', () => {
  it('llmOutputScript は string | null', () => {
    expectTypeOf<RepairAttempt['llmOutputScript']>().toEqualTypeOf<string | null>();
  });

  it('classification は 4 種類のリテラル union', () => {
    expectTypeOf<RepairAttempt['classification']>().toEqualTypeOf<
      'transient' | 'precondition' | 'ui_change' | 'incident'
    >();
  });

  it('NewRepairAttemptInput は id を含まない', () => {
    expectTypeOf<NewRepairAttemptInput>().not.toHaveProperty('id');
    expectTypeOf<NewRepairAttemptInput>().toHaveProperty('stepRunId');
  });
});

describe('ScriptHistory types', () => {
  it('source は 3 種類のリテラル union', () => {
    expectTypeOf<ScriptHistory['source']>().toEqualTypeOf<
      'codegen' | 'user_edit' | 'auto_repair'
    >();
  });

  it('NewScriptHistory は id を含まない (refine 経由でも shape ベース)', () => {
    expectTypeOf<NewScriptHistory>().not.toHaveProperty('id');
    expectTypeOf<NewScriptHistory>().toHaveProperty('stepId');
  });
});

describe('RunnerEvent discriminated union', () => {
  it('type で絞れる', () => {
    const ev: RunnerEvent = {
      type: 'suite_started',
      suiteRunId: 'a',
      suiteId: 'b',
      startedAt: new Date(),
    };
    if (ev.type === 'suite_started') {
      expectTypeOf(ev.startedAt).toEqualTypeOf<Date>();
    }
  });

  it('repair_exhausted variant が含まれる', () => {
    const ev: RunnerEvent = {
      type: 'repair_exhausted',
      stepRunId: 'a',
      attempts: 3,
      classification: 'ui_change',
      finalErrorLog: 'x',
    };
    if (ev.type === 'repair_exhausted') {
      expectTypeOf(ev.attempts).toEqualTypeOf<number>();
    }
  });
});
