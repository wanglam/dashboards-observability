/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import MarkdownRender from '@nteract/markdown';
import { EuiLoadingContent, EuiText, EuiSteps } from '@elastic/eui';
import { of, timer } from 'rxjs';
import { concatMap, expand } from 'rxjs/operators';

import { CoreStart } from '../../../../../../src/core/public';
import { ParaType } from '../../../../common/types/notebooks';

import { getAllTracesByMessageId } from './deep_research_container/utils';
import { parseParagraphOut } from '../../../utils/paragraph';
import { isStateCompletedOrFailed } from '../../../utils/task';

interface SOP {
  entranceCondition?: string;
  currentStep: string;
  judgement?: string;
  nextSteps: SOP[];
}

interface Message {
  memory_id: string;
  message_id: string;
  create_time: string;
  input: string;
  response?: string;
  origin: string;
  parent_message_id?: string;
  trace_number: number;
}

const nextOptionRegExp = /<next_option>.*(\d+).*<\/next_option>$/;

const buildSOPSteps = (
  sop: SOP,
  messages: Message[]
): Array<{
  title: string;
  content?: string;
  status: 'loading' | 'complete' | 'danger';
  options?: string[];
}> => {
  const stepInMessagesIndex = messages.findIndex((message) => message.input === sop.currentStep);
  if (sop.nextSteps.length === 0) {
    return [
      {
        title: sop.currentStep,
        status: 'complete' as const,
      },
    ];
  }
  if (stepInMessagesIndex === -1 || (!messages[stepInMessagesIndex].response && !sop.judgement)) {
    return [
      {
        title: sop.currentStep,
        status: 'loading' as const,
      },
    ];
  }
  const steps = [
    {
      title: sop.currentStep,
      status: 'complete' as const,
      content: messages[stepInMessagesIndex].response,
    },
  ];
  if (!sop.judgement) {
    return sop.nextSteps
      ? [...steps, ...buildSOPSteps(sop.nextSteps[0], messages.slice(stepInMessagesIndex))]
      : steps;
  }
  const judgementStepTitle = `JUDGEMENT: ${sop.judgement}`;
  if (!messages[stepInMessagesIndex + 1] || !messages[stepInMessagesIndex + 1].response) {
    return [
      ...steps,
      {
        title: judgementStepTitle,
        status: 'loading' as const,
        content: `
${sop.nextSteps.map(
  ({ entranceCondition }, index) => `#### Option ${index + 1}: ${entranceCondition}`
).join(`
`)}
`,
      },
    ];
  }

  const judgementResponse = messages[stepInMessagesIndex + 1].response;
  const result = judgementResponse && nextOptionRegExp.exec(judgementResponse);
  if (!result || !result[1]) {
    return [
      ...steps,
      {
        title: judgementStepTitle,
        status: 'danger' as const,
        content: 'No step matched from judgement response message',
      },
    ];
  }
  const nextStep = parseInt(result[1], 10) - 1;
  if (!sop.nextSteps[nextStep]) {
    return [
      {
        title: judgementStepTitle,
        status: 'danger' as const,
        content: `No matching step ${nextStep} in SOP`,
      },
    ];
  }
  return [
    ...steps,
    {
      title: judgementStepTitle,
      status: 'complete' as const,
      content: `
${sop.nextSteps.map(
  ({ entranceCondition }, index) =>
    `#### Option ${index + 1}: ${entranceCondition}${index === nextStep ? '(Prefer)' : ''}`
).join(`
`)}

${judgementResponse.replace(nextOptionRegExp, '').trim()}
`.trim(),
    },
    ...buildSOPSteps(sop.nextSteps[nextStep], messages.slice(stepInMessagesIndex + 1)),
  ];
};

interface Props {
  http: CoreStart['http'];
  para: ParaType;
}

export const SOPContainer = ({ para, http }: Props) => {
  const parsedParagraphOut = useMemo(() => parseParagraphOut(para)[0], [para]);
  const taskFinished = isStateCompletedOrFailed(parsedParagraphOut.state);
  const [messageTraces, setMessageTraces] = useState([]);
  const [shouldShowLoading, setShouldShowLoading] = useState(
    taskFinished && parsedParagraphOut.parentInteractionId
  );
  const loadedMessageTracesRef = useRef(messageTraces);
  loadedMessageTracesRef.current = messageTraces;
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

  const steps = useMemo(() => {
    const { sop: originalSOP } = parsedParagraphOut;
    let sop = originalSOP;
    if (typeof sop === 'string') {
      try {
        sop = JSON.parse(originalSOP);
      } catch (e) {
        console.error('Failed to parse SOP', e);
      }
    }
    // TODO: Remove this check in production, linear SOP won't support anymore.
    if (Array.isArray(sop)) {
      return [];
    }
    if (!sop || typeof sop !== 'object') {
      return [];
    }
    const sopSteps = buildSOPSteps(sop, messageTraces);
    return sopSteps.map(({ title, status, content }, index) => {
      return {
        step: index + 1,
        title,
        children: content ? (
          <EuiText className="wrapAll markdown-output-text" size="s">
            <MarkdownRender source={content} />
          </EuiText>
        ) : (
          <></>
        ),
        status,
      };
    });
  }, [taskFinished, messageTraces, parsedParagraphOut.sop]);

  useEffect(() => {
    if (!parsedParagraphOut.parentInteractionId) {
      return;
    }
    const abortController = new AbortController();

    if (taskFinished) {
      let canceled = false;
      if (loadedMessageTracesRef.current.length === 0) {
        setShouldShowLoading(true);
      }

      getAllTracesByMessageId({
        messageId: parsedParagraphOut.parentInteractionId,
        http,
        signal: abortController.signal,
        dataSourceId: dataSourceIdRef.current,
      })
        .then((traces) => {
          setMessageTraces(traces);
        })
        .catch((error) => {
          if (error.name !== 'AbortError') {
            console.error('Failed to load message traces:', error);
          }
        })
        .finally(() => {
          if (!canceled) {
            setShouldShowLoading(false);
          }
        });
      return () => {
        canceled = true;
        abortController.abort();
      };
    }
    setShouldShowLoading(true);
    const subscription = of([])
      .pipe(
        expand(() =>
          timer(5000).pipe(
            concatMap(() => {
              return getAllTracesByMessageId({
                messageId: parsedParagraphOut.parentInteractionId,
                http,
                signal: abortController.signal,
                dataSourceId: dataSourceIdRef.current,
              }).catch((error) => {
                console.error('Failed to get all messages', error);
                return loadedMessageTracesRef.current;
              });
            })
          )
        )
      )
      .subscribe((traces) => {
        setMessageTraces(traces);
        if (traces.length > 0) {
          setShouldShowLoading(false);
        }
      });

    return () => {
      subscription.unsubscribe();
      abortController.abort('SOPContainer unmount.');
    };
  }, [taskFinished, parsedParagraphOut.parentInteractionId, http]);

  return (
    <div>
      {shouldShowLoading ? <EuiLoadingContent lines={3} /> : <EuiSteps steps={steps} />}
      {finalMessage && (
        <EuiText className="wrapAll markdown-output-text" size="s">
          <MarkdownRender source={finalMessage} />
        </EuiText>
      )}
    </div>
  );
};
