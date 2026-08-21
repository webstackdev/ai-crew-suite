/*
 * Copyright 2026 Webstack Builders, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */
import type { WorkflowContext } from '@webstackbuilders/plugin-ai-core-node'; import type { IncidentCluster,RawSignal } from '../workflow/state';

/** Retrieves capped runbook snippets for the highest-risk incident clusters. */ export class RunbookRetriever {constructor(private readonly context:WorkflowContext,private readonly maxClusters:number){} async retrieve(clusters:IncidentCluster[]):Promise<RawSignal[]>{const signals:RawSignal[]=[];for(const cluster of clusters.slice(0,this.maxClusters)){try{const result=await this.context.invokeTool<{query:string;source:string},{content?:string;metadata?:{url?:string}}[]>({toolId:'knowledge.retrieve',args:{query:`${cluster.title} ${cluster.service??''}`,source:'catalog'},limits:{timeoutMs:10_000}});for(const [index,doc] of (Array.isArray(result.output)?result.output:[]).slice(0,3).entries())signals.push({id:`knowledge:${cluster.id}:${index}`,source:'knowledge',kind:'runbook',summary:doc.content??'Runbook context',service:cluster.service,reference:doc.metadata?.url});}catch{ /* retrieval is optional */ }}return signals;}}
