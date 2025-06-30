/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import MarkdownRender from '@nteract/markdown';
import { EuiLoadingContent, EuiText, EuiSteps, EuiStepStatus } from '@elastic/eui';
import { of, timer } from 'rxjs';
import { concatMap, expand } from 'rxjs/operators';

import { CoreStart } from '../../../../../../src/core/public';
import { ParaType } from '../../../../common/types/notebooks';

import { getAllMessagesByMemoryId, getAllTracesByMessageId } from './deep_research_container/utils';
import { parseParagraphOut } from '../../../utils/paragraph';
import { isStateCompletedOrFailed } from '../../../utils/task';

interface Props {
  http: CoreStart['http'];
  para: ParaType;
}

export const SOPContainer = ({ para, http }: Props) => {
  const parsedParagraphOut = useMemo(() => parseParagraphOut(para)[0], [para]);
  const taskFinished = isStateCompletedOrFailed(parsedParagraphOut.state);
  const [isLoadingStepResponse, setIsLoadingStepResponse] = useState(taskFinished);
  const [executorMessages, setExecutorMessages] = useState([]);
  const [latestExecutorMessageTraces, setLatestExecutorMessageTraces] = useState([]);
  const initialFinalResponseVisible = useRef(false);

  initialFinalResponseVisible.current = parsedParagraphOut.textResponse;
  const dataSourceIdRef = useRef(para.dataSourceMDSId);
  dataSourceIdRef.current = para.dataSourceMDSId;

  const finalMessage = useMemo(() => {
    if (!parsedParagraphOut) {
      return '';
    }
    const { state, textResponse } = parsedParagraphOut;
    if (state === 'COMPLETED') {
      return textResponse ?? 'Task was completed, but failed to load inference result.';
    }

    if (state === 'FAILED') {
      return `Failed to execute task, reason: ${textResponse}`.trim();
    }
    return '';
  }, [parsedParagraphOut]);

  const traceExecutorMessageId = useMemo(() => {
    if (
      taskFinished ||
      executorMessages.length === 0 ||
      executorMessages[executorMessages.length - 1].response
    ) {
      return;
    }
    return executorMessages[executorMessages.length - 1].message_id;
  }, [executorMessages, taskFinished]);

  const steps = useMemo(() => {
    const sop = parsedParagraphOut.sop;
    if (Array.isArray(sop)) {
      return sop.map((step, index) => {
        let status: EuiStepStatus = 'incomplete';
        const stepResponse = executorMessages[index]?.response;
        let children = stepResponse ? (
          <EuiText className="wrapAll markdown-output-text" size="s">
            <MarkdownRender source={stepResponse} />
          </EuiText>
        ) : undefined;
        if (stepResponse) {
          status = 'complete';
        } else if (
          !taskFinished &&
          (index === 0 || executorMessages[index]) &&
          !executorMessages[index + 1]
        ) {
          status = 'loading';
        } else if (taskFinished && isLoadingStepResponse) {
          status = 'loading';
          children = <EuiLoadingContent />;
        } else if (taskFinished) {
          status = 'warning';
        }

        if (
          traceExecutorMessageId === executorMessages[index]?.message_id &&
          latestExecutorMessageTraces.length > 0
        ) {
          const llmTraces = latestExecutorMessageTraces.filter(({ origin }) => origin === 'LLM');
          if (llmTraces.length > 0) {
            const latestLLMTrace = llmTraces[llmTraces.length - 1];
            console.log(latestLLMTrace);
            if (latestLLMTrace) {
              try {
                children = (
                  <>
                    {JSON.parse(latestLLMTrace.response).output?.message?.content[0]?.text ||
                      latestLLMTrace.input}
                  </>
                );
              } catch (e) {
                console.log('Failed to parse llm response', e);
              }
            }
          }
        }

        return {
          step: index + 1,
          title: step,
          children,
          status,
        };
      });
    }
    return [];
  }, [taskFinished, executorMessages, latestExecutorMessageTraces, traceExecutorMessageId]);

  useEffect(() => {
    const abortController = new AbortController();
    setIsLoadingStepResponse(true);
    if (taskFinished) {
      const { executorMemoryId } = parsedParagraphOut;
      getAllMessagesByMemoryId({
        memoryId: executorMemoryId,
        http,
        signal: abortController.signal,
        dataSourceId: dataSourceIdRef.current,
      })
        .then((messages) => {
          setExecutorMessages(messages);
        })
        .finally(() => {
          setIsLoadingStepResponse(false);
        });
      return;
    }
    const subscription = of([])
      .pipe(
        expand(() =>
          timer(5000).pipe(
            concatMap(() => {
              const { executorMemoryId } = parsedParagraphOut;
              return executorMemoryId
                ? getAllMessagesByMemoryId({
                    memoryId: executorMemoryId,
                    http,
                    signal: abortController.signal,
                    dataSourceId: dataSourceIdRef.current,
                  })
                : Promise.resolve([]);
            })
          )
        )
      )
      .subscribe((messages) => {
        setExecutorMessages(messages);
      });

    return () => {
      subscription.unsubscribe();
      abortController.abort('SOPContainer unmount.');
    };
  }, [taskFinished, parsedParagraphOut, http]);

  useEffect(() => {
    if (!traceExecutorMessageId) {
      return;
    }
    setLatestExecutorMessageTraces([]);
    const abortController = new AbortController();
    const subscription = of([])
      .pipe(
        expand(() =>
          timer(5000).pipe(
            concatMap(() =>
              getAllTracesByMessageId({
                messageId: traceExecutorMessageId,
                http,
                signal: abortController.signal,
                dataSourceId: dataSourceIdRef.current,
              })
            )
          )
        )
      )
      .subscribe((traces) => {
        setLatestExecutorMessageTraces(traces);
      });

    return () => {
      subscription.unsubscribe();
      abortController.abort('SOPContainer unmount.');
    };
  }, [traceExecutorMessageId, http]);

  return (
    <div>
      <EuiSteps steps={steps} />
      {finalMessage && (
        <EuiText className="wrapAll markdown-output-text" size="s">
          <MarkdownRender source={finalMessage} />
        </EuiText>
      )}
    </div>
  );
};
