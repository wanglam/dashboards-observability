/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

export const isStateCompletedOrFailed = (state) => ['COMPLETED', 'FAILED'].includes(state);
