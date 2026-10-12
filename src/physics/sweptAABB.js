const Vector3 = require('./vector3');
const AABB = require('./aabb');

/**
 * Calculates the broadphase AABB for a moving AABB.
 * This is an AABB that encompasses the moving AABB's start and end positions.
 * @param {AABB} aabb - The initial AABB of the moving object.
 * @param {Vector3} velocity - The velocity vector of the moving object.
 * @returns {AABB} The broadphase AABB.
 */
function getSweptBroadphaseBox(aabb, velocity) {
    const minX = Math.min(aabb.min.x, aabb.min.x + velocity.x);
    const minY = Math.min(aabb.min.y, aabb.min.y + velocity.y);
    const minZ = Math.min(aabb.min.z, aabb.min.z + velocity.z);

    const maxX = Math.max(aabb.max.x, aabb.max.x + velocity.x);
    const maxY = Math.max(aabb.max.y, aabb.max.y + velocity.y);
    const maxZ = Math.max(aabb.max.z, aabb.max.z + velocity.z);

    return new AABB(minX, minY, minZ, maxX, maxY, maxZ);
}

/**
 * Performs a swept AABB collision detection between a moving AABB and a static AABB.
 * Based on the algorithm by Kasper Fauerby and others.
 *
 * @param {AABB} movingAABB - The AABB of the moving object (at its start position).
 * @param {AABB} staticAABB - The AABB of the static object.
 * @param {Vector3} velocity - The velocity vector of the moving object for the current time step.
 * @returns {object|null} An object { toi: number, normal: Vector3 } if a collision occurs,
 *                        where 'toi' is the time of impact (0-1) and 'normal' is the collision normal.
 *                        Returns null if no collision occurs within the time step.
 */
function sweptAABB(movingAABB, staticAABB, velocity) {
    // If there's no velocity, no sweep is needed. Check for immediate overlap.
    if (velocity.x === 0 && velocity.y === 0 && velocity.z === 0) {
        if (movingAABB.intersects(staticAABB)) {
            // Already overlapping, treat as collision at t=0 with an arbitrary normal
            // (e.g., push out along the smallest overlap axis, or just return a default)
            // For this problem, we'll assume we're looking for *new* collisions.
            // If already overlapping, it means the entity is stuck, which might be handled by a separate push-out logic.
            // For swept AABB, we typically want to find the *first* time of contact.
            // If they are already intersecting, tEntry will be <= 0.
            // We'll return null here, as the entity is already "colliding" and not "sweeping into" it.
            return null;
        }
        return null;
    }

    // Calculate the relative velocity
    const relativeVelocity = velocity;

    // Calculate entry and exit times for each axis
    let tEntryX, tExitX;
    if (relativeVelocity.x > 0) {
        tEntryX = (staticAABB.min.x - movingAABB.max.x) / relativeVelocity.x;
        tExitX = (staticAABB.max.x - movingAABB.min.x) / relativeVelocity.x;
    } else {
        tEntryX = (staticAABB.max.x - movingAABB.min.x) / relativeVelocity.x;
        tExitX = (staticAABB.min.x - movingAABB.max.x) / relativeVelocity.x;
    }

    let tEntryY, tExitY;
    if (relativeVelocity.y > 0) {
        tEntryY = (staticAABB.min.y - movingAABB.max.y) / relativeVelocity.y;
        tExitY = (staticAABB.max.y - movingAABB.min.y) / relativeVelocity.y;
    } else {
        tEntryY = (staticAABB.max.y - movingAABB.min.y) / relativeVelocity.y;
        tExitY = (staticAABB.min.y - movingAABB.max.y) / relativeVelocity.y;
    }

    let tEntryZ, tExitZ;
    if (relativeVelocity.z > 0) {
        tEntryZ = (staticAABB.min.z - movingAABB.max.z) / relativeVelocity.z;
        tExitZ = (staticAABB.max.z - movingAABB.min.z) / relativeVelocity.z;
    } else {
        tEntryZ = (staticAABB.max.z - movingAABB.min.z) / relativeVelocity.z;
        tExitZ = (staticAABB.min.z - movingAABB.max.z) / relativeVelocity.z;
    }

    // Find the largest entry time and smallest exit time
    const tEntry = Math.max(tEntryX, tEntryY, tEntryZ);
    const tExit = Math.min(tExitX, tExitY, tExitZ);

    // No collision if:
    // 1. The AABBs are moving away from each other (tEntry > tExit)
    // 2. The collision happens after the current time step (tEntry >= 1)
    // 3. The AABBs are already separated at the start of the time step and won't collide (tExit < 0)
    if (tEntry > tExit || tEntry >= 1 || tExit < 0) {
        return null;
    }

    // If tEntry is negative, it means the AABBs are already overlapping.
    // We're looking for the *first* time of impact during the sweep (0 to 1).
    // If tEntry < 0, it means they were overlapping at t=0.
    // For a "swept" collision, we usually want to find the first contact *during* the sweep.
    // If they are already overlapping, it's not a "new" collision from the sweep perspective.
    // However, if the problem implies "resolve existing overlap", then tEntry=0 might be valid.
    // For typical CCD, we want tEntry >= 0.
    // Let's adjust tEntry to be 0 if it's slightly negative due to floating point inaccuracies
    // or if we want to consider immediate overlap as a collision at t=0.
    const toi = Math.max(0, tEntry);

    // Determine the collision normal
    let normal = new Vector3(0, 0, 0);
    if (toi === tEntryX) {
        normal.x = relativeVelocity.x > 0 ? -1 : 1;
    } else if (toi === tEntryY) {
        normal.y = relativeVelocity.y > 0 ? -1 : 1;
    } else if (toi === tEntryZ) {
        normal.z = relativeVelocity.z > 0 ? -1 : 1;
    }

    return { toi, normal };
}

module.exports = {
    Vector3, // Export Vector3 and AABB for convenience in tests
    AABB,
    getSweptBroadphaseBox,
    sweptAABB
};
