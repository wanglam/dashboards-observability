/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useEffect, useState } from 'react';
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
} from '@elastic/eui';
import { CoreStart } from '../../../../../../../src/core/public';
import { getMLCommonsMessageTraces } from './apis';

export const MessageTraceModal = ({
  messageId,
  closeModal,
  http,
  dataSourceId,
}: {
  messageId: string;
  closeModal: () => void;
  http: CoreStart['http'];
  dataSourceId?: string;
}) => {
  const [traces, setTraces] = useState([]);
  useEffect(() => {
    const abortController = new AbortController();
    getMLCommonsMessageTraces({
      http,
      messageId,
      signal: abortController.signal,
      dataSourceId,
    }).then((messageTraces) => {
      setTraces(messageTraces);
    });
    return () => {
      abortController.abort();
    };
  }, [messageId, http, dataSourceId]);

  const renderTraces = () => {
    return traces.map(({ input, response, message_id: traceMessageId }, index) => (
      <React.Fragment key={traceMessageId}>
        <EuiAccordion
          id={`trace-${index}`}
          buttonContent={`Step ${index + 1} - ${input}`}
          paddingSize="l"
        >
          <EuiText className="wrapAll markdown-output-text" size="s">
            <MarkdownRender source={response} />
          </EuiText>
        </EuiAccordion>
        <EuiSpacer />
      </React.Fragment>
    ));
  };

  return (
    <EuiModal onClose={closeModal}>
      <EuiModalHeader>
        <EuiModalHeaderTitle>
          <h1>Message trace</h1>
        </EuiModalHeaderTitle>
      </EuiModalHeader>

      <EuiModalBody>{traces.length > 0 ? renderTraces() : <EuiLoadingContent />}</EuiModalBody>

      <EuiModalFooter>
        <EuiButton onClick={closeModal} fill>
          Close
        </EuiButton>
      </EuiModalFooter>
    </EuiModal>
  );
};
