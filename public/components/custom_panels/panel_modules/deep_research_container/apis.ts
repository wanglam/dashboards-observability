/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { OBSERVABILITY_ML_COMMONS_API } from '../../../../../common/constants/ml_commons';
import { CoreStart } from '../../../../../../../src/core/public';

export const getMLCommonsTask = async ({
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

export const getMLCommonsMemoryMessages = async ({
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
  http.get(OBSERVABILITY_ML_COMMONS_API.memoryMessages.replace('{memoryId}', memoryId), {
    signal,
    query: {
      data_source_id: dataSourceId,
    },
  });

export const getMLCommonsMessageTraces = async ({
  http,
  messageId,
  signal,
  dataSourceId,
}: {
  http: CoreStart['http'];
  messageId: string;
  signal?: AbortSignal;
  dataSourceId?: string;
}) =>
  http.get(OBSERVABILITY_ML_COMMONS_API.messageTraces.replace('{messageId}', messageId), {
    signal,
    query: {
      data_source_id: dataSourceId,
    },
  });
