/*
 * Copyright 2026 Webstack Builders, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */
import type { HandoverRequest } from '../workflow/state';

/** One authenticated run to dispatch at a configured shift boundary. */ export type ShiftDispatchPlan={id:string;cron:string;request:HandoverRequest};
/** Creates deterministic bounded requests for each configured shift. */ export const planShiftSchedule=(input:{shifts:{cron:string;team:string}[];windowHours:number}):ShiftDispatchPlan[]=>input.shifts.map(shift=>({id:`oncall-handover-shift-${shift.cron.replace(/\s+/g,'-')}`,cron:shift.cron,request:{version:1,source:'scheduler',windowHours:input.windowHours,team:shift.team}}));
