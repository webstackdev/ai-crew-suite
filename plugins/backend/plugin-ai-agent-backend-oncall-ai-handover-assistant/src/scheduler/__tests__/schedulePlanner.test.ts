/*
 * Copyright 2026 Webstack Builders, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */
import { describe,expect,it } from 'vitest'; import { planShiftSchedule } from '../schedulePlanner';

describe('planShiftSchedule',()=>it('creates one bounded scheduler request for each shift',()=>{expect(planShiftSchedule({windowHours:12,shifts:[{cron:'0 8 * * *',team:'sre-primary'},{cron:'0 16 * * *',team:'sre-primary'}]})).toEqual([{id:'oncall-handover-shift-0-8-*-*-*',cron:'0 8 * * *',request:{version:1,source:'scheduler',windowHours:12,team:'sre-primary'}},{id:'oncall-handover-shift-0-16-*-*-*',cron:'0 16 * * *',request:{version:1,source:'scheduler',windowHours:12,team:'sre-primary'}}])}));
