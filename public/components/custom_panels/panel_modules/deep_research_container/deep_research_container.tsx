/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useEffect, useMemo, useState } from 'react';
import MarkdownRender from '@nteract/markdown';
import {
  EuiButton,
  EuiLoadingContent,
  EuiText,
  EuiAccordion,
  EuiSpacer,
  EuiTitle,
} from '@elastic/eui';

import { CoreStart } from '../../../../../../../src/core/public';
import { ParaType } from '../../../../../common/types/notebooks';

import {
  getMLCommonsTask,
  getMLCommonsMemoryMessages,
  getMLCommonsMemory,
  getMLCommonsSingleMemory,
} from './apis';
import { getAllTracesByMessageId } from './utils';
import { MessageTraceModal } from './message_trace_modal';

const getGuessExecutorMemoryId = async ({
  http,
  dataSourceId,
  memoryId,
  signal,
}: {
  http: CoreStart['http'];
  memoryId: string;
  dataSourceId?: string;
  signal?: AbortSignal;
}) => {
  const memory = await getMLCommonsSingleMemory({
    http,
    dataSourceId,
    memoryId,
    signal,
  });
  const result = await getMLCommonsMemory({
    http,
    dataSourceId,
    query: {
      bool: {
        filter: [
          {
            range: {
              create_time: {
                gt: memory.create_time,
              },
            },
          },
        ],
      },
    },
    size: 1,
    signal,
  });
  return result?.hits?.hits[0]?._id;
};

interface Props {
  http: CoreStart['http'];
  para: ParaType;
}

