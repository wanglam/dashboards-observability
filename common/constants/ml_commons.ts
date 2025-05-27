/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

const OBSERVABILITY_ML_COMMONS_API_PREFIX = '/api/observability/ml-commons';
export const OBSERVABILITY_ML_COMMONS_API = {
  singleTask: `${OBSERVABILITY_ML_COMMONS_API_PREFIX}/tasks/{taskId}`,
  agents: `${OBSERVABILITY_ML_COMMONS_API_PREFIX}/agents`,
  memory: `${OBSERVABILITY_ML_COMMONS_API_PREFIX}/memory`,
  singleMemory: `${OBSERVABILITY_ML_COMMONS_API_PREFIX}/memory/{memoryId}`,
  memoryMessages: `${OBSERVABILITY_ML_COMMONS_API_PREFIX}/memory/{memoryId}/messages`,
  messageTraces: `${OBSERVABILITY_ML_COMMONS_API_PREFIX}/memory/message/{messageId}/traces`,
};

const OPENSEARCH_ML_COMMONS_API_PREFIX = '/_plugins/_ml';

export const OPENSEARCH_ML_COMMONS_API = {
  singleTask: `${OPENSEARCH_ML_COMMONS_API_PREFIX}/tasks/{taskId}`,
  agentsSearch: `${OPENSEARCH_ML_COMMONS_API_PREFIX}/agents/_search`,
  memorySearch: `${OPENSEARCH_ML_COMMONS_API_PREFIX}/memory/_search`,
  singleMemory: `${OPENSEARCH_ML_COMMONS_API_PREFIX}/memory/{memoryId}`,
  memoryMessages: `${OPENSEARCH_ML_COMMONS_API_PREFIX}/memory/{memoryId}/messages`,
  messageTraces: `${OPENSEARCH_ML_COMMONS_API_PREFIX}/memory/message/{messageId}/traces`,
};
