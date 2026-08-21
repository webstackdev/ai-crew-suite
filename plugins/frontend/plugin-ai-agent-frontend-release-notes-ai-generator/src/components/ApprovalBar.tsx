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
import React, { useState } from 'react';
import { Button, Paper, TextField, Typography } from '@material-ui/core';
import type { ApprovalDecision } from '../@types';

/**
 * Future publish approval control, rendered only when AI Core emits an approval request.
 * Collects structural verification notes and lets reviewers approve or reject automated publishing.
 *
 * @param props - Core presentation elements and action event triggers.
 * @param props.reason - Context description detailing why human verification is required.
 * @param props.onDecide - Evaluation callback forwarding the decision payload back to the stream engine.
 */
export const ApprovalBar = ({
  reason,
  onDecide,
}: {
  reason: string;
  onDecide: (decision: ApprovalDecision) => void;
}) => {
  const [note, setNote] = useState('');

  return (
    <Paper role="region" aria-label="Publication approval">
      <Typography>{reason}</Typography>

      <TextField
        label="Approval note (optional)"
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />

      <Button
        color="primary"
        onClick={() => onDecide({ status: 'approved', note: note || undefined })}
      >
        Approve publication
      </Button>

      <Button onClick={() => onDecide({ status: 'rejected', note: note || undefined })}>
        Reject publication
      </Button>
    </Paper>
  );
};
