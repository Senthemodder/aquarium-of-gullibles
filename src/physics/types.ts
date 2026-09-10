/**
 * Represents a point or directional vector in three-dimensional space.
 */
export interface Vector3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * Axis-aligned bounding box defined by minimum and maximum spatial extents.
 */
export interface AABB {
  readonly min: Vector3;
  readonly max: Vector3;
}

/**
 * The 8 spatial bounding vertices of an AABB in Bedrock coordinate space (+X East, +Y Up, +Z South).
 */
export interface BedrockSpatialVertices {
  readonly bottomWestNorth: Vector3;
  readonly bottomEastNorth: Vector3;
  readonly topWestNorth: Vector3;
  readonly topEastNorth: Vector3;
  readonly bottomWestSouth: Vector3;
  readonly bottomEastSouth: Vector3;
  readonly topWestSouth: Vector3;
  readonly topEastSouth: Vector3;
  readonly vertices: readonly [
    Vector3,
    Vector3,
    Vector3,
    Vector3,
    Vector3,
    Vector3,
    Vector3,
    Vector3
  ];
  readonly center: Vector3;
  readonly extents: Vector3;
}

/**
 * Outcome of continuous collision detection between a moving box and an obstacle.
 */
export interface SweptHit {
  readonly hasCollision: boolean;
  readonly timeOfImpact: number;
  readonly normal: Vector3;
  readonly contactPoint: Vector3;
  readonly boxAtImpact: AABB;
  readonly initialOverlap: boolean;
  readonly obstacleIndex?: number;
}

/**
 * Sub-tick kinematic state used for synchronizing client-interpolated hitboxes.
 */
export interface KinematicTrajectoryPoint {
  readonly tickFraction: number;
  readonly position: Vector3;
  readonly box: AABB;
  readonly vertices: BedrockSpatialVertices;
}

/**
 * Multi-step kinematic trajectory resolution under high-speed projection.
 */
export interface KinematicProjectionResult {
  readonly initialBox: AABB;
  readonly targetVelocity: Vector3;
  readonly finalBox: AABB;
  readonly remainingVelocity: Vector3;
  readonly displacement: Vector3;
  readonly hits: readonly SweptHit[];
  readonly onGround: boolean;
  readonly collidedHorizontally: boolean;
  readonly collidedVertically: boolean;
  readonly ghostTeleportationPrevented: boolean;
  readonly trajectory: readonly KinematicTrajectoryPoint[];
}

/**
 * Configuration options for kinematic continuous collision projection.
 */
export interface ProjectionOptions {
  readonly maxIterations?: number;
  readonly skinWidth?: number;
  readonly clientInterpolationSubsteps?: number;
}
