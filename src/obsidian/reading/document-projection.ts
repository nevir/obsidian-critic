import {
  projectCriticMarkup,
  type ReviewProjection,
} from '../../core/projection';

export interface PreparedReadingDocument {
  readonly markdown: string;
  readonly projected: string;
}

export function prepareReadingDocument(
  source: string,
  projection: ReviewProjection,
): PreparedReadingDocument | null {
  const projected = projectCriticMarkup(source, projection);
  if (projected === source) return null;
  return { markdown: projected, projected };
}
