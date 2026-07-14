export interface SourceRange {
  readonly from: number;
  readonly to: number;
}

interface MarkBase {
  readonly id: string;
  readonly source: SourceRange;
  readonly opener: SourceRange;
  readonly closer: SourceRange;
}

export interface AdditionMark extends MarkBase {
  readonly kind: 'addition';
  readonly content: string;
  readonly contentRange: SourceRange;
}

export interface DeletionMark extends MarkBase {
  readonly kind: 'deletion';
  readonly content: string;
  readonly contentRange: SourceRange;
}

export interface HighlightMark extends MarkBase {
  readonly kind: 'highlight';
  readonly content: string;
  readonly contentRange: SourceRange;
}

export interface SubstitutionMark extends MarkBase {
  readonly kind: 'substitution';
  readonly original: string;
  readonly originalRange: SourceRange;
  readonly replacement: string;
  readonly replacementRange: SourceRange;
  readonly separator: SourceRange;
}

export interface CommentMark extends MarkBase {
  readonly kind: 'comment';
  readonly author: string | null;
  readonly body: string;
  readonly bodyRange: SourceRange;
  readonly payload: string;
  readonly payloadRange: SourceRange;
}

export type SuggestionMark = AdditionMark | DeletionMark | SubstitutionMark;
export type AnchorMark = SuggestionMark | HighlightMark;
export type CriticMark = AnchorMark | CommentMark;

export interface ReviewItem {
  readonly id: string;
  readonly kind: 'suggestion' | 'comment';
  readonly mark: AnchorMark | null;
  readonly messages: readonly CommentMark[];
  readonly source: SourceRange;
  readonly threadRange: SourceRange | null;
  readonly anchor: SourceRange;
  readonly point: boolean;
}

export interface ParsedDocument {
  readonly source: string;
  readonly marks: readonly CriticMark[];
  readonly reviews: readonly ReviewItem[];
}

export interface SourceEdit extends SourceRange {
  readonly insert: string;
}
