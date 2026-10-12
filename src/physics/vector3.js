// A minimal Vector3 implementation for physics calculations
class Vector3 {
    constructor(x = 0, y = 0, z = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    add(other) {
        return new Vector3(this.x + other.x, this.y + other.y, this.z + other.z);
    }

    subtract(other) {
        return new Vector3(this.x - other.x, this.y - other.y, this.z - other.z);
    }

    scale(scalar) {
        return new Vector3(this.x * scalar, this.y * scalar, this.z * scalar);
    }

    dot(other) {
        return this.x * other.x + this.y * other.y + this.z * other.z;
    }

    // Returns the magnitude (length) of the vector
    length() {
        return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    }

    // Returns a new vector with the same direction but a magnitude of 1
    normalize() {
        const len = this.length();
        if (len === 0) {
            return new Vector3(0, 0, 0);
        }
        return new Vector3(this.x / len, this.y / len, this.z / len);
    }

    clone() {
        return new Vector3(this.x, this.y, this.z);
    }

    equals(other) {
        return this.x === other.x && this.y === other.y && this.z === other.z;
    }
}

module.exports = Vector3;
