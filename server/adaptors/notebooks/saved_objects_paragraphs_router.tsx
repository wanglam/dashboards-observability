/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import now from 'performance-now';
import { v4 as uuid } from 'uuid';
import { SavedObjectsClientContract } from '../../../../../src/core/server/types';
import { NOTEBOOK_SAVED_OBJECT } from '../../../common/types/observability_saved_object_attributes';
import {
  DefaultOutput,
  DefaultParagraph,
} from '../../common/helpers/notebooks/default_notebook_schema';
import { formatNotRecognized, inputIsQuery } from '../../common/helpers/notebooks/query_helpers';
import { OpenSearchClient } from '../../../../../src/core/server';
import { constructDeepResearchParagraphOut } from '../../../common/utils/paragraph';

export function createNotebook(
  paragraphInput: string,
  inputType: string,
  paragraphResult?: string,
  dataSourceMDSId?: string,
  dataSourceMDSLabel?: string
) {
  try {
    let paragraphType = 'MARKDOWN';
    if (inputType === 'VISUALIZATION') {
      paragraphType = 'VISUALIZATION';
    }
    if (inputType === 'OBSERVABILITY_VISUALIZATION') {
      paragraphType = 'OBSERVABILITY_VISUALIZATION';
    }
    if (paragraphInput.substring(0, 3) === '%sql' || paragraphInput.substring(0, 3) === '%ppl') {
      paragraphType = 'QUERY';
    }
    if (inputType === 'DEEP_RESEARCH') {
      paragraphType = inputType;
    }
    const inputObject = {
      inputType: paragraphType,
      inputText: paragraphInput,
    };
    const outputObjects: DefaultOutput[] = [
      {
        outputType: paragraphType,
        result: paragraphResult ?? '',
        execution_time: '0s',
      },
    ];
    const newParagraph = {
      id: 'paragraph_' + uuid(),
      dateCreated: new Date().toISOString(),
      dateModified: new Date().toISOString(),
      input: inputObject,
      output: outputObjects,
      dataSourceMDSId,
      dataSourceMDSLabel,
    };

    return newParagraph;
  } catch (error) {
    throw new Error('Create Paragraph Error:' + error);
  }
}

export async function fetchNotebook(
  noteId: string,
  opensearchNotebooksClient: SavedObjectsClientContract
) {
  try {
    const notebook = await opensearchNotebooksClient.get(NOTEBOOK_SAVED_OBJECT, noteId);
    return notebook;
  } catch (error) {
    throw new Error('update Paragraph Error:' + error);
  }
}

export async function createParagraphs(
  params: {
    noteId: string;
    paragraphIndex: number;
    paragraphInput: string;
    inputType: string;
    paragraphResult?: string;
    dataSourceMDSId?: string;
    dataSourceMDSLabel?: string;
  },
  opensearchNotebooksClient: SavedObjectsClientContract
) {
  const notebookinfo = await fetchNotebook(params.noteId, opensearchNotebooksClient);
  const paragraphs = notebookinfo.attributes.savedNotebook.paragraphs;
  const newParagraph = createNotebook(
    params.paragraphInput,
    params.inputType,
    params.paragraphResult,
    params.dataSourceMDSId,
    params.dataSourceMDSLabel
  );
  paragraphs.splice(params.paragraphIndex, 0, newParagraph);
  const updateNotebook = {
    paragraphs,
    dateModified: new Date().toISOString(),
  };
  await opensearchNotebooksClient.update(NOTEBOOK_SAVED_OBJECT, params.noteId, {
    savedNotebook: updateNotebook,
  });
  await fetchNotebook(params.noteId, opensearchNotebooksClient);
  return newParagraph;
}

export async function clearParagraphs(
  params: { noteId: string },
  opensearchNotebooksClient: SavedObjectsClientContract
) {
  const notebookinfo = await fetchNotebook(params.noteId, opensearchNotebooksClient);
  const updatedparagraphs: DefaultParagraph[] = [];
  notebookinfo.attributes.savedNotebook.paragraphs.map((paragraph: DefaultParagraph) => {
    const updatedParagraph = { ...paragraph };
    updatedParagraph.output = [];
    updatedparagraphs.push(updatedParagraph);
  });
  const updateNotebook = {
    paragraphs: updatedparagraphs,
    dateModified: new Date().toISOString(),
  };
  try {
    await opensearchNotebooksClient.update(NOTEBOOK_SAVED_OBJECT, params.noteId, {
      savedNotebook: updateNotebook,
    });
    return { paragraphs: updatedparagraphs };
  } catch (error) {
    throw new Error('Clear Paragraph Error:' + error);
  }
}

