export interface AnchorRect {
  readonly top: number;
  readonly bottom: number;
}

export interface LayoutMeasurement {
  readonly id: string;
  readonly naturalTop: number;
  readonly height: number;
  readonly anchorRect: AnchorRect;
}

export interface LayoutItem extends LayoutMeasurement {
  readonly top: number;
  readonly desiredTop: number;
  readonly automaticDesiredTop: number;
  readonly groupKey?: string;
  readonly groupProgress?: number;
  readonly groupEffectiveProgress?: number;
  readonly groupTravel?: number;
  readonly focusedTargetTop?: number;
}

export interface MutableLayoutItem {
  id: string;
  naturalTop: number;
  height: number;
  anchorRect: AnchorRect;
  top: number;
  desiredTop: number;
  automaticDesiredTop: number;
  groupKey?: string;
  groupProgress?: number;
  groupEffectiveProgress?: number;
  groupTravel?: number;
  focusedTargetTop?: number;
}

export interface LayoutGeometry {
  readonly railHeight: number;
  readonly documentTop: number;
  readonly documentBottom: number;
}

export interface ExpandedLayout {
  readonly items: readonly LayoutItem[];
  readonly pivotIndex: number;
  readonly sharedAnchorId: string | null;
  readonly layoutAnchorId: string | null;
  readonly absorbedCollisionKeys: readonly string[];
}

export interface ReviewScrollState {
  readonly focusedReviewId: string | null;
  readonly driverId: string | null;
  readonly visibleAnchorId: string | null;
  readonly scrollDirection: number;
  readonly collisionProgressOffsets: ReadonlyMap<string, number>;
  readonly tallThreadOffsets: ReadonlyMap<string, number>;
}

export interface ScrollStateOverrides {
  readonly focusedReviewId?: string | null;
  readonly driverId?: string | null;
  readonly visibleAnchorId?: string | null;
  readonly scrollDirection?: number;
  readonly collisionProgressOffsets?: ReadonlyMap<string, number>;
  readonly tallThreadOffsets?: ReadonlyMap<string, number>;
}

export interface ExpandedSnapshot {
  readonly layout: ExpandedLayout;
  readonly state: ReviewScrollState;
}

export interface ComputeSnapshotOptions {
  readonly scrollMoved?: boolean;
}

export interface ScrollTransition {
  readonly state: ReviewScrollState;
  readonly documentDelta: number;
  readonly needsCollisionProgress: boolean;
}

export interface ProgressTransition {
  readonly state: ReviewScrollState;
  readonly changed: boolean;
}
