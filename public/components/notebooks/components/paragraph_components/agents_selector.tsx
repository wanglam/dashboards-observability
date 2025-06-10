/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { EuiSelect } from '@elastic/eui';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import _ from 'lodash';

import { CoreStart } from '../../../../../../../src/core/public';
import { OBSERVABILITY_ML_COMMONS_API } from '../../../../../common/constants/ml_commons';

// Create a debounced request function that's memoized by data source ID
const fetchAgents = _.memoize(
  (dataSourceMDSId, types = 'plan_execute_and_reflect', http: CoreStart['http']) => {
    // Return a promise that will be resolved with the HTTP response
    return new Promise((resolve, reject) => {
      // Schedule the actual HTTP request with debounce
      const makeRequest = _.debounce(
        () => {
          http
            .get(OBSERVABILITY_ML_COMMONS_API.agents, {
              query: {
                data_source_id: dataSourceMDSId,
                types,
              },
            })
            .then(resolve)
            .catch(reject)
            .finally(() => {
              // Clear this entry from the memoize cache after request completes
              fetchAgents.cache.delete(`${dataSourceMDSId}:${types}`);
            });
        },
        50,
        { leading: false, trailing: true }
      );

      // Trigger the debounced request
      makeRequest();
    });
  },
  // Custom resolver function for memoization key
  (dataSourceMDSId, types = 'plan_execute_and_reflect') => `${dataSourceMDSId}:${types}`
);

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
    fetchAgents(dataSourceMDSId, 'plan_execute_and_reflect', http).then(({ hits }) => {
      if (!canceled) {
        const agentResults = hits.hits.map(({ _id, _source: { name } }) => ({ id: _id, name }));
        setAgents(agentResults);
        if (!valueRef.current) {
          const recommendAgent = agentResults.find(
            ({ name }) => name.includes('3.7') && name.includes('ppl')
          );
          onChange(recommendAgent?.id ?? agentResults[0]?.id);
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