export async function deleteParagraphs(
  params: { noteId: string; paragraphId: string | undefined },
  opensearchNotebooksClient: SavedObjectsClientContract
) {
  const notebookinfo = await fetchNotebook(params.noteId, opensearchNotebooksClient);
  const updatedparagraphs: DefaultParagraph[] = [];
  if (params.paragraphId !== undefined) {
    notebookinfo.attributes.savedNotebook.paragraphs.map((paragraph: DefaultParagraph) => {
      if (paragraph.id !== params.paragraphId) {
        updatedparagraphs.push(paragraph);
      }
    });
  }

  const updateNotebook = {
    paragraphs: updatedparagraphs,
    dateModified: new Date().toISOString(),
  };
  try {
    await opensearchNotebooksClient.update(NOTEBOOK_SAVED_OBJECT, params.noteId, {
      savedNotebook: updateNotebook,
    });
    return { paragraphs: updatedparagraphs };
  } catch (error) {
    throw new Error('update Paragraph Error:' + error);
  }
}

export async function updateRunFetchParagraph(
  params: {
    noteId: string;
    paragraphId: string;
    paragraphInput: string;
    paragraphType: string;
    dataSourceMDSId: string | undefined;
    dataSourceMDSLabel: string | undefined;
    deepResearchAgentId?: string | undefined;
    deepResearchContext?: string | undefined;
    deepResearchBaseMemoryId?: string | undefined;
    deepResearchBaseExecutorMemoryId?: string | undefined;
    deepResearchSystemPrompt?: string;
    deepResearchExecutorSystemPrompt?: string;
  },
  opensearchNotebooksClient: SavedObjectsClientContract,
  transport: OpenSearchClient['transport']
) {
  let deepResearchAgentId = params.deepResearchAgentId;
  if (!deepResearchAgentId) {
    try {
      const { body } = await transport.request({
        method: 'GET',
        path: '/_plugins/_ml/config/os_deep_research',
      });
      deepResearchAgentId = body.configuration.agent_id;
    } catch (error) {
      // Add error catch here..
    }
  }
  let sopAgentId: string | undefined;
  if (params.paragraphInput.substring(0, 4) === '%sop') {
    try {
      const { body } = await transport.request({
        method: 'GET',
        path: '/_plugins/_ml/config/os_sop',
      });
      sopAgentId = body.configuration.agent_id;
    } catch (error) {
      // Add error catch here..
    }
  }
  try {
    const notebookinfo = await fetchNotebook(params.noteId, opensearchNotebooksClient);
    const updatedInputParagraphs = updateParagraphs(
      notebookinfo.attributes.savedNotebook.paragraphs,
      params.paragraphId,
      params.paragraphInput,
      params.paragraphType,
      params.dataSourceMDSId,
      params.dataSourceMDSLabel
    );
    const updatedOutputParagraphs = await runParagraph(
      updatedInputParagraphs,
      params.paragraphId,
      transport,
      deepResearchAgentId,
      params.deepResearchContext,
      params.deepResearchBaseMemoryId,
      sopAgentId,
      params.deepResearchBaseExecutorMemoryId,
      params.deepResearchSystemPrompt,
      params.deepResearchExecutorSystemPrompt
    );

    const updateNotebook = {
      paragraphs: updatedOutputParagraphs,
      dateModified: new Date().toISOString(),
    };
    await opensearchNotebooksClient.update(NOTEBOOK_SAVED_OBJECT, params.noteId, {
      savedNotebook: updateNotebook,
    });
    let resultParagraph = {};
    let index = 0;

    for (index = 0; index < updatedOutputParagraphs.length; ++index) {
      if (params.paragraphId === updatedOutputParagraphs[index].id) {
        resultParagraph = updatedOutputParagraphs[index];
      }
    }
    return resultParagraph;
  } catch (error) {
    throw new Error('Update/Run Paragraph Error:' + error);
  }
}

