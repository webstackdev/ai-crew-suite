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
import { jest } from '@jest/globals';
import type {
	AgentEvent,
	EmbeddingDoc,
	RunContext,
	RunRecord,
	RunStore,
	Tool,
	ToolRegistry,
} from '@webstackbuilders/plugin-ai-core-node';

export const createLogger = () => ({
	info: jest.fn(),
	warn: jest.fn(),
	error: jest.fn(),
	debug: jest.fn(),
	child: jest.fn(),
});

export const createAsyncIterable = <T>(items: T[]) =>
	(async function* asyncIterable() {
		for (const item of items) {
			yield item;
		}
	})();

export const collectEvents = async (events: AsyncIterable<AgentEvent>) => {
	const collected: AgentEvent[] = [];
	for await (const event of events) {
		collected.push(event);
	}
	return collected;
};

export const createRunStore = (
	run?: RunRecord,
	overrides: Partial<RunStore> = {},
): RunStore => ({
	createRun: jest.fn(async () => undefined),
	getRun: jest.fn(async () => run),
	findRunByIdempotencyKey: jest.fn(async () => undefined),
	updateRunStatus: jest.fn(async () => undefined),
	appendRunStep: jest.fn(async () => undefined),
	listRunSteps: jest.fn(async () => []),
	createApproval: jest.fn(async () => undefined),
	getPendingApproval: jest.fn(async () => undefined),
	decideApproval: jest.fn(async () => undefined),
	...overrides,
});

export const defaultEmbeddings: EmbeddingDoc[] = [
	{ content: 'owner: platform', metadata: { source: 'catalog' } },
];

export const createRetrievalTool = (output: unknown = defaultEmbeddings): Tool => ({
	id: 'knowledge.retrieve',
	effect: 'read',
	invoke: jest.fn(async () => output),
});

export const createToolRegistry = (tools: Tool[] = []): ToolRegistry => ({
	register: jest.fn(),
	get: jest.fn((id: string) => tools.find(tool => tool.id === id)),
	list: jest.fn(() => tools),
});

export const createLlmService = (chunks: unknown[] = ['hello ', 'world']) => ({
	query: jest.fn(
		async (_embeddings: unknown, _query: string, _options: unknown) =>
			createAsyncIterable(chunks) as any,
	),
});

export const createRunContext = ({
	logger = createLogger(),
	tools,
	systemPrompt = 'Use grounded context',
	identity = 'user:default/alice',
	overrides = {},
}: {
	logger?: ReturnType<typeof createLogger>;
	tools?: Tool[];
	systemPrompt?: string;
	identity?: string;
	overrides?: Partial<RunContext>;
} = {}): RunContext => ({
	logger: logger as any,
	toolRegistry: createToolRegistry(tools ?? [createRetrievalTool()]),
	model: {} as RunContext['model'],
	systemPrompt,
	identity,
	...overrides,
});
