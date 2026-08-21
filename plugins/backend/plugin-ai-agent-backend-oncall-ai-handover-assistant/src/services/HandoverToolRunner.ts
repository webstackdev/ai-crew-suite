/*
 * Copyright 2026 Webstack Builders, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */
import type { ToolInvocationResult, WorkflowContext } from '@webstackbuilders/plugin-ai-core-node';
/** Bounded and failure-tolerant facade for read-only handover tool calls. */
export class HandoverToolRunner { private calls=0; private readonly failures:string[]=[]; constructor(private readonly context:WorkflowContext,private readonly options:{maxInvocations:number;timeoutMs?:number}){} get limitations(){return [...this.failures]}; async invoke<TArgs,TResult>(toolId:string,args:TArgs):Promise<ToolInvocationResult<TResult>|undefined>{if(this.calls>=this.options.maxInvocations){this.failures.push(`Tool '${toolId}' was skipped: handover tool budget exhausted.`);return undefined}this.calls++;try{return await this.context.invokeTool<TArgs,TResult>({toolId,args,limits:{timeoutMs:this.options.timeoutMs??10_000}})}catch(error){const message=error instanceof Error?error.message:String(error);this.failures.push(`Tool '${toolId}' failed: ${message}`);this.context.logger.warn(`Handover tool '${toolId}' failed`,{error:message});return undefined}}}
