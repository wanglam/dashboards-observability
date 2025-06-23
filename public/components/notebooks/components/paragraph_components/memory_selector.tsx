/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { EuiSelect } from '@elastic/eui';
import React, { useMemo } from 'react';
import _ from 'lodash';

export const MemorySelector = ({
  memoryIds,
  value,
  onChange,
}: {
  memoryIds: string[];
  value: string | undefined;
  onChange: (value: string | undefined) => void;
}) => {
  const options = useMemo(
    () => [
      { text: 'Select a memory ID', value: undefined },
      ...memoryIds.map((memoryId) => ({
        text: memoryId,
        value: memoryId,
      })),
    ],
    [memoryIds, value]
  );

  return (
    <EuiSelect
      prepend="Base memory"
      value={value}
      options={options}
      onChange={(e) => {
        onChange(e.target.value);
      }}
    />
  );
};
