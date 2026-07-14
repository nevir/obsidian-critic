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
  readonly groupKey?: string;
  readonly groupProgress?: number;
  readonly groupTravel?: number;
}

export interface WorkingLayoutItem extends LayoutMeasurement {
  top: number;
  desiredTop: number;
  automaticDesiredTop: number;
  groupKey?: string;
  groupProgress?: number;
  groupTravel?: number;
}

export interface LayoutGeometry {
  readonly railHeight: number;
  readonly documentTop: number;
  readonly documentBottom: number;
}

export interface ExpandedLayout {
  readonly items: readonly LayoutItem[];
  readonly pivotIndex: number;
}

export interface ReviewScrollState {
  readonly focusedReviewId: string | null;
  readonly driverId: string | null;
  readonly scrollDirection: number;
  readonly collisionProgressOffsets: ReadonlyMap<string, number>;
  readonly tallThreadOffsets: ReadonlyMap<string, number>;
}

export interface ScrollStateOverrides {
  readonly focusedReviewId?: string | null;
  readonly driverId?: string | null;
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
