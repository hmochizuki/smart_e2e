import { describe, expectTypeOf, it } from 'vitest';
import type {
  RunnerPersistence as RunnerSpec,
  CreateSuiteRunInput as RunnerCreateSuiteRunInput,
  UpdateSuiteRunPatch as RunnerUpdateSuiteRunPatch,
  CreateStepRunInput as RunnerCreateStepRunInput,
  UpdateStepRunPatch as RunnerUpdateStepRunPatch,
  CreateRepairAttemptInput as RunnerCreateRepairAttemptInput,
  SaveScriptHistoryInput as RunnerSaveScriptHistoryInput,
  SuiteRunId as RunnerSuiteRunId,
  StepRunId as RunnerStepRunId,
  RepairAttemptId as RunnerRepairAttemptId,
} from '@smart-e2e/runner';
import type {
  RunnerPersistence as LocalSpec,
  CreateSuiteRunInput as LocalCreateSuiteRunInput,
  UpdateSuiteRunPatch as LocalUpdateSuiteRunPatch,
  CreateStepRunInput as LocalCreateStepRunInput,
  UpdateStepRunPatch as LocalUpdateStepRunPatch,
  CreateRepairAttemptInput as LocalCreateRepairAttemptInput,
  SaveScriptHistoryInput as LocalSaveScriptHistoryInput,
  SuiteRunId as LocalSuiteRunId,
  StepRunId as LocalStepRunId,
  RepairAttemptId as LocalRepairAttemptId,
} from '../src/repositories/runnerPersistence.js';
import { DrizzleRunnerPersistence } from '../src/repositories/runnerPersistence.js';

describe('runner <-> persistence: RunnerPersistence 型互換', () => {
  it('ID エイリアスが完全一致', () => {
    expectTypeOf<LocalSuiteRunId>().toEqualTypeOf<RunnerSuiteRunId>();
    expectTypeOf<LocalStepRunId>().toEqualTypeOf<RunnerStepRunId>();
    expectTypeOf<LocalRepairAttemptId>().toEqualTypeOf<RunnerRepairAttemptId>();
  });

  it('入力型が完全一致', () => {
    expectTypeOf<LocalCreateSuiteRunInput>().toEqualTypeOf<RunnerCreateSuiteRunInput>();
    expectTypeOf<LocalUpdateSuiteRunPatch>().toEqualTypeOf<RunnerUpdateSuiteRunPatch>();
    expectTypeOf<LocalCreateStepRunInput>().toEqualTypeOf<RunnerCreateStepRunInput>();
    expectTypeOf<LocalUpdateStepRunPatch>().toEqualTypeOf<RunnerUpdateStepRunPatch>();
    expectTypeOf<LocalCreateRepairAttemptInput>().toEqualTypeOf<RunnerCreateRepairAttemptInput>();
    expectTypeOf<LocalSaveScriptHistoryInput>().toEqualTypeOf<RunnerSaveScriptHistoryInput>();
  });

  it('RunnerPersistence interface 全体が一致', () => {
    expectTypeOf<LocalSpec>().toEqualTypeOf<RunnerSpec>();
  });

  it('DrizzleRunnerPersistence は runner の RunnerPersistence に assignable', () => {
    expectTypeOf<DrizzleRunnerPersistence>().toMatchTypeOf<RunnerSpec>();
  });
});
