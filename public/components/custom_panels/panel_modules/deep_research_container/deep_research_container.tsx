/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useEffect, useMemo, useState } from 'react';
import MarkdownRender from '@nteract/markdown';
import { EuiButton, EuiLoadingContent, EuiText } from '@elastic/eui';

import { CoreStart } from '../../../../../../../src/core/public';

import { ParaType } from '../../../../../common/types/notebooks';
import { OBSERVABILITY_ML_COMMONS_API } from '../../../../../common/constants/ml_commons';

const getMLCommonsTask = async ({
  http,
  taskId,
  signal,
  dataSourceId,
}: {
  http: CoreStart['http'];
  taskId: string;
  signal?: AbortSignal;
  dataSourceId?: string;
}) =>
  http.get(OBSERVABILITY_ML_COMMONS_API.singleTask.replace('{taskId}', taskId), {
    signal,
    query: {
      data_source_id: dataSourceId,
    },
  });

const getMemory = async ({
  http,
  memoryId,
  signal,
  dataSourceId,
}: {
  http: CoreStart['http'];
  memoryId: string;
  signal?: AbortSignal;
  dataSourceId?: string;
}) =>
  http.get(`/api/assistant/conversation/${memoryId}`, {
    signal,
    query: {
      dataSourceId,
    },
  });

const getTrace = async ({
  http,
  interactionId,
  signal,
  dataSourceId,
}: {
  http: CoreStart['http'];
  interactionId: string;
  signal?: AbortSignal;
  dataSourceId?: string;
}) =>
  http.get(`/api/assistant/trace/${interactionId}`, {
    signal,
    query: {
      dataSourceId,
    },
  });

interface Props {
  http: CoreStart['http'];
  para: ParaType;
}

export const DeepResearchContainer = ({ para, http }: Props) => {
  const [finalMessage, setFinalMessage] = useState<string>();
  const [traces, setTraces] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [tracesVisible, setTracesVisible] = useState(false);

  const savedTask = useMemo(() => {
    if (para.out[0]) {
      try {
        return JSON.parse(para.out[0]);
      } catch (e) {
        console.error('Error when parse para out', e);
      }
    }
  }, [para.out[0]]);

  useEffect(() => {
    if (!savedTask) {
      return;
    }
    const {
      task_id: taskId,
      response: { memory_id: memoryId },
    } = savedTask;
    let canceled = false;
    let interactionId: string | undefined;
    const abortController = new AbortController();

    const loadTraces = async () => {
      if (!interactionId) {
        return;
      }
      const loadedTraces = await getTrace({
        http,
        interactionId,
        signal: abortController.signal,
        dataSourceId: para.dataSourceMDSId,
      });
      if (!canceled) {
        setTraces(loadedTraces);
      }
    };

    const fetchTraceAndFinalResponse = async () => {
      const task = await getMLCommonsTask({
        http,
        taskId,
        signal: abortController.signal,
        dataSourceId: para.dataSourceMDSId,
      });
      if (canceled) {
        return;
      }
      if (task.state === 'COMPLETED') {
        const inferenceResult = task.response.inference_results[0];
        if (inferenceResult) {
          setFinalMessage(
            inferenceResult.output.find(({ name }) => name === 'response').dataAsMap.response
          );
          await loadTraces();
        }
        setIsLoading(false);
        setTracesVisible(false);
        return;
      }
      if (task.state === 'FAILED') {
        setFinalMessage(
          `
#### Failed to generate
${task.response.error_message}
`.trim()
        );
        await loadTraces();
        setIsLoading(false);
        setTracesVisible(false);
        return;
      }
      if (!interactionId) {
        const memory = await getMemory({
          http,
          memoryId,
          signal: abortController.signal,
          dataSourceId: para.dataSourceMDSId,
        });
        if (memory.interactions[0]) {
          interactionId = memory.interactions[0].interaction_id;
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
  }, [savedTask, http, para.dataSourceMDSId]);

  const finalMarkdown = `
  ${
    tracesVisible
      ? traces
          .map(({ input, output, traceNumber }) =>
            `
### Step ${traceNumber}
#### Step Input
${input}
#### Step Output
${output}
  `.trim()
          )
          .join('\n')
      : ''
  }

  ${
    finalMessage
      ? `
### Final response
${finalMessage}
    `
      : ''
  }
  `.trim();

  return (
    <div>
      <EuiText className="wrapAll markdown-output-text" size="s">
        <MarkdownRender source={finalMarkdown} />
      </EuiText>
      {isLoading ? (
        <EuiLoadingContent />
      ) : (
        <EuiButton
          onClick={async () => {
            if (!savedTask) {
              return;
            }
            if (traces.length === 0) {
              const memory = await getMemory({
                http,
                memoryId: savedTask.response.memory_id,
                dataSourceId: para.dataSourceMDSId,
              });
              const interactionId = memory.interactions[0].interaction_id;
              setTraces(
                await getTrace({
                  http,
                  interactionId,
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
    </div>
  );
};
