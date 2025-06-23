/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

export const parseParagraphOut = (paragraph) => {
  if (Array.isArray(paragraph.out)) {
    const result = [];
    for (let i = 0; i < paragraph.out.length; i++) {
      try {
        result.push(JSON.parse(paragraph.out[i]));
      } catch (e) {
        console.error(`Failed to parse paragraph.out[${i}]: ${paragraph.out[i]}`);
      }
    }
    return result;
  }
  return [];
};
