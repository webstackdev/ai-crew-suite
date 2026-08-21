/*
 * Copyright 2026 Webstack Builders, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */
import type { AuthService,DiscoveryService,LoggerService,SchedulerService } from '@backstage/backend-plugin-api'; import { ONCALL_HANDOVER_AGENT_ID } from '../agent'; import { planShiftSchedule } from './schedulePlanner';

/** Registers persisted, authenticated dispatches for each configured shift boundary. */ export const registerShiftSchedule=(deps:{scheduler:SchedulerService;discovery:DiscoveryService;auth:AuthService;logger:LoggerService;config:{windowHours:number;schedule:{shifts:{cron:string;team:string}[]}}}):void=>{for(const plan of planShiftSchedule({shifts:deps.config.schedule.shifts,windowHours:deps.config.windowHours})){let inFlight=false;deps.scheduler.scheduleTask({id:plan.id,frequency:{cron:plan.cron},timeout:{minutes:10},initialDelay:{minutes:1},scope:'global',fn:async()=>{if(inFlight)return;inFlight=true;try{const base=await deps.discovery.getBaseUrl('ai-core');const {token}=await deps.auth.getPluginRequestToken({onBehalfOf:await deps.auth.getOwnServiceCredentials(),targetPluginId:'ai-core'});const response=await fetch(`${base}/agents/${ONCALL_HANDOVER_AGENT_ID}/runs`,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify({query:JSON.stringify(plan.request)})});if(!response.ok)deps.logger.warn('Handover shift dispatch was rejected',{status:response.status,team:plan.request.team});}catch(error){deps.logger.error('Handover shift dispatch failed',{error:error instanceof Error?error.message:String(error)})}finally{inFlight=false}}})}};
