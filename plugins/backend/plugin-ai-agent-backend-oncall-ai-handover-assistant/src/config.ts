/*
 * Copyright 2026 Webstack Builders, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */
import { Config } from '@backstage/config';
/** Resolved configuration for the on-call handover module. */
export type OncallHandoverConfig = { modelRef: string; windowHours: number; maxWindowHours: number; maxSignalsPerSource: number; maxClusters: number; maxEnrichedClusters: number; maxToolInvocations: number; schedule: { enabled: boolean; shifts: { cron: string; team: string }[] } };
/** Reads required model configuration and applies bounded operational defaults. */
export const readOncallHandoverConfig = (config: Config): OncallHandoverConfig => {
 const section=config.getOptionalConfig('ai.agents.oncallHandover'); if(!section) throw new Error('On-call handover requires ai.agents.oncallHandover configuration to be set');
 const schedule=section.getOptionalConfig('schedule'); const maxWindowHours=section.getOptionalNumber('maxWindowHours') ?? 48;
 return { modelRef: section.getString('model'), windowHours: Math.min(section.getOptionalNumber('windowHours') ?? 12,maxWindowHours), maxWindowHours, maxSignalsPerSource: section.getOptionalNumber('maxSignalsPerSource') ?? 100, maxClusters: section.getOptionalNumber('maxClusters') ?? 25, maxEnrichedClusters: section.getOptionalNumber('maxEnrichedClusters') ?? 5, maxToolInvocations: section.getOptionalNumber('maxToolInvocations') ?? 16, schedule:{enabled:schedule?.getOptionalBoolean('enabled')??false, shifts:schedule?.getOptionalConfigArray('shifts').map(s=>({cron:s.getString('cron'),team:s.getString('team')}))??[]} };
};
