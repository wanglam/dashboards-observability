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

export const getSystemPrompts = () => {
  return {
    systemPrompt: localStorage.getItem(DEEP_RESEARCH_SYSTEM_PROMPT_KEY) ?? undefined,
    executorSystemPrompt:
      localStorage.getItem(DEEP_RESEARCH_EXECUTOR_SYSTEM_PROMPT_KEY) ?? undefined,
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
                placeholder="Input system prompt"
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
                placeholder="Input executor system prompt"
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
              if (systemPromptInputRef.current?.value) {
                localStorage.setItem(
                  DEEP_RESEARCH_SYSTEM_PROMPT_KEY,
                  systemPromptInputRef.current.value
                );
              }
              if (executorSystemPromptInputRef.current?.value) {
                localStorage.setItem(
                  DEEP_RESEARCH_EXECUTOR_SYSTEM_PROMPT_KEY,
                  executorSystemPromptInputRef.current.value
                );
              }
              closeModal();
            }}
            fill
          >
            Save
          </EuiSmallButton>
          <EuiSmallButton
            data-test-subj="custom-input-modal-confirm-button"
            onClick={() => {
              localStorage.removeItem(DEEP_RESEARCH_SYSTEM_PROMPT_KEY);
              localStorage.removeItem(DEEP_RESEARCH_EXECUTOR_SYSTEM_PROMPT_KEY);
              closeModal();
            }}
            fill
          >
            Reset prompts
          </EuiSmallButton>
        </EuiModalFooter>
      </EuiModal>
    </EuiOverlayMask>
  );
};
