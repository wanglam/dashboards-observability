/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import MarkdownRender from '@nteract/markdown';
import { EuiButton, EuiLoadingContent, EuiText, EuiAccordion, EuiSpacer } from '@elastic/eui';

import { CoreStart } from '../../../../../../../src/core/public';
import { ParaType } from '../../../../../common/types/notebooks';

import {
  getMLCommonsTask,
  getMLCommonsMemoryMessages,
  getMLCommonsMemory,
  getMLCommonsSingleMemory,
} from './apis';
import { getAllMessagesByMemoryId, getAllTracesByMessageId, isMarkdownText } from './utils';
import { MessageTraceModal } from './message_trace_modal';

// TODO: Remove this in production
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

const getAllExecutorMessages = ({
  http,
  signal,
  dataSourceId,
  planMemoryId,
  executorMemoryId,
}: {
  planMemoryId: string;
  executorMemoryId?: string;
  http: CoreStart['http'];
  signal?: AbortSignal;
  dataSourceId?: string;
}) =>
  (executorMemoryId
    ? Promise.resolve(executorMemoryId)
    : getGuessExecutorMemoryId({
        http,
        memoryId: planMemoryId,
        dataSourceId,
        signal,
      })
  ).then((requestMemoryId) =>
    getAllMessagesByMemoryId({
      http,
      memoryId: requestMemoryId,
      dataSourceId,
      signal,
    })
  );

interface Props {
  http: CoreStart['http'];
  para: ParaType;
}

export const DeepResearchContainer = ({ para, http }: Props) => {
  const [traces, setTraces] = useState([]);
  const [task, setTask] = useState();
  const [isLoading, setIsLoading] = useState(false);
  const [tracesVisible, setTracesVisible] = useState(false);
  const [executorMessages, setExecutorMessages] = useState([]);
  const [loadingSteps, setLoadingSteps] = useState(false);
  const [traceModalData, setTraceModalData] = useState<{
    messageId: string;
    refresh: boolean;
  }>();
  const initialFinalResponseVisible = useRef(false);

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
    if (task?.response?.executor_agent_memory_id) {
      return task.response.executor_agent_memory_id;
    }
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
      const taskCompletedOrFailed =
        loadedTask.state === 'COMPLETED' || loadedTask.state === 'FAILED';

      // Message id exist means task at least pull once, should show final response for this case.
      if (taskCompletedOrFailed && messageId) {
        initialFinalResponseVisible.current = true;
      }

      setTask((prevTask) => (prevTask?.state !== loadedTask.state ? loadedTask : prevTask));
      if (taskCompletedOrFailed) {
        setTraces([]);
        setExecutorMessages([]);
        setIsLoading(false);
        setTracesVisible(false);
        return;
      }
      if (!messageId) {
        const memoryMessages = (
          await getMLCommonsMemoryMessages({
            http,
            memoryId,
            signal: abortController.signal,
            dataSourceId: para.dataSourceMDSId,
          })
        ).messages;
        if (memoryMessages[0]) {
          messageId = memoryMessages[0].message_id;
          setTracesVisible(true);
        }
      }

      await Promise.allSettled([
        loadTraces(),
        getAllExecutorMessages({
          http,
          dataSourceId: para.dataSourceMDSId,
          planMemoryId: memoryId,
          executorMemoryId: loadedTask?.response?.executor_agent_memory_id,
        }).then((payload) => {
          setExecutorMessages(payload);
          return payload;
        }),
      ]);

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
    return (
      <>
        {[...traces, ...executorMessages.slice(traces.length)].map(
          ({ input, response, message_id: messageId }, index) => (
            <React.Fragment key={messageId}>
              <EuiAccordion
                id={`trace-${index}`}
                buttonContent={`Step ${index + 1}${!response ? '(No response)' : ''} - ${input}`}
                paddingSize="l"
              >
                {response && (
                  <EuiText className="wrapAll markdown-output-text" size="s">
                    <MarkdownRender source={response} />
                  </EuiText>
                )}
                {executorMessages?.[index] && (
                  <EuiButton
                    onClick={() => {
                      setTraceModalData({
                        messageId: executorMessages[index].message_id,
                        refresh: !response,
                      });
                    }}
                  >
                    Explain this step
                  </EuiButton>
                )}
              </EuiAccordion>
              <EuiSpacer />
            </React.Fragment>
          )
        )}
      </>
    );
  };

  const shouldTracesModalRefresh = () => {
    if (!traceModalData || !traceModalData.refresh) {
      return false;
    }
    if (task.state === 'COMPLETED' || task.state === 'FAILED') {
      return false;
    }
    const traceMessage = executorMessages.find(
      ({ message_id: messageId }) => messageId === traceModalData.messageId
    );
    return !traceMessage?.response;
  };

  return (
    <div>
      {tracesVisible && renderTraces()}
      {finalMessage && (
        <>
          <EuiAccordion
            id="final-response"
            buttonContent={<h3>Final response</h3>}
            initialIsOpen={initialFinalResponseVisible.current}
          >
            <EuiText className="wrapAll markdown-output-text" size="s">
              {isMarkdownText(finalMessage) ? (
                <MarkdownRender source={finalMessage} />
              ) : (
                finalMessage
              )}
            </EuiText>
          </EuiAccordion>
          <EuiSpacer />
        </>
      )}
      {isLoading ? (
        <EuiLoadingContent />
      ) : (
        <EuiButton
          isLoading={loadingSteps}
          onClick={async () => {
            if (!paragraphResult) {
              return;
            }
            if (traces.length > 0) {
              setTracesVisible((flag) => !flag);
              return;
            }
            setLoadingSteps(true);
            const planMemoryId = paragraphResult.memory_id || paragraphResult.response?.memory_id;
            try {
              const memoryMessages = (
                await getMLCommonsMemoryMessages({
                  http,
                  memoryId: planMemoryId,
                  dataSourceId: para.dataSourceMDSId,
                })
              ).messages;
              const messageId = memoryMessages[0].message_id;
              await Promise.allSettled([
                getAllTracesByMessageId({
                  http,
                  messageId,
                  dataSourceId: para.dataSourceMDSId,
                }),
                getAllExecutorMessages({
                  http,
                  dataSourceId: para.dataSourceMDSId,
                  planMemoryId,
                  executorMemoryId,
                }),
              ]).then(([{ value: loadedTraces }, { value: loadedExecutorMessages }]) => {
                setTraces(loadedTraces);
                setExecutorMessages(loadedExecutorMessages);
              });
            } finally {
              setLoadingSteps(false);
            }
            setTracesVisible((flag) => !flag);
          }}
        >
          {tracesVisible ? 'Hide traces' : 'Show traces'}
        </EuiButton>
      )}
      {traceModalData && (
        <MessageTraceModal
          messageId={traceModalData.messageId}
          refresh={shouldTracesModalRefresh()}
          http={http}
          closeModal={() => {
            setTraceModalData(undefined);
          }}
          dataSourceId={para.dataSourceMDSId}
        />
      )}
    </div>
  );
};