export const DeepResearchContainer = ({ para, http }: Props) => {
  const [traces, setTraces] = useState([]);
  const [task, setTask] = useState();
  const [isLoading, setIsLoading] = useState(false);
  const [tracesVisible, setTracesVisible] = useState(false);
  const [executorMessages, setExecutorMessages] = useState();
  const [loadingExecutorMessages, setIsLoadingExecutorMessages] = useState(false);
  const [messageIdForTraceModal, setMessageIdForTraceModal] = useState<string>();
  const [guessExecutorMemoryId, setGuessExecutorMemoryId] = useState<string>();

  const paragraphResult = useMemo(() => {
    if (para.out[0]) {
      try {
        return JSON.parse(para.out[0]);
      } catch (e) {
        console.error('Error when parse para out', e);
      }
    }
  }, [para.out[0]]);

  const finalMessage = useMemo(() => {
    if (!task) {
      return '';
    }
    if (task.state === 'COMPLETED') {
      const inferenceResult = task.response.inference_results[0];
      if (inferenceResult) {
        return inferenceResult.output.find(({ name }) => name === 'response').dataAsMap.response;
      }
      return 'Task was completed, but failed to load inference result.';
    }

    if (task.state === 'FAILED') {
      return `Failed to execute task, reason: ${task.response.error_message}`.trim();
    }
    return '';
  }, [task]);

  const executorMemoryId = useMemo(() => {
    const inferenceResult = task?.response?.inference_results?.[0];
    if (!inferenceResult) {
      return;
    }
    return inferenceResult.output.find(({ name }) => name === 'executor_agent_memory_id').result;
  }, [task]);

  useEffect(() => {
    if (!paragraphResult) {
      return;
    }
    const {
      task_id: taskId,
      memory_id: directMemoryId,
      response: { memory_id: responseMemoryId },
    } = paragraphResult;
    const memoryId = directMemoryId || responseMemoryId;
    let canceled = false;
    let messageId: string | undefined;
    const abortController = new AbortController();

    const loadTraces = async () => {
      if (!messageId) {
        return;
      }
      const loadedTraces = await getAllTracesByMessageId({
        http,
        messageId,
        signal: abortController.signal,
        dataSourceId: para.dataSourceMDSId,
      });
      if (!canceled) {
        setTraces(loadedTraces);
      }
    };

    const fetchTraceAndFinalResponse = async () => {
      const loadedTask = await getMLCommonsTask({
        http,
        taskId,
        signal: abortController.signal,
        dataSourceId: para.dataSourceMDSId,
      });
      if (canceled) {
        return;
      }
      if (loadedTask.state === 'COMPLETED') {
        setTask(loadedTask);
        await loadTraces();
        setIsLoading(false);
        setTracesVisible(false);
        return;
      }
      if (loadedTask.state === 'FAILED') {
        setTask(loadedTask);
        await loadTraces();
        setIsLoading(false);
        setTracesVisible(false);
        return;
      }
      if (!messageId) {
        const memoryMessages = await getMLCommonsMemoryMessages({
          http,
          memoryId,
          signal: abortController.signal,
          dataSourceId: para.dataSourceMDSId,
        });
        if (memoryMessages[0]) {
          messageId = memoryMessages[0].message_id;
          setTracesVisible(true);
        }
      }

      await loadTraces();

      await new Promise((resolve) => {
        setTimeout(resolve, 5000);
      });
      if (canceled) {
        return;
      }
      fetchTraceAndFinalResponse();
    };

    fetchTraceAndFinalResponse();
    setIsLoading(true);
    return () => {
      abortController.abort();
      canceled = true;
    };
  }, [paragraphResult, http, para.dataSourceMDSId]);

  const renderTraces = () => {
    return traces.map(({ input, response, message_id: messageId }, index) => (
      <React.Fragment key={messageId}>
        <EuiAccordion
          id={`trace-${index}`}
          buttonContent={`Step ${index + 1} - ${input}`}
          paddingSize="l"
        >
          <EuiText className="wrapAll markdown-output-text" size="s">
            <MarkdownRender source={response} />
          </EuiText>
          {(guessExecutorMemoryId || executorMemoryId) && (
            <EuiButton
              isLoading={loadingExecutorMessages}
              disabled={loadingExecutorMessages}
              onClick={async () => {
                let messages = executorMessages;
                if (!messages || messages.length < traces.length) {
                  setIsLoadingExecutorMessages(true);
                  try {
                    messages = await getMLCommonsMemoryMessages({
                      http,
                      memoryId: executorMemoryId || guessExecutorMemoryId,
                      dataSourceId: para.dataSourceMDSId,
                    });
                    setExecutorMessages(messages);
                  } finally {
                    setIsLoadingExecutorMessages(false);
                  }
                }
                if (messages && messages[index]?.message_id) {
                  setMessageIdForTraceModal(messages[index].message_id);
                }
              }}
            >
              Explain this step
            </EuiButton>
          )}
        </EuiAccordion>
        <EuiSpacer />
      </React.Fragment>
    ));
  };

  const atLeastOneTraceGenerated = traces.length > 0;

  useEffect(() => {
    if (!paragraphResult || !tracesVisible || !atLeastOneTraceGenerated) {
      return;
    }
    let canceled = false;
    const {
      memory_id: directMemoryId,
      response: { memory_id: responseMemoryId },
    } = paragraphResult;
    const memoryId = directMemoryId || responseMemoryId;
    const abortController = new AbortController();

    getGuessExecutorMemoryId({
      http,
      dataSourceId: para.dataSourceMDSId,
      memoryId,
      signal: abortController.signal,
    }).then((id) => {
      if (!canceled) {
        setGuessExecutorMemoryId(id);
      }
    });
    return () => {
      canceled = true;
      abortController.abort();
    };
  }, [http, para.dataSourceMDSId, paragraphResult, tracesVisible, atLeastOneTraceGenerated]);

  return (
    <div>
      {tracesVisible && renderTraces()}
      {finalMessage && (
        <>
          <EuiTitle>
            <h3>Final response</h3>
          </EuiTitle>
          <EuiText className="wrapAll markdown-output-text" size="s">
            <MarkdownRender source={finalMessage} />
          </EuiText>
          <EuiSpacer />
        </>
      )}
      {isLoading ? (
        <EuiLoadingContent />
      ) : (
        <EuiButton
          onClick={async () => {
            if (!paragraphResult) {
              return;
            }
            if (traces.length === 0) {
              const memoryMessages = await getMLCommonsMemoryMessages({
                http,
                memoryId: paragraphResult.memory_id || paragraphResult.response?.memory_id,
                dataSourceId: para.dataSourceMDSId,
              });
              const messageId = memoryMessages[0].message_id;
              setTraces(
                await getAllTracesByMessageId({
                  http,
                  messageId,
                  dataSourceId: para.dataSourceMDSId,
                })
              );
            }

            setTracesVisible((flag) => !flag);
          }}
        >
          {tracesVisible ? 'Hide traces' : 'Show traces'}
        </EuiButton>
      )}
      {messageIdForTraceModal && (
        <MessageTraceModal
          messageId={messageIdForTraceModal}
          http={http}
          closeModal={() => {
            setMessageIdForTraceModal(undefined);
          }}
          dataSourceId={para.dataSourceMDSId}
        />
      )}
    </div>
  );
};
