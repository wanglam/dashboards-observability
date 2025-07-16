/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef } from 'react';
import {
  EuiCompressedFormRow,
  EuiForm,
  EuiModal,
  EuiModalBody,
  EuiModalFooter,
  EuiModalHeader,
  EuiModalHeaderTitle,
  EuiOverlayMask,
  EuiSmallButton,
  EuiSmallButtonEmpty,
  EuiText,
  EuiTextArea,
} from '@elastic/eui';
import { useMemo } from 'react';

const DEEP_RESEARCH_SYSTEM_PROMPT_KEY = 'deep-research-system-prompt';
const DEEP_RESEARCH_EXECUTOR_SYSTEM_PROMPT_KEY = 'deep-research-executor-system-prompt';

const DEFAULT_SYSTEM_PROMPT = `
You must base your analysis, insights, and conclusions EXCLUSIVELY on the information provided in the context below. Do not:
Make assumptions or inferences beyond what the data directly supports
Use hypothetical examples or scenarios not mentioned in the context
If the provided context is insufficient to answer a question or draw a specific conclusion, you must explicitly state "Based on the provided context, there is insufficient information to determine [X]" rather than filling in gaps with hypothetical knowledge.
You are part of an OpenSearch cluster. When you deliver your final result, include a comprehensive report. This report MUST:
1. List every analysis or step you performed.
2. Summarize the inputs, methods, tools, and data used at each step.
3. Include key findings from all intermediate steps — do NOT omit them.
4. Clearly explain how the steps led to your final conclusion.
5. Return the full analysis and conclusion in the 'result' field, even if some of this was mentioned earlier.

The final response should be fully self-contained and detailed, allowing a user to understand the full investigation without needing to reference prior messages. Always respond in JSON format.
    `.trim();

const DEFAULT_EXECUTOR_SYSTEM_PROMPT = `
You must base your analysis, insights, and conclusions EXCLUSIVELY on the information provided in the context below. Do not:
Make assumptions or inferences beyond what the data directly supports
Use hypothetical examples or scenarios not mentioned in the context
If the provided context is insufficient to answer a question or draw a specific conclusion, you must explicitly state "Based on the provided context, there is insufficient information to determine [X]" rather than filling in gaps with hypothetical knowledge.
You are a dedicated helper agent working as part of a plan‑execute‑reflect framework. Your role is to receive a discrete task, execute all necessary internal reasoning or tool calls, and return a single, final response that fully addresses the task. You must never return an empty response. If you are unable to complete the task or retrieve meaningful information, you must respond with a clear explanation of the issue or what was missing. Under no circumstances should you end your reply with a question or ask for more information. If you search any index, always include the raw documents in the final result instead of summarizing the content. This is critical to give visibility into what the query retrieved.
    `.trim();

export const getSystemPrompts = () => {
  return {
    systemPrompt: localStorage.getItem(DEEP_RESEARCH_SYSTEM_PROMPT_KEY) ?? DEFAULT_SYSTEM_PROMPT,
    executorSystemPrompt:
      localStorage.getItem(DEEP_RESEARCH_EXECUTOR_SYSTEM_PROMPT_KEY) ??
      DEFAULT_EXECUTOR_SYSTEM_PROMPT,
  };
};

export const SystemPromptSettingModal = ({ closeModal }: { closeModal: () => void }) => {
  const systemPromptInputRef = useRef<HTMLTextAreaElement | null>();
  const executorSystemPromptInputRef = useRef<HTMLTextAreaElement | null>();
  const prompts = useMemo(() => getSystemPrompts(), []);

  return (
    <EuiOverlayMask>
      <EuiModal onClose={closeModal} style={{ width: 800 }}>
        <EuiModalHeader>
          <EuiModalHeaderTitle>
            <EuiText size="s">
              <h2>System prompt settings</h2>
            </EuiText>
          </EuiModalHeaderTitle>
        </EuiModalHeader>

        <EuiModalBody>
          <EuiForm>
            <EuiCompressedFormRow fullWidth label="System prompt">
              <EuiTextArea
                name="systemPrompt"
                defaultValue={prompts.systemPrompt}
                inputRef={(ref) => {
                  systemPromptInputRef.current = ref;
                }}
                fullWidth
              />
            </EuiCompressedFormRow>
            <EuiCompressedFormRow fullWidth label="Executor system prompt">
              <EuiTextArea
                name="executorSystemPrompt"
                defaultValue={prompts.executorSystemPrompt}
                inputRef={(ref) => {
                  executorSystemPromptInputRef.current = ref;
                }}
                fullWidth
              />
            </EuiCompressedFormRow>
          </EuiForm>
        </EuiModalBody>

        <EuiModalFooter>
          <EuiSmallButtonEmpty onClick={closeModal}>Close</EuiSmallButtonEmpty>
          <EuiSmallButton
            data-test-subj="custom-input-modal-confirm-button"
            onClick={() => {
              localStorage.setItem(
                DEEP_RESEARCH_SYSTEM_PROMPT_KEY,
                systemPromptInputRef.current?.value ?? DEFAULT_SYSTEM_PROMPT
              );
              localStorage.setItem(
                DEEP_RESEARCH_EXECUTOR_SYSTEM_PROMPT_KEY,
                executorSystemPromptInputRef.current?.value ?? DEFAULT_EXECUTOR_SYSTEM_PROMPT
              );
              closeModal();
            }}
            fill
          >
            Save
          </EuiSmallButton>
        </EuiModalFooter>
      </EuiModal>
    </EuiOverlayMask>
  );
};
