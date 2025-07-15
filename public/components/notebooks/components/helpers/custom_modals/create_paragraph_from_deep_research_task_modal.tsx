/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  EuiCompressedFieldText,
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
} from '@elastic/eui';
import { DataSourceManagementPluginSetup } from '../../../../../../../../src/plugins/data_source_management/public';
import {
  HttpStart,
  SavedObjectsClientContract,
  ToastsStart,
} from '../../../../../../../../src/core/public';
import { dataSourceFilterFn } from '../../../../../../common/utils/shared';
import {
  getMLCommonsSingleMessage,
  getMLCommonsTask,
} from '../../../../../../public/utils/ml_commons_apis';
import { constructDeepResearchParagraphOut } from '../../../../../../common/utils/paragraph';

export const CreateParagraphFromDeepResearchTaskModal = ({
  closeModal,
  notifications,
  savedObjectsClient,
  dataSourceManagement,
  dataSourceEnabled,
  http,
  onCreate,
}: {
  savedObjectsClient: SavedObjectsClientContract;
  notifications: ToastsStart;
  closeModal: () => void;
  dataSourceManagement: DataSourceManagementPluginSetup;
  dataSourceEnabled: boolean;
  http: HttpStart;
  onCreate: (payload: {
    input: string;
    result: string;
    dataSourceId?: string;
    dataSourceTitle?: string;
  }) => Promise<unknown>;
}) => {
  const [taskId, setTaskId] = useState('');
  const [dataSourceOption, setDataSourceOption] = useState();
  const [isCreating, setIsCreating] = useState(false);

  const DataSourceSelector = dataSourceManagement?.ui?.DataSourceSelector;
  return (
    <EuiOverlayMask>
      <EuiModal onClose={closeModal} initialFocus="[name=input]">
        <EuiModalHeader>
          <EuiModalHeaderTitle>
            <EuiText size="s">
              <h2>Create Deep Research from task</h2>
            </EuiText>
          </EuiModalHeaderTitle>
        </EuiModalHeader>

        <EuiModalBody>
          <EuiForm>
            {dataSourceEnabled && (
              <EuiCompressedFormRow label="Data Source">
                <DataSourceSelector
                  savedObjectsClient={savedObjectsClient}
                  notifications={notifications}
                  onSelectedDataSource={(options) => {
                    setDataSourceOption(options[0]);
                  }}
                  disabled={false}
                  fullWidth={false}
                  removePrepend={false}
                  dataSourceFilter={dataSourceFilterFn}
                />
              </EuiCompressedFormRow>
            )}
            <EuiCompressedFormRow label="Task">
              <EuiCompressedFieldText
                name="input"
                value={taskId}
                onChange={(e) => setTaskId(e.target.value)}
              />
            </EuiCompressedFormRow>
          </EuiForm>
        </EuiModalBody>

        <EuiModalFooter>
          <EuiSmallButtonEmpty onClick={closeModal}>Close</EuiSmallButtonEmpty>
          <EuiSmallButton
            data-test-subj="custom-input-modal-confirm-button"
            disabled={isCreating}
            isLoading={isCreating}
            onClick={async () => {
              // U_Bv45cBI1HiPU4CG_6N
              if (!dataSourceOption?.id || !taskId) {
                notifications.addError(new Error('No data source id or task id'), {
                  title: 'No data source id or task id',
                });
                return;
              }
              setIsCreating(true);
              let task;
              try {
                try {
                  task = await getMLCommonsTask({
                    http,
                    taskId,
                    dataSourceId: dataSourceOption.id,
                  });
                } catch (e) {
                  notifications.addError(e, {
                    title: 'Failed to load task',
                  });
                  return;
                }
                let input = '';
                if (task.response.parent_interaction_id) {
                  try {
                    input = (
                      await getMLCommonsSingleMessage({
                        http,
                        messageId: task.response.parent_interaction_id,
                        dataSourceId: dataSourceOption.id,
                      })
                    ).input;
                  } catch (e) {
                    console.warn('Failed to load interaction', e);
                  }
                }
                await onCreate({
                  dataSourceId: dataSourceOption.id,
                  dataSourceLabel: dataSourceOption.title,
                  input,
                  result: JSON.stringify(
                    constructDeepResearchParagraphOut({
                      task,
                      taskId,
                    })
                  ),
                });
                closeModal();
              } catch (e) {
                notifications.addError(e, {
                  title: 'Failed to create paragraph',
                });
              } finally {
                setIsCreating(false);
              }
            }}
            fill
          >
            Create
          </EuiSmallButton>
        </EuiModalFooter>
      </EuiModal>
    </EuiOverlayMask>
  );
};
