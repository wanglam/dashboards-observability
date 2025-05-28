/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { getMLCommonsMessageTraces } from './apis';

export interface Trace {
  input: string;
  response?: string;
}

export const getAllTracesByMessageId = async (
  options: Omit<Parameters<typeof getMLCommonsMessageTraces>[0], 'nextToken'>
) => {
  const traces: Trace[] = [];
  let nextToken;
  do {
    try {
      const result = await getMLCommonsMessageTraces({
        ...options,
        nextToken,
      });
      result.traces.forEach((trace: Trace) => {
        traces.push(trace);
      });
      nextToken = result.next_token;
    } catch (e) {
      console.error(e);
      break;
    }
  } while (!!nextToken);
  return traces;
};
