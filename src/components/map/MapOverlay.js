// src/components/map/MapOverlay.js
import React, { useRef, useEffect } from 'react';

const MINIMAP_SIZE = 175; // The size of the minimap canvas in pixels

const MapOverlay = ({ mouseCoords, pan, zoom, viewportSize, worldState, playerCities }) => {
    const minimapRef = useRef(null);

    // #comment Calculate the sea name based on the center of the viewport
    const seaName = (() => {
        if (!viewportSize.width || !worldState) return 'Unknown Sea';
        const centerX = (-pan.x + viewportSize.width / 2) / (32 * zoom);
        const centerY = (-pan.y + viewportSize.height / 2) / (32 * zoom);
        const seaX = Math.floor(centerX / 100);
        const seaY = Math.floor(centerY / 100);
        return `Sea ${seaY}${seaX}`;
    })();

    // #comment Draw the minimap
    useEffect(() => {
        const canvas = minimapRef.current;
        if (!canvas || !worldState || !viewportSize.width) return;

        const ctx = canvas.getContext('2d');
        const { width: worldWidth, height: worldHeight, islands } = worldState;
        
        const scaleX = MINIMAP_SIZE / worldWidth;
        const scaleY = MINIMAP_SIZE / worldHeight;

        // Clear and draw background
        ctx.fillStyle = '#1e3a8a'; // Water color
        ctx.fillRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

        // Draw islands
        ctx.fillStyle = '#2a623d'; // Land color
        islands.forEach(island => {
            ctx.beginPath();
            ctx.arc(
                island.x * scaleX,
                island.y * scaleY,
                island.radius * Math.min(scaleX, scaleY),
                0,
                2 * Math.PI
            );
            ctx.fill();
        });

        // Draw player cities
        ctx.fillStyle = '#facc15'; // Yellow for player cities
        Object.values(playerCities).forEach(city => {
            ctx.fillRect(city.x * scaleX - 1, city.y * scaleY - 1, 3, 3);
        });
        
        // Draw viewport rectangle
        const viewRectX = -pan.x / (32 * zoom) * scaleX;
        const viewRectY = -pan.y / (32 * zoom) * scaleY;
        const viewRectWidth = (viewportSize.width / (32 * zoom)) * scaleX;
        const viewRectHeight = (viewportSize.height / (32 * zoom)) * scaleY;

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.strokeRect(viewRectX, viewRectY, viewRectWidth, viewRectHeight);

    }, [worldState, playerCities, pan, zoom, viewportSize]);


    return (
        <>
            <div className="minimap-container">
                <canvas ref={minimapRef} width={MINIMAP_SIZE} height={MINIMAP_SIZE} className="minimap-canvas"></canvas>
            </div>
            <div className="coords-info-container">
                <p>{seaName} ({mouseCoords.x}, {mouseCoords.y})</p>
            </div>
        </>
    );
};

export default MapOverlay;
