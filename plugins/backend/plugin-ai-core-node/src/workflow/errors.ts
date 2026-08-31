/*
 * Copyright 2026 Webstack Builders, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { ErrorCode } from '../events/agentEvent';

/**
 * Thrown by workflow nodes to signal a classified failure. The engine maps this to a
 * structured `error` AgentEvent with the node name attached. Unknown exceptions map
 * to `unknown` and never leak payloads into events.
 */
export class NodeError extends Error {
  constructor(
    message: string,
    readonly code: ErrorCode,
    readonly retryable = false,
  ) {
    super(message);
    this.name = 'NodeError';
  }
}

/**
 * Thrown by nodes for failures the engine may safely retry (e.g. flaky tool/network).
 */
export class RetryableNodeError extends NodeError {
  constructor(message: string, code: ErrorCode = 'tool_failed') {
    super(message, code, true);
    this.name = 'RetryableNodeError';
  }
}
