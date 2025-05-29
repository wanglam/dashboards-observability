/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { EuiSelect } from '@elastic/eui';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CoreStart } from '../../../../../../../src/core/public';
import { OBSERVABILITY_ML_COMMONS_API } from '../../../../../common/constants/ml_commons';

export const AgentsSelector = ({
  dataSourceMDSId,
  http,
  value,
  onChange,
}: {
  dataSourceMDSId: string;
  http: CoreStart['http'];
  value: string | undefined;
  onChange: (value: string | undefined) => void;
}) => {
  const [agents, setAgents] = useState([]);
  const valueRef = useRef(value);

  useEffect(() => {
    let canceled = false;
    http
      .get(OBSERVABILITY_ML_COMMONS_API.agents, {
        query: {
          data_source_id: dataSourceMDSId,
          types: 'plan_execute_and_reflect',
        },
      })
      .then(({ hits }) => {
        if (!canceled) {
          const agentResults = hits.hits.map(({ _id, _source: { name } }) => ({ id: _id, name }));
          setAgents(agentResults);
          if (!valueRef.current) {
            onChange(agentResults[0]?.id);
          }
        }
      });
    return () => {
      canceled = true;
    };
  }, [http, dataSourceMDSId]);

  const options = useMemo(
    () => [
      { text: 'Select a agent', value: undefined, selected: value === undefined, disabled: true },
      ...agents.map(({ id, name }) => ({ text: name, value: id, selected: id === value })),
    ],
    [agents, value]
  );

  return (
    <EuiSelect
      prepend="Agent"
      options={options}
      onChange={(e) => {
        onChange(e.target.value);
      }}
    />
  );
};