export async function runParagraph(
  paragraphs: DefaultParagraph[],
  paragraphId: string,
  transport: OpenSearchClient['transport'],
  deepResearchAgentId: string | undefined,
  deepResearchContext: string | undefined,
  deepResearchBaseMemoryId: string | undefined,
  sopAgentId: string | undefined,
  deepResearchBaseExecutorMemoryId: string | undefined,
  deepResearchSystemPrompt: string | undefined,
  deepResearchExecutorSystemPrompt: string | undefined
) {
  try {
    const updatedParagraphs = [];
    let index = 0;
    for (index = 0; index < paragraphs.length; ++index) {
      const startTime = now();
      const updatedParagraph = { ...paragraphs[index] };
      const inputText = paragraphs[index].input.inputText;
      if (paragraphs[index].id === paragraphId) {
        updatedParagraph.dateModified = new Date().toISOString();
        if (inputIsQuery(inputText)) {
          updatedParagraph.output = [
            {
              outputType: 'QUERY',
              result: paragraphs[index].input.inputText.substring(
                4,
                paragraphs[index].input.inputText.length
              ),
              execution_time: `${(now() - startTime).toFixed(3)} ms`,
            },
          ];
        } else if (inputText.substring(0, 3) === '%md') {
          updatedParagraph.output = [
            {
              outputType: 'MARKDOWN',
              result: paragraphs[index].input.inputText.substring(
                4,
                paragraphs[index].input.inputText.length
              ),
              execution_time: `${(now() - startTime).toFixed(3)} ms`,
            },
          ];
        } else if (paragraphs[index].input.inputType === 'VISUALIZATION') {
          updatedParagraph.dateModified = new Date().toISOString();
          updatedParagraph.output = [
            {
              outputType: 'VISUALIZATION',
              result: '',
              execution_time: `${(now() - startTime).toFixed(3)} ms`,
            },
          ];
        } else if (paragraphs[index].input.inputType === 'OBSERVABILITY_VISUALIZATION') {
          updatedParagraph.dateModified = new Date().toISOString();
          updatedParagraph.output = [
            {
              outputType: 'OBSERVABILITY_VISUALIZATION',
              result: '',
              execution_time: `${(now() - startTime).toFixed(3)} ms`,
            },
          ];
        } else if (paragraphs[index].input.inputType === 'DEEP_RESEARCH') {
          if (!deepResearchAgentId) {
            throw new Error('No deep research agent id configured.');
          }
          updatedParagraph.dateModified = new Date().toISOString();
          const { body } = await transport.request({
            method: 'POST',
            path: `/_plugins/_ml/agents/${deepResearchAgentId}/_execute`,
            querystring: 'async=true',
            body: {
              parameters: {
                question: `${paragraphs[index].input.inputText}${
                  deepResearchContext ? `, Context: ${deepResearchContext}` : ''
                }`,
                memory_id: deepResearchBaseMemoryId,
                executor_agent_memory_id: deepResearchBaseExecutorMemoryId,
                system_prompt: deepResearchSystemPrompt,
                executor_system_prompt: deepResearchExecutorSystemPrompt,
              },
            },
          });
          updatedParagraph.output = [
            {
              outputType: 'DEEP_RESEARCH',
              result: JSON.stringify(
                constructDeepResearchParagraphOut({
                  taskId: body.task_id,
                  memoryId: body.response?.memory_id,
                  parentInteractionId: body.response?.parent_interaction_id,
                  agentId: deepResearchAgentId,
                  state: body.status,
                  baseMemoryId: deepResearchBaseMemoryId,
                  baseExecutorMemoryId: deepResearchBaseExecutorMemoryId,
                })
              ),
              execution_time: `${(now() - startTime).toFixed(3)} ms`,
            },
          ];
        } else if (inputText.substring(0, 4) === '%sop') {
          if (!sopAgentId) {
            throw new Error('No sop agent found.');
          }
          updatedParagraph.dateModified = new Date().toISOString();
          const question = inputText.substring(4);
          const { body: sopSearchBody } = await transport.request({
            method: 'POST',
            path: `/agentic-sop/_search`,
            body: {
              query: {
                multi_match: {
                  query: question,
                  fields: ['title^2', 'sop'],
                  type: 'best_fields',
                  fuzziness: 'AUTO',
                },
              },
              size: 1,
            },
          });
          const sop = sopSearchBody?.hits?.hits?.[0]?._source?.sop;

          if (!sop) {
            updatedParagraph.output = [
              {
                outputType: 'SOP',
                result: JSON.stringify({
                  state: 'FAILED',
                  textResponse: 'Failed to find related SOP, try another question',
                }),
                execution_time: `${(now() - startTime).toFixed(3)} ms`,
              },
            ];
            updatedParagraphs.push(updatedParagraph);
            break;
          }
          const { body } = await transport.request({
            method: 'POST',
            path: `/_plugins/_ml/agents/${sopAgentId}/_execute`,
            querystring: 'async=true',
            body: {
              parameters: {
                question: inputText,
                sop,
              },
            },
          });
          updatedParagraph.output = [
            {
              outputType: 'SOP',
              result: JSON.stringify({
                taskId: body.task_id,
                memoryId: body.response?.memory_id,
                parentInteractionId: body.response?.parent_interaction_id,
                agentId: sopAgentId,
                state: body.status,
                sop,
              }),
              execution_time: `${(now() - startTime).toFixed(3)} ms`,
            },
          ];
        } else if (formatNotRecognized(inputText)) {
          updatedParagraph.output = [
            {
              outputType: 'MARKDOWN',
              result: 'Please select an input type (%sql, %ppl, or %md)',
              execution_time: `${(now() - startTime).toFixed(3)} ms`,
            },
          ];
        }
      }
      updatedParagraphs.push(updatedParagraph);
    }
    return updatedParagraphs;
  } catch (error) {
    throw new Error('Running Paragraph Error:' + error);
  }
}

