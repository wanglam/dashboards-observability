/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { OBSERVABILITY_ML_COMMONS_API } from '../../common/constants/ml_commons';
import { CoreStart } from '../../../../src/core/public';

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

export const getMLCommonsMemory = async ({
  http,
  signal,
  dataSourceId,
  query,
  size,
  sort,
}: {
  http: CoreStart['http'];
  signal?: AbortSignal;
  dataSourceId?: string;
  query?: { [key: string]: any };
  size?: number;
  sort?: { [key: string]: 'asc' | 'desc' };
}) =>
  http.get(OBSERVABILITY_ML_COMMONS_API.memory, {
    signal,
    query: {
      data_source_id: dataSourceId,
      ...(query ? { query: JSON.stringify(query) } : {}),
      ...(size ? { size } : {}),
      ...(sort ? { query: JSON.stringify(sort) } : {}),
    },
  });

export const getMLCommonsSingleMemory = async ({
  http,
  signal,
  dataSourceId,
  memoryId,
}: {
  http: CoreStart['http'];
  signal?: AbortSignal;
  dataSourceId?: string;
  memoryId: string;
}) =>
  http.get(OBSERVABILITY_ML_COMMONS_API.singleMemory.replace('{memoryId}', memoryId), {
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
  nextToken,
}: {
  http: CoreStart['http'];
  memoryId: string;
  signal?: AbortSignal;
  dataSourceId?: string;
  nextToken?: string;
}) =>
  http.get(OBSERVABILITY_ML_COMMONS_API.memoryMessages.replace('{memoryId}', memoryId), {
    signal,
    query: {
      data_source_id: dataSourceId,
      next_token: nextToken,
    },
  });

export const getMLCommonsMessageTraces = async ({
  http,
  messageId,
  signal,
  dataSourceId,
  nextToken,
}: {
  http: CoreStart['http'];
  messageId: string;
  signal?: AbortSignal;
  dataSourceId?: string;
  nextToken?: number;
}) =>
  http.get(OBSERVABILITY_ML_COMMONS_API.messageTraces.replace('{messageId}', messageId), {
    signal,
    query: {
      data_source_id: dataSourceId,
      next_token: nextToken,
    },
  });
