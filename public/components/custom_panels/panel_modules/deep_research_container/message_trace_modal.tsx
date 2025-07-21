/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useEffect, useState } from 'react';
import moment from 'moment';
import MarkdownRender from '@nteract/markdown';
import {
  EuiModal,
  EuiModalHeader,
  EuiModalBody,
  EuiModalFooter,
  EuiButton,
  EuiModalHeaderTitle,
  EuiAccordion,
  EuiText,
  EuiSpacer,
  EuiLoadingContent,
  EuiCodeBlock,
} from '@elastic/eui';
import { CoreStart } from '../../../../../../../src/core/public';
import { getAllTracesByMessageId, isMarkdownText } from './utils';
import { getTimeGapFromDates } from '../../../../utils/time';

const renderTraceString = ({ text, fallback }: { text: string | undefined; fallback: string }) => {
  if (!text) {
    return fallback;
  }
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  if (json) {
    return (
      <EuiCodeBlock language="json" isCopyable>
        {JSON.stringify(json, null, 2)}
      </EuiCodeBlock>
    );
  }

  return isMarkdownText(text) ? (
    <MarkdownRender source={text} />
  ) : (
    <EuiCodeBlock isCopyable>{text}</EuiCodeBlock>
  );
};

export const MessageTraceModal = ({
  messageId,
  messageCreateTime,
  closeModal,
  http,
  dataSourceId,
  refresh,
}: {
  messageId: string;
  messageCreateTime: string;
  closeModal: () => void;
  http: CoreStart['http'];
  dataSourceId?: string;
  refresh: boolean;
}) => {
  const [traces, setTraces] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  useEffect(() => {
    const abortController = new AbortController();
    let canceled = false;
    const fetchAllTraces = async () => {
      try {
        if (!canceled) {
          setIsLoading(true);
        }
        const messageTraces = await getAllTracesByMessageId({
          http,
          messageId,
          signal: abortController.signal,
          dataSourceId,
        });

        if (!canceled) {
          setTraces(messageTraces);
        }
      } finally {
        if (!refresh) {
          setIsLoading(false);
        }
      }
      await new Promise((resolve) => {
        setTimeout(resolve, 5000);
      });
      if (!canceled && refresh) {
        fetchAllTraces();
      }
    };
    fetchAllTraces();
    return () => {
      abortController.abort();
      canceled = true;
    };
  }, [messageId, refresh, http, dataSourceId]);

  const renderTraces = () => {
    if (!isLoading && traces.length === 0) {
      return (
        <EuiText className="wrapAll markdown-output-text" size="s">
          No traces data.
        </EuiText>
      );
    }
    return traces.map(
      (
        { input, response, message_id: traceMessageId, origin, create_time: traceCreateTime },
        index
      ) => {
        const isFromLLM = origin?.toLowerCase() === 'llm';
        let llmReasoning;
        if (isFromLLM) {
          try {
            llmReasoning = JSON.parse(response).output.message.content[0]?.text;
          } catch (e) {
            console.log('Failed to parse response', e);
          }
        }
        let durationStr = '';
        if (traces[index - 1]) {
          durationStr = getTimeGapFromDates(
            moment(traces[index - 1].create_time),
            moment(traceCreateTime)
          );
        } else if (messageCreateTime) {
          durationStr = getTimeGapFromDates(moment(messageCreateTime), moment(traceCreateTime));
        }
        return (
          <React.Fragment key={traceMessageId}>
            <EuiAccordion
              id={`trace-${index}`}
              buttonContent={`Step ${index + 1} - ${
                isFromLLM ? llmReasoning || input : `Execute ${origin}`
              } ${durationStr ? `Duration (${durationStr})` : ''}`}
              paddingSize="l"
            >
              <EuiText className="wrapAll markdown-output-text" size="s">
                {isFromLLM ? (
                  renderTraceString({ text: response, fallback: 'No response' })
                ) : (
                  <>
                    <EuiAccordion
                      id={`trace-step-${index}-input`}
                      buttonContent={`${origin} input`}
                      initialIsOpen
                    >
                      {renderTraceString({ text: input, fallback: 'No input' })}
                    </EuiAccordion>
                    <EuiAccordion
                      id={`trace-step-${index}-response`}
                      buttonContent={`${origin} response`}
                      initialIsOpen={!response}
                    >
                      {renderTraceString({ text: response, fallback: 'No response' })}
                    </EuiAccordion>
                  </>
                )}
              </EuiText>
            </EuiAccordion>
            <EuiSpacer />
          </React.Fragment>
        );
      }
    );
  };

  return (
    <EuiModal onClose={closeModal}>
      <EuiModalHeader>
        <EuiModalHeaderTitle>
          <h1>Message trace</h1>
        </EuiModalHeaderTitle>
      </EuiModalHeader>

      <EuiModalBody>
        {renderTraces()}
        {isLoading && <EuiLoadingContent />}
      </EuiModalBody>

      <EuiModalFooter>
        <EuiButton onClick={closeModal} fill>
          Close
        </EuiButton>
      </EuiModalFooter>
    </EuiModal>
  );
};
