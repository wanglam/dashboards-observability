/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import MarkdownRender from '@nteract/markdown';
import {
  EuiButton,
  EuiLoadingContent,
  EuiText,
  EuiAccordion,
  EuiSpacer,
  EuiFlexGroup,
  EuiFlexItem,
} from '@elastic/eui';
import { of, timer } from 'rxjs';
import { concatMap, expand, skip, takeWhile } from 'rxjs/operators';
import moment from 'moment';

import { CoreStart } from '../../../../../../../src/core/public';
import { ParaType } from '../../../../../common/types/notebooks';

import { getAllMessagesByMemoryId, getAllTracesByMessageId, isMarkdownText } from './utils';
import { MessageTraceModal } from './message_trace_modal';
import { parseParagraphOut } from '../../../../utils/paragraph';
import { isStateCompletedOrFailed } from '../../../../utils/task';
import { getMLCommonsTask } from '../../../../utils/ml_commons_apis';
import { formatTimeGap, getTimeGapFromDates } from '../../../../utils/time';

interface Props {
  http: CoreStart['http'];
  para: ParaType;
}

export const DeepResearchContainer = ({ para, http }: Props) => {
  const [traces, setTraces] = useState([]);
  const parsedParagraphOut = useMemo(() => parseParagraphOut(para)[0], [para]);
  const isTaskCompleteOrFailed = isStateCompletedOrFailed(parsedParagraphOut.state);
  const [isLoading, setIsLoading] = useState(isStateCompletedOrFailed(parsedParagraphOut.state));
  const [tracesVisible, setTracesVisible] = useState(!isStateCompletedOrFailed(parseParagraphOut));
  const [inheritedStepsVisible, setInheritedStepsVisible] = useState(false);
  const [executorMessages, setExecutorMessages] = useState([]);
  const [loadingSteps, setLoadingSteps] = useState(false);
  const [rawTask, setRawTask] = useState(null);
  const [traceModalData, setTraceModalData] = useState<{
    messageId: string;
    messageCreateTime: string;
    refresh: boolean;
  }>();
  const initialFinalResponseVisible = useRef(false);
  const parsedParagraphOutRef = useRef(parsedParagraphOut);
  parsedParagraphOutRef.current = parsedParagraphOut;
  const dataSourceIdRef = useRef(para.dataSourceMDSId);
  dataSourceIdRef.current = para.dataSourceMDSId;

  const finalMessage = useMemo(() => {
    if (!parsedParagraphOut) {
      return '';
    }
    const { state, text_response: textResponse } = parsedParagraphOut;
    if (state === 'COMPLETED') {
      return textResponse ?? 'Task was completed, but failed to load inference result.';
    }

    if (state === 'FAILED') {
      return `Failed to execute task, reason: ${textResponse}`.trim();
    }
    return '';
  }, [parsedParagraphOut]);

  useEffect(() => {
    setIsLoading(!isStateCompletedOrFailed(parsedParagraphOut.state));
  }, [parsedParagraphOut]);

  useEffect(() => {
    if (isStateCompletedOrFailed(parsedParagraphOut.state)) {
      setTracesVisible(false);
      return;
    }
    const abortController = new AbortController();
    const subscription = of(null)
      .pipe(
        expand(() =>
          timer(5000).pipe(
            concatMap(() => {
              const {
                parent_interaction_id: parentInteractionId,
                executor_memory_id: executorMemoryId,
              } = parsedParagraphOut;

              return Promise.allSettled([
                parentInteractionId
                  ? getAllTracesByMessageId({
                      messageId: parentInteractionId,
                      http,
                      signal: abortController.signal,
                      dataSourceId: dataSourceIdRef.current,
                    })
                  : Promise.resolve([]),
                executorMemoryId
                  ? getAllMessagesByMemoryId({
                      memoryId: executorMemoryId,
                      http,
                      signal: abortController.signal,
                      dataSourceId: dataSourceIdRef.current,
                    })
                  : Promise.resolve([]),
              ]);
            })
          )
        )
      )
      .pipe(skip(1))
      .pipe(
        takeWhile(() => {
          return !isStateCompletedOrFailed(parsedParagraphOut.state);
        }, true)
      )
      .subscribe(([{ value: loadedTraces }, { value: loadedExecutorMessages }]) => {
        setTraces(loadedTraces);
        setExecutorMessages(loadedExecutorMessages);
      });

    return () => {
      subscription.unsubscribe();
      abortController.abort('DeepResearchContainer unmount.');
    };
  }, [
    parsedParagraphOut.state,
    parsedParagraphOut.parent_interaction_id,
    parsedParagraphOut.executor_memory_id,
    http,
  ]);

  useEffect(() => {
    const abortController = new AbortController();

    if (!parsedParagraphOut.task_id) {
      setRawTask(null);
      return;
    }

    setRawTask((prevRawTask) =>
      prevRawTask?.id === parsedParagraphOut.task_id ? prevRawTask : null
    );
    getMLCommonsTask({
      http,
      taskId: parsedParagraphOut.task_id,
      dataSourceId: dataSourceIdRef.current,
      signal: abortController.signal,
    }).then((task) => {
      setRawTask({ ...task, id: parsedParagraphOut.task_id });
    });

    return () => {
      abortController.abort('DeepResearchContainer change.');
    };
  }, [isTaskCompleteOrFailed, parsedParagraphOut.task_id, http]);

  const traceStartIndex = executorMessages.findIndex(
    (message) => message.input === traces[0]?.input
  );

  const renderTraces = () => {
    const input2ExecutorMessage = executorMessages.reduce(
      (previousValue, executorMessage) => ({
        ...previousValue,
        [executorMessage.input]: executorMessage,
      }),
      {}
    );

    const allSteps = [
      ...(inheritedStepsVisible ? executorMessages.slice(0, traceStartIndex) : []),
      ...traces,
    ];
    return (
      <>
        {allSteps.map(
          ({ input, response, message_id: messageId, create_time: createTime }, index) => {
            const isInheritedStep = inheritedStepsVisible && index < traceStartIndex;
            let durationStr = '';
            if (!isInheritedStep) {
              if (allSteps[index - 1]) {
                durationStr = getTimeGapFromDates(
                  moment(allSteps[index - 1].create_time),
                  moment(createTime)
                );
              } else if (rawTask?.create_time) {
                durationStr = getTimeGapFromDates(moment(rawTask.create_time), moment(createTime));
              }
            }
            return (
              <React.Fragment key={messageId}>
                <EuiAccordion
                  id={`trace-${index}`}
                  buttonContent={`${isInheritedStep ? '(Inherited step) ' : ''} Step ${index + 1}${
                    !response ? '(No response)' : ''
                  } - ${input} ${durationStr ? `(Duration: ${durationStr})` : ''}`}
                  paddingSize="l"
                >
                  {response && (
                    <EuiText className="wrapAll markdown-output-text" size="s">
                      <MarkdownRender source={response} />
                    </EuiText>
                  )}
                  {input2ExecutorMessage[input] && (
                    <EuiButton
                      onClick={() => {
                        setTraceModalData({
                          messageId: input2ExecutorMessage[input].message_id,
                          messageCreateTime: input2ExecutorMessage[input].create_time,
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
            );
          }
        )}
      </>
    );
  };

  const shouldTracesModalRefresh = () => {
    if (!traceModalData || !traceModalData.refresh) {
      return false;
    }
    if (isStateCompletedOrFailed(parsedParagraphOut.state)) {
      return false;
    }
    const traceMessageIndex = executorMessages.findIndex(
      ({ message_id: messageId }) => messageId === traceModalData.messageId
    );
    if (traceMessageIndex + 1 < executorMessages.length) {
      return false;
    }
    return !executorMessages[traceMessageIndex]?.response;
  };

  return (
    <div>
      {tracesVisible && renderTraces()}
      {finalMessage && (
        <>
          <EuiAccordion
            id="final-response"
            buttonContent={
              <h3>
                Final response{' '}
                {rawTask && rawTask.last_update_time && rawTask.create_time
                  ? `(Total Duration: ${formatTimeGap(
                      rawTask.last_update_time - rawTask.create_time
                    )})`
                  : ''}
              </h3>
            }
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
        <EuiFlexGroup>
          <EuiFlexItem grow={false}>
            <EuiButton
              isLoading={loadingSteps}
              onClick={async () => {
                if (!parsedParagraphOut) {
                  return;
                }
                if (traces.length > 0) {
                  setTracesVisible((flag) => !flag);
                  return;
                }
                setLoadingSteps(true);
                try {
                  const {
                    parent_interaction_id: parentInteractionId,
                    executor_memory_id: executorMemoryId,
                  } = parsedParagraphOut;
                  await Promise.allSettled([
                    parentInteractionId
                      ? getAllTracesByMessageId({
                          messageId: parentInteractionId,
                          http,
                          dataSourceId: dataSourceIdRef.current,
                        })
                      : Promise.resolve([]),
                    executorMemoryId
                      ? getAllMessagesByMemoryId({
                          memoryId: executorMemoryId,
                          http,
                          dataSourceId: dataSourceIdRef.current,
                        })
                      : Promise.resolve([]),
                  ]).then(([{ value: loadedTraces }, { value: loadedExecutorMessages }]) => {
                    setTraces(loadedTraces);
                    setExecutorMessages(loadedExecutorMessages);
                  });
                } finally {
                  setLoadingSteps(false);
                }
                if (tracesVisible) {
                  setInheritedStepsVisible(false);
                }
                setTracesVisible((flag) => !flag);
              }}
            >
              {tracesVisible ? 'Hide traces' : 'Show traces'}
            </EuiButton>
          </EuiFlexItem>
          {tracesVisible && traceStartIndex > 0 && (
            <EuiFlexItem grow={false}>
              <EuiButton
                onClick={() => {
                  setInheritedStepsVisible((flag) => !flag);
                }}
              >
                {inheritedStepsVisible ? 'Hide' : 'Show'} inherited steps
              </EuiButton>
            </EuiFlexItem>
          )}
        </EuiFlexGroup>
      )}
      {traceModalData && (
        <MessageTraceModal
          messageId={traceModalData.messageId}
          messageCreateTime={traceModalData.messageCreateTime}
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
