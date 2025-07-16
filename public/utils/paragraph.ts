/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

export const parseParagraphOut = (paragraph) => {
  if (Array.isArray(paragraph.out)) {
    const result = new Array(paragraph.out.length);
    for (let i = 0; i < paragraph.out.length; i++) {
      if (!paragraph.out[i]) {
        continue;
      }
      try {
        result[i] = JSON.parse(paragraph.out[i]);
      } catch (e) {
        console.error(`Failed to parse paragraph.out[${i}]: ${paragraph.out[i]}`);
      }
    }
    return result;
  }
  return [];
};