export function updateParagraphs(
  paragraphs: DefaultParagraph[],
  paragraphId: string,
  paragraphInput?: string,
  paragraphType?: string,
  dataSourceMDSId?: string,
  dataSourceMDSLabel?: string,
  paragraphOutput?: DefaultOutput[]
) {
  try {
    const updatedParagraphs: DefaultParagraph[] = [];
    paragraphs.map((paragraph: DefaultParagraph) => {
      const updatedParagraph = { ...paragraph };
      if (paragraph.id === paragraphId) {
        updatedParagraph.dataSourceMDSId = dataSourceMDSId ?? paragraph.dataSourceMDSId;
        updatedParagraph.dataSourceMDSLabel = dataSourceMDSLabel ?? paragraph.dataSourceMDSId;
        updatedParagraph.dateModified = new Date().toISOString();
        if (paragraphInput) {
          updatedParagraph.input.inputText = paragraphInput;
        }
        if (paragraphType && paragraphType.length > 0) {
          updatedParagraph.input.inputType = paragraphType;
        }
        if (paragraphOutput) {
          updatedParagraph.output = paragraphOutput;
        }
      }
      updatedParagraphs.push(updatedParagraph);
    });
    return updatedParagraphs;
  } catch (error) {
    throw new Error('Update Paragraph Error:' + error);
  }
}

export async function updateFetchParagraph(
  params: {
    noteId: string;
    paragraphId: string;
    paragraphInput: string;
    paragraphOutput?: DefaultOutput[];
  },
  opensearchNotebooksClient: SavedObjectsClientContract
) {
  try {
    const notebookinfo = await fetchNotebook(params.noteId, opensearchNotebooksClient);
    const updatedInputParagraphs = updateParagraphs(
      notebookinfo.attributes.savedNotebook.paragraphs,
      params.paragraphId,
      params.paragraphInput,
      undefined,
      undefined,
      undefined,
      params.paragraphOutput
    );

    const updateNotebook = {
      paragraphs: updatedInputParagraphs,
      dateModified: new Date().toISOString(),
    };
    await opensearchNotebooksClient.update(NOTEBOOK_SAVED_OBJECT, params.noteId, {
      savedNotebook: updateNotebook,
    });
    let resultParagraph = {};
    updatedInputParagraphs.map((paragraph: DefaultParagraph) => {
      if (params.paragraphId === paragraph.id) {
        resultParagraph = paragraph;
      }
    });
    return resultParagraph;
  } catch (error) {
    throw new Error('update Paragraph Error:' + error);
  }
}
