/**
 * Calculates the Euclidean distance between two points (cities).
 * @param {object} cityA - The starting city with x, y coordinates.
 * @param {object} cityB - The destination city with x, y coordinates.
 * @returns {number} The distance between the two cities in map tiles.
 */
export function calculateDistance(cityA, cityB) {
    if (!cityA || !cityB) return 0;
    const dx = cityA.x - cityB.x;
    const dy = cityA.y - cityB.y;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculates the travel time in seconds based on distance, speed, and mode.
 * @param {number} distance - The distance to travel in map tiles.
 * @param {number} speed - The speed of the unit in tiles per hour.
 * @param {string|null} mode - The type of movement (e.g., 'scout', 'trade').
 * @returns {number} The travel time in seconds.
 */
export function calculateTravelTime(distance, speed, mode = null) {
    // #comment Special fast calculation for scout and trade modes
    if (mode === 'scout' || mode === 'trade') {
        const minTime = 15; // 15 seconds minimum
        const maxTime = 300; // 5 minutes maximum
        const timePerTile = 15; // 15 seconds per tile, making nearby islands very fast to reach
        return Math.max(minTime, Math.min(maxTime, distance * timePerTile));
    }

    // Regular calculation for other movements
    if (speed <= 0) return Infinity;
    const worldSpeedFactor = 5;
    const hours = distance / (speed * worldSpeedFactor);
    return hours * 3600; // Convert hours to seconds
}

/**
 * Formats a duration in seconds into a readable HH:MM:SS format.
 * @param {number} totalSeconds - The total seconds to format.
 * @returns {string} The formatted time string.
 */
export function formatTravelTime(totalSeconds) {
    if (totalSeconds === Infinity) return 'N/A';
    if (isNaN(totalSeconds)) return 'Invalid Time';

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);

    const pad = (num) => num.toString().padStart(2, '0');

    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}
