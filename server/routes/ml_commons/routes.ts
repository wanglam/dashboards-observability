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
   * Returns single task detailed.
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

  /**
   * Returns list of agents
   */
  router.get(
    {
      path: OBSERVABILITY_ML_COMMONS_API.agents,
      validate: {
        query: schema.maybe(
          schema.object({
            data_source_id: schema.maybe(schema.string()),
            types: schema.maybe(schema.oneOf([schema.string(), schema.arrayOf(schema.string())])),
          })
        ),
      },
    },
    async (context, request, response) => {
      const transport = await getOpenSearchClientTransport({
        context,
        dataSourceId: request.query?.data_source_id,
      });
      const types = Array.isArray(request.query?.types)
        ? request.query.types
        : request.query?.types
        ? [request.query.types]
        : [];
      try {
        const { body } = await transport.request({
          method: 'POST',
          path: OPENSEARCH_ML_COMMONS_API.agentsSearch,
          body: types
            ? {
                query: {
                  terms: {
                    type: types,
                  },
                },
              }
            : {},
        });
        return response.ok({ body });
      } catch (e) {
        if (e.meta.body.status === 404) {
          return response.ok({ body: { hits: { hits: [] } } });
        }
        return response.badRequest({ body: e.message });
      }
    }
  );
}
