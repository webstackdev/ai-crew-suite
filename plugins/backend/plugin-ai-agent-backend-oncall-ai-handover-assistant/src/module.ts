/*
 * Copyright 2026 Webstack Builders, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */
import { coreServices,createBackendModule } from '@backstage/backend-plugin-api'; import { agentExtensionPoint,triggerExtensionPoint,workflowRunnerExtensionPoint } from '@webstackbuilders/plugin-ai-core-node'; import { createOncallHandoverAgent } from './agent'; import { readOncallHandoverConfig } from './config'; import { HandoverGraph } from './workflow/HandoverGraph'; import { registerShiftSchedule } from './scheduler/shiftSchedule';

/** Registers the on-call handover workflow, agent triggers, and optional shift scheduler. */ export const oncallHandoverModule=createBackendModule({pluginId:'ai-core',moduleId:'agent-oncall-handover-assistant',register(env){env.registerInit({deps:{config:coreServices.rootConfig,logger:coreServices.logger,scheduler:coreServices.scheduler,discovery:coreServices.discovery,auth:coreServices.auth,agents:agentExtensionPoint,triggers:triggerExtensionPoint,workflows:workflowRunnerExtensionPoint},async init({config,logger,scheduler,discovery,auth,agents,triggers,workflows}){const resolved=readOncallHandoverConfig(config);workflows.registerRunner(new HandoverGraph(resolved));const agent=createOncallHandoverAgent(resolved);agents.addAgent(agent);for(const trigger of agent.triggers??[])triggers.addTrigger(trigger);if(resolved.schedule.enabled)registerShiftSchedule({scheduler,discovery,auth,logger,config:resolved});logger.info('Registered on-call handover workflow')}})}});export default oncallHandoverModule;
