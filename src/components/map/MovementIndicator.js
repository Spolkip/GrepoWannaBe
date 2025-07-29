import React from 'react';
import { motion } from 'framer-motion';

const TILE_SIZE = 32; // Assuming TILE_SIZE is consistent across map components
// Import unitConfig if needed for unit details, but it's not directly used in rendering here.
// import unitConfig from '../../gameData/units.json'; 

// MovementIndicator component visually represents ongoing troop movements on the map.
const MovementIndicator = React.memo(({ movement, citySlots, allMovements = [] }) => {
    // Ensure movement and citySlots data are available
    if (!movement || !citySlots) return null;

    const originCity = citySlots[movement.originCityId];
    const targetCity = citySlots[movement.targetCityId];
    
    // Ensure both origin and target cities exist in citySlots
    if (!originCity || !targetCity) return null;

    // Calculate departure and arrival times, defaulting to now if not available
    const departureTime = movement.departureTime?.toDate().getTime() || Date.now();
    const arrivalTime = movement.arrivalTime?.toDate().getTime() || Date.now();
    const now = Date.now();
    
    // Calculate movement progress (0 to 1)
    let progress = 0;
    if (now < departureTime) progress = 0; // Movement hasn't started
    else if (now > arrivalTime) progress = 1; // Movement has arrived
    else progress = (now - departureTime) / (arrivalTime - departureTime); // Calculate current progress

    // Calculate pixel coordinates for origin and target cities
    const originX = originCity.x * TILE_SIZE + TILE_SIZE / 2;
    const originY = originCity.y * TILE_SIZE + TILE_SIZE / 2;
    const targetX = targetCity.x * TILE_SIZE + TILE_SIZE / 2;
    const targetY = targetCity.y * TILE_SIZE + TILE_SIZE / 2;

    // Calculate current position of the indicator based on progress
    const currentX = originX + (targetX - originX) * progress;
    const currentY = originY + (targetY - originY) * progress;

    // Calculate remaining travel time in seconds for animation duration
    const remainingTime = Math.max(0, (arrivalTime - now) / 1000);
    
    // Calculate size of the indicator based on total units (visual representation of army size)
    // unitConfig would be needed here if calculating totalUnits based on individual unit sizes
    const totalUnits = movement.units ? Object.values(movement.units).reduce((sum, count) => sum + count, 0) : 0;
    const size = Math.min(24, 8 + Math.sqrt(totalUnits) * 2); // Cap size at 24px

    // Define configurations for different movement types (color, icon, line color)
    const movementTypes = {
        attack: { color: '#ef4444', icon: '⚔️', lineColor: '#ef4444' },
        reinforce: { color: '#3b82f6', icon: '🛡️', lineColor: '#3b82f6' },
        scout: { color: '#10b981', icon: '👁️', lineColor: '#10b981' },
        trade: { color: '#f59e0b', icon: '💰', lineColor: '#f59e0b' },
        default: { color: '#6b7280', icon: '➡️', lineColor: '#6b7280' }
    };

    const config = movementTypes[movement.type] || movementTypes.default; // Get config for current movement type

    // Find overlapping movements (going between same cities) to adjust line appearance
    const overlappingMovements = (Array.isArray(allMovements)) ? allMovements.filter(m => {
        if (!m || m.id === movement.id) return false; // Exclude self and invalid movements
        return (
            (m.originCityId === movement.originCityId && m.targetCityId === movement.targetCityId) ||
            (m.originCityId === movement.targetCityId && m.targetCityId === movement.originCityId)
        );
    }) : [];

    // Calculate blended color for overlapping movements (simple average of RGB)
    const getBlendedColor = () => {
        if (overlappingMovements.length === 0) return config.lineColor;
        
        const colors = [config.lineColor];
        overlappingMovements.forEach(m => {
            if (!m) return;
            const otherConfig = movementTypes[m.type] || movementTypes.default;
            colors.push(otherConfig.lineColor);
        });

        const blended = colors.reduce((acc, color) => {
            if (!color) return acc;
            const hex = color.replace('#', '');
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            return {
                r: acc.r + r,
                g: acc.g + g,
                b: acc.b + b,
                count: acc.count + 1
            };
        }, { r: 0, g: 0, b: 0, count: 0 });

        const avgR = Math.round(blended.r / blended.count);
        const avgG = Math.round(blended.g / blended.count);
        const avgB = Math.round(blended.b / blended.count);

        return `#${avgR.toString(16).padStart(2, '0')}${avgG.toString(16).padStart(2, '0')}${avgB.toString(16).padStart(2, '0')}`;
    };

    const lineColor = getBlendedColor();
    const lineWidth = 3 + (overlappingMovements.length * 1.5); // Thicker line for more overlaps

    return (
        <>
            {/* Movement line - shown for all movement types */}
            <div 
                className="absolute z-20"
                style={{
                    left: originX,
                    top: originY,
                    width: Math.sqrt(Math.pow(targetX - originX, 2) + Math.pow(targetY - originY, 2)), // Length of the line
                    height: lineWidth,
                    backgroundColor: lineColor,
                    opacity: 0.7,
                    transformOrigin: '0 0', // Rotate from the origin city
                    transform: `rotate(${Math.atan2(targetY - originY, targetX - originX)}rad)`, // Rotate to point towards target
                }}
            />
            
            {/* Movement indicator (animated dot/icon) */}
            <motion.div
                className="absolute z-30 flex items-center justify-center"
                style={{
                    left: currentX - size / 2, // Center the indicator
                    top: currentY - size / 2, // Center the indicator
                    width: size,
                    height: size,
                    backgroundColor: `${config.color}80`, // 50% opacity background
                    borderRadius: '50%', // Make it a circle
                    border: `2px solid ${config.color}`, // Solid border
                    fontSize: size * 0.6, // Adjust icon size based on indicator size
                }}
                // Animate the position from origin to target based on remaining time
                animate={{
                    x: [0, (targetX - originX) * (1 - progress)],
                    y: [0, (targetY - originY) * (1 - progress)],
                }}
                transition={{
                    duration: remainingTime, // Duration is remaining time
                    ease: "linear" // Linear movement
                }}
                whileHover={{ scale: 1.2 }} // Scale up on hover
            >
                {config.icon} {/* Display movement type icon */}
            </motion.div>
        </>
    );
});

export default MovementIndicator;
