import type {
  ToolInvocationResult,
  WorkflowContext,
} from '@webstackbuilders/plugin-ai-core-node';

export type InvestigationToolRunnerOptions = {
  /** Hard cap on tool invocations for a single investigation run. */
  maxInvocations: number;
  /** Per-invocation timeout forwarded to the AI Core tool executor. */
  timeoutMs: number;
};

/**
 * Bounded, failure-tolerant facade over the AI Core `ToolExecutor`.
 *
 * AI Core centrally enforces the agent tool allow-list, identity propagation,
 * and auditing. This runner adds the responder's own evidence-collection
 * policy: a per-run invocation budget and graceful degradation, so a single
 * failing diagnostic tool produces a report limitation instead of aborting
 * the investigation.
 */
export class InvestigationToolRunner {
  private invocations = 0;
  private readonly failures: string[] = [];

  constructor(
    private readonly context: WorkflowContext,
    private readonly options: InvestigationToolRunnerOptions,
  ) {}

  /** Number of tool invocations attempted so far. */
  get invocationCount(): number {
    return this.invocations;
  }

  /** Human-readable limitation entries for failed or skipped tool calls. */
  get limitations(): string[] {
    return [...this.failures];
  }

  /**
   * Invokes an allow-listed tool. Returns `undefined` when the call failed or
   * the invocation budget was exhausted; the reason is recorded as a
   * limitation for the final report.
   */
  async invoke<TArgs, TResult>(
    toolId: string,
    args: TArgs,
  ): Promise<ToolInvocationResult<TResult> | undefined> {
    if (this.invocations >= this.options.maxInvocations) {
      this.failures.push(
        `Tool '${toolId}' was skipped: investigation tool budget of ${this.options.maxInvocations} invocations exhausted.`,
      );
      return undefined;
    }
    this.invocations += 1;
    try {
      return await this.context.invokeTool<TArgs, TResult>({
        toolId,
        args,
        limits: { timeoutMs: this.options.timeoutMs },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.failures.push(`Tool '${toolId}' failed: ${message}`);
      this.context.logger.warn(`Investigation tool '${toolId}' failed`, {
        error: message,
      });
      return undefined;
    }
  }
}
