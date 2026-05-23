// runner 内で発生し得るドメインエラー。
// Node の Error.cause を活用しつつ、識別用に name と code を持つ。

type ErrorOptions = { cause?: unknown };

class RunnerError extends Error {
  public readonly code: string;
  public override readonly cause?: unknown;

  public constructor(code: string, message: string, options?: ErrorOptions) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    if (options !== undefined && 'cause' in options) {
      this.cause = options.cause;
    }
  }
}

export class RepairLimitExceededError extends RunnerError {
  public readonly attempts: number;

  public constructor(attempts: number, options?: ErrorOptions) {
    super(
      'RUNNER_REPAIR_LIMIT_EXCEEDED',
      `Repair attempts exceeded the configured limit (attempts=${String(attempts)})`,
      options,
    );
    this.attempts = attempts;
  }
}

export class IncidentDetectedError extends RunnerError {
  public readonly rationale: string;

  public constructor(rationale: string, options?: ErrorOptions) {
    super('RUNNER_INCIDENT_DETECTED', `Incident detected by classifier: ${rationale}`, options);
    this.rationale = rationale;
  }
}

export class LLMResponseInvalidError extends RunnerError {
  public readonly raw: string;

  public constructor(raw: string, options?: ErrorOptions) {
    super('RUNNER_LLM_RESPONSE_INVALID', 'LLM response did not match the expected schema', options);
    this.raw = raw;
  }
}

// LLM 呼び出しそのものが例外を投げた (ネットワーク・認証・SDKエラー等)。
// 「レスポンスが返ったがパースできない」LLMResponseInvalidError とは区別。
// cause に SDK の例外が入る。
export class LLMInvocationError extends RunnerError {
  public constructor(message: string, options?: ErrorOptions) {
    super('RUNNER_LLM_INVOCATION', message, options);
  }
}

export class StepRunInvocationError extends RunnerError {
  public constructor(message: string, options?: ErrorOptions) {
    super('RUNNER_STEP_INVOCATION', message, options);
  }
}

export class ConfigError extends RunnerError {
  public constructor(message: string, options?: ErrorOptions) {
    super('RUNNER_CONFIG_INVALID', message, options);
  }
}

export { RunnerError };
