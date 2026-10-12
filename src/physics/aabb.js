const Vector3 = require('./vector3');

/**
 * Represents an Axis-Aligned Bounding Box (AABB).
 * Min and Max are Vector3 instances.
 * Follows Bedrock coordinate space (+X East, +Y Up, +Z South).
 */
class AABB {
    constructor(minX, minY, minZ, maxX, maxY, maxZ) {
        this.min = new Vector3(minX, minY, minZ);
        this.max = new Vector3(maxX, maxY, maxZ);
    }

    /**
     * Creates an AABB from a position and dimensions.
     * @param {Vector3} position - The center or origin of the AABB.
     * @param {Vector3} dimensions - The width, height, depth of the AABB.
     * @returns {AABB}
     */
    static fromPositionAndDimensions(position, dimensions) {
        const halfWidth = dimensions.x / 2;
        const halfHeight = dimensions.y / 2;
        const halfDepth = dimensions.z / 2;

        return new AABB(
            position.x - halfWidth,
            position.y - halfHeight,
            position.z - halfDepth,
            position.x + halfWidth,
            position.y + halfHeight,
            position.z + halfDepth
        );
    }

    /**
     * Returns the 8 spatial bounding vertices of the AABB.
     * Following Bedrock coordinate space (+X East, +Y Up, +Z South).
     * @returns {Vector3[]} An array of 8 Vector3 objects.
     */
    getVertices() {
        const { min, max } = this;
        return [
            new Vector3(min.x, min.y, min.z), // 0: minX, minY, minZ
            new Vector3(max.x, min.y, min.z), // 1: maxX, minY, minZ
            new Vector3(min.x, max.y, min.z), // 2: minX, maxY, minZ
            new Vector3(max.x, max.y, min.z), // 3: maxX, maxY, minZ
            new Vector3(min.x, min.y, max.z), // 4: minX, minY, maxZ
            new Vector3(max.x, min.y, max.z), // 5: maxX, minY, maxZ
            new Vector3(min.x, max.y, max.z), // 6: minX, maxY, maxZ
            new Vector3(max.x, max.y, max.z)  // 7: maxX, maxY, maxZ
        ];
    }

    /**
     * Checks if this AABB intersects with another AABB.
     * @param {AABB} other - The other AABB.
     * @returns {boolean} True if they intersect, false otherwise.
     */
    intersects(other) {
        return (
            this.min.x < other.max.x && this.max.x > other.min.x &&
            this.min.y < other.max.y && this.max.y > other.min.y &&
            this.min.z < other.max.z && this.max.z > other.min.z
        );
    }

    /**
     * Expands this AABB to include another AABB or a point.
     * @param {AABB|Vector3} other - The AABB or Vector3 to include.
     * @returns {AABB} A new AABB that encompasses both.
     */
    union(other) {
        let newMinX = Math.min(this.min.x, other.min.x);
        let newMinY = Math.min(this.min.y, other.min.y);
        let newMinZ = Math.min(this.min.z, other.min.z);
        let newMaxX = Math.max(this.max.x, other.max.x);
        let newMaxY = Math.max(this.max.y, other.max.y);
        let newMaxZ = Math.max(this.max.z, other.max.z);

        if (other instanceof Vector3) {
            newMinX = Math.min(this.min.x, other.x);
            newMinY = Math.min(this.min.y, other.y);
            newMinZ = Math.min(this.min.z, other.z);
            newMaxX = Math.max(this.max.x, other.x);
            newMaxY = Math.max(this.max.y, other.y);
            newMaxZ = Math.max(this.max.z, other.z);
        }

        return new AABB(newMinX, newMinY, newMinZ, newMaxX, newMaxY, newMaxZ);
    }
}

module.exports = AABB;
