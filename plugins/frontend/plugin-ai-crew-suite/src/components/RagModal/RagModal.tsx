/*
 * Copyright 2024 Larder Software Limited
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
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  makeStyles,
  Typography,
} from '@material-ui/core';
import { useHotkeys } from 'react-hotkeys-hook';
import CloseIcon from '@material-ui/icons/Close';
import { QuestionBox } from './QuestionBox';
import { ResultRenderer } from './ResultRenderer';
import { EmbeddingsView } from './EmbeddingsView';
import Dialog from '@material-ui/core/Dialog';
import { ragAiApiRef } from '../../api';
import { useApi } from '@backstage/core-plugin-api';
import { AiAgentSummary, AiRunEvent, ResponseEmbedding } from '../../@types';
import { Thinking } from './Thinking';
import { WarningPanel } from '@backstage/core-components';

export type RagModalProps = {
  title?: string;
  hotkey?: string;
};

type ControlledRagModalProps = RagModalProps & {
  open: boolean;
  setOpen: (value: boolean) => void;
};

type UncontrolledRagModalProps = RagModalProps;

const useStyles = makeStyles(theme => ({
  dialogTitle: {
    gap: theme.spacing(1),
    display: 'grid',
    alignItems: 'center',
    gridTemplateColumns: '1fr auto',
    '&> button': {
      marginTop: theme.spacing(1),
    },
  },
  filter: {
    '& + &': {
      marginTop: theme.spacing(2.5),
    },
  },
  filters: {
    padding: theme.spacing(2),
    marginTop: theme.spacing(2),
  },
  input: {
    flex: 1,
  },
  closeButton: {
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
    color: theme.palette.grey[500],
  },
  dialogActionsContainer: { padding: theme.spacing(1, 3) },
  viewResultsLink: { verticalAlign: '0.5em' },
}));

export const ControlledRagModal = ({
  title = 'AI Assistant',
  hotkey = 'ctrl+comma',
  open,
  setOpen,
}: ControlledRagModalProps) => {
  const classes = useStyles();
  const [thinking, setThinking] = useState(false);
  const [questionResult, setQuestionResult] = useState('');
  const [embeddings, setEmbeddings] = useState<ResponseEmbedding[]>([]);
  const [warning, setWarning] = useState<string | undefined>();
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [agents, setAgents] = useState<AiAgentSummary[]>([]);
  const [timeline, setTimeline] = useState<string[]>([]);
  const [artifacts, setArtifacts] = useState<{ kind: string; url?: string; ref?: string }[]>(
    [],
  );
  const [activeRunId, setActiveRunId] = useState<string | undefined>();
  const [pendingApproval, setPendingApproval] = useState<
    | {
        runId: string;
        approvalId: string;
        reason: string;
      }
    | undefined
  >();
  const ragApi = useApi(ragAiApiRef);

  const selectedAgentId = useMemo(() => agents[0]?.id, [agents]);

  useEffect(() => {
    let mounted = true;
    ragApi
      .listAgents()
      .then(response => {
        if (mounted) {
          setAgents(response);
        }
      })
      .catch(() => {
        if (mounted) {
          setWarning('Failed to load agents');
        }
      });

    return () => {
      mounted = false;
    };
  }, [ragApi]);

  const consumeEvents = useCallback(
    async (events: AsyncGenerator<AiRunEvent>) => {
      for await (const chunk of events) {
        setActiveRunId(chunk.data.runId);
        switch (chunk.type) {
          case 'token': {
            setQuestionResult(value => value + chunk.data.text);
            break;
          }
          case 'tool_result': {
            setTimeline(value => [
              ...value,
              `${chunk.data.tool}: ${chunk.data.ok ? 'ok' : 'failed'}`,
            ]);
            if (chunk.data.tool === 'knowledge.retrieve' && chunk.data.ok) {
              const payload = chunk.data.output as
                | { embeddings?: ResponseEmbedding[] }
                | undefined;
              if (payload?.embeddings) {
                setEmbeddings(payload.embeddings);
              }
            }
            break;
          }
          case 'step': {
            setTimeline(value => [
              ...value,
              `${chunk.data.node}: ${chunk.data.phase}`,
            ]);
            break;
          }
          case 'tool_call': {
            setTimeline(value => [...value, `calling ${chunk.data.tool}`]);
            break;
          }
          case 'approval_request': {
            setPendingApproval({
              runId: chunk.data.runId,
              approvalId: chunk.data.approvalId,
              reason: chunk.data.reason,
            });
            setWarning(chunk.data.reason);
            break;
          }
          case 'artifact': {
            setArtifacts(value => [
              ...value,
              {
                kind: chunk.data.kind,
                ref: chunk.data.ref,
                url: chunk.data.url,
              },
            ]);
            break;
          }
          case 'error': {
            setWarning(chunk.data.message);
            break;
          }
          case 'done': {
            setPendingApproval(undefined);
            if (chunk.data.sessionId) {
              setSessionId(chunk.data.sessionId);
            }
            break;
          }
          case 'usage': {
            setTimeline(value => [
              ...value,
              `usage total tokens: ${chunk.data.total}`,
            ]);
            break;
          }
          default: {
            const exhaustiveCheck: never = chunk;
            throw new Error(`Unknown event type: ${JSON.stringify(exhaustiveCheck)}`);
          }
        }
      }
    },
    [setActiveRunId],
  );

  const askLlm = useCallback(
    async (question: string, source: string, agentId: string) => {
      setThinking(true);
      setQuestionResult('');
      setWarning(undefined);
      setEmbeddings([]);
      setArtifacts([]);
      setTimeline([]);
      setPendingApproval(undefined);

      await consumeEvents(
        ragApi.startRun(
          agentId,
          {
            query: question,
            source,
          },
          {
            sessionId,
          },
        ),
      );

      setThinking(false);
    },
    [consumeEvents, ragApi, sessionId],
  );

  const decideApproval = useCallback(
    async (status: 'approved' | 'rejected') => {
      if (!pendingApproval) {
        return;
      }

      setThinking(true);
      setWarning(undefined);
      await consumeEvents(
        ragApi.approveRun(pendingApproval.runId, {
          status,
        }),
      );
      setThinking(false);
    },
    [consumeEvents, pendingApproval, ragApi],
  );

  useHotkeys(hotkey, () => setOpen(true), []);
  return (
    <Dialog
      open={open}
      onClose={() => {
        setOpen(false);
        setThinking(false);
        setQuestionResult('');
        setEmbeddings([]);
        setArtifacts([]);
        setTimeline([]);
        setPendingApproval(undefined);
        setActiveRunId(undefined);
        setSessionId(undefined);
      }}
      fullWidth
      maxWidth="lg"
    >
      <DialogTitle>
        <Typography variant="h6">{title}</Typography>
        <IconButton
          aria-label="close"
          className={classes.closeButton}
          onClick={() => setOpen(false)}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Box className={classes.dialogTitle}>
          <QuestionBox
            onSubmit={askLlm}
            fullWidth
            agents={agents}
            selectedAgentId={selectedAgentId}
            onClear={() => {
              setQuestionResult('');
              setEmbeddings([]);
              setArtifacts([]);
              setTimeline([]);
              setPendingApproval(undefined);
              setSessionId(undefined);
            }}
          />
        </Box>
        {warning && <WarningPanel severity="warning" message={warning} />}
        {pendingApproval && (
          <Box pt={2}>
            <Typography variant="subtitle2">
              Approval needed ({pendingApproval.approvalId}): {pendingApproval.reason}
            </Typography>
            <Box pt={1} display="flex" style={{ gap: 8 }}>
              <Button variant="contained" color="primary" onClick={() => decideApproval('approved')}>
                Approve
              </Button>
              <Button variant="contained" onClick={() => decideApproval('rejected')}>
                Reject
              </Button>
            </Box>
          </Box>
        )}
        {timeline.length > 0 && (
          <Box pt={2}>
            <Typography variant="h6">Run Timeline</Typography>
            {activeRunId && <Typography variant="caption">Run: {activeRunId}</Typography>}
            <Box component="ul" pl={3}>
              {timeline.map((entry, index) => (
                <li key={`${index}-${entry}`}>
                  <Typography variant="body2">{entry}</Typography>
                </li>
              ))}
            </Box>
          </Box>
        )}
        {artifacts.length > 0 && (
          <Box pt={2}>
            <Typography variant="h6">Artifacts</Typography>
            <Box component="ul" pl={3}>
              {artifacts.map((artifact, index) => (
                <li key={`${artifact.kind}-${index}`}>
                  {artifact.url ? (
                    <a href={artifact.url} target="_blank" rel="noreferrer">
                      {artifact.kind}
                    </a>
                  ) : (
                    <Typography variant="body2">{artifact.kind}</Typography>
                  )}
                </li>
              ))}
            </Box>
          </Box>
        )}
        {thinking && !questionResult && !warning ? (
          <Box p={6} display="flex" justifyContent="center" alignItems="center">
            <Thinking />
          </Box>
        ) : (
          <>
            <Box py={3}>
              <Grid container>
                {questionResult && (
                  <Grid item xs={12}>
                    <Typography variant="h6">Response</Typography>
                  </Grid>
                )}
                <Grid item xs={12}>
                  <ResultRenderer result={questionResult} />
                </Grid>
              </Grid>
            </Box>
            <Box py={3}>
              <Grid container>
                {embeddings && embeddings.length > 0 && (
                  <Grid item xs={12}>
                    <Typography variant="h6">Additional Information</Typography>
                  </Grid>
                )}
                <Grid item xs={12}>
                  <EmbeddingsView embeddings={embeddings} />
                </Grid>
              </Grid>
            </Box>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export const UncontrolledRagModal = (props: UncontrolledRagModalProps) => {
  const [open, setOpen] = useState(false);

  return <ControlledRagModal open={open} setOpen={setOpen} {...props} />;
};
