/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { schema } from '@osd/config-schema';
import { IRouter } from '../../../../../src/core/server';
import {
  OBSERVABILITY_ML_COMMONS_API,
  OPENSEARCH_ML_COMMONS_API,
} from '../../../common/constants/ml_commons';
import { getOpenSearchClientTransport } from '../utils';

export function registerMLCommonsRoutes(router: IRouter) {
  /**
   * Returns whether the PPL agent is configured.
   */
  router.get(
    {
      path: OBSERVABILITY_ML_COMMONS_API.singleTask,
      validate: {
        params: schema.object({
          taskId: schema.string(),
        }),
        query: schema.maybe(
          schema.object({
            data_source_id: schema.maybe(schema.string()),
          })
        ),
      },
    },
    async (context, request, response) => {
      const transport = await getOpenSearchClientTransport({
        context,
        dataSourceId: request.query?.data_source_id,
      });
      try {
        const { body } = await transport.request({
          method: 'GET',
          path: OPENSEARCH_ML_COMMONS_API.singleTask.replace('{taskId}', request.params.taskId),
        });
        return response.ok({ body });
      } catch (e) {
        return response.badRequest({ body: e.message });
      }
    }
  );
}
