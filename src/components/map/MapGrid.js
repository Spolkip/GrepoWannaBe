import React, { useMemo } from 'react';
import { WaterTile, LandTile, CitySlotTile, FarmingVillageTile } from './Tiles';
import MovementIndicator from './MovementIndicator';

const TILE_SIZE = 32;

export const MapGrid = ({ worldState, combinedSlots, villages, movements, onCitySlotClick, onVillageClick, isPlacingDummyCity, pan, zoom, viewportSize }) => {

    const mapGrid = useMemo(() => {
        if (!worldState?.islands) return null;
        const grid = Array(worldState.height).fill(null).map(() => Array(worldState.width).fill({ type: 'water' }));

        worldState.islands.forEach(island => {
            const centerX = Math.round(island.x);
            const centerY = Math.round(island.y);
            for (let i = -Math.floor(island.radius); i <= Math.ceil(island.radius); i++) {
                for (let j = -Math.floor(island.radius); j <= Math.ceil(island.radius); j++) {
                    if (i * i + j * j <= island.radius * island.radius) {
                        const x = centerX + j;
                        const y = centerY + i;
                        if (y >= 0 && y < worldState.height && x >= 0 && x < worldState.width) {
                            grid[y][x] = { type: 'land' };
                        }
                    }
                }
            }
        });

        Object.values(combinedSlots).forEach(slot => {
            if (slot.x !== undefined && slot.y !== undefined) {
                const x = Math.round(slot.x);
                const y = Math.round(slot.y);
                if (grid[y]?.[x]) {
                    grid[y][x] = { type: 'city_slot', data: slot };
                }
            }
        });

        Object.values(villages).forEach(village => {
            const x = Math.round(village.x);
            const y = Math.round(village.y);
            if (grid[y]?.[x]?.type === 'land') {
                grid[y][x] = { type: 'village', data: village };
            }
        });

        return grid;
    }, [worldState, combinedSlots, villages]);


    const renderVisibleTiles = () => {
        if (!mapGrid || !worldState?.islands || viewportSize.width === 0) return null;

        const visibleTiles = [];
        const scaledTileSize = TILE_SIZE * zoom;
        const startCol = Math.max(0, Math.floor(-pan.x / scaledTileSize));
        const endCol = Math.min(worldState.width, Math.ceil((-pan.x + viewportSize.width) / scaledTileSize));
        const startRow = Math.max(0, Math.floor(-pan.y / scaledTileSize));
        const endRow = Math.min(worldState.height, Math.ceil((-pan.y + viewportSize.height) / scaledTileSize));

        for (let y = startRow; y < endRow; y++) {
            for (let x = startCol; x < endCol; x++) {
                const tile = mapGrid[y][x];
                let tileContent;
                switch (tile.type) {
                    case 'city_slot':
                        tileContent = <CitySlotTile slotData={tile.data} onClick={onCitySlotClick} isPlacingDummyCity={isPlacingDummyCity} />;
                        break;
                    case 'village':
                        tileContent = <FarmingVillageTile villageData={tile.data} onClick={onVillageClick} />;
                        break;
                    case 'land':
                        tileContent = <LandTile />;
                        break;
                    default:
                        tileContent = <WaterTile />;
                        break;
                }
                visibleTiles.push(
                    <div
                        key={`tile-${x}-${y}`}
                        className="map-tile"
                        style={{ position: 'absolute', left: x * TILE_SIZE, top: y * TILE_SIZE, width: TILE_SIZE, height: TILE_SIZE }}
                    >
                        {tileContent}
                    </div>
                );
            }
        }

        movements.forEach(movement => {
            visibleTiles.push(
                <MovementIndicator
                    key={`movement-${movement.id}`}
                    movement={movement}
                    citySlots={{...combinedSlots, ...villages}}
                    allMovements={movements}
                />
            );
        });

        return visibleTiles;
    };

    return (
        <div
            style={{
                width: worldState?.islands ? worldState.width * TILE_SIZE : 0,
                height: worldState?.islands ? worldState.height * TILE_SIZE : 0,
                transformOrigin: '0 0',
            }}
        >
            {renderVisibleTiles()}
        </div>
    );
};