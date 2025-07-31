// src/components/map/MapGrid.js
import React from 'react';
import { WaterTile, LandTile, CitySlotTile, FarmingVillageTile } from './Tiles';
import MovementIndicator from './MovementIndicator';

const TILE_SIZE = 32;
const defaultSettings = { animations: true, showVisuals: true, showGrid: true };

const MapGrid = ({ mapGrid, worldState, pan, zoom, viewportSize, onCitySlotClick, onVillageClick, isPlacingDummyCity, movements, combinedSlots, villages, playerAlliance, conqueredVillages, gameSettings = defaultSettings }) => {
    if (!mapGrid || !worldState?.islands || viewportSize.width === 0) return null;

    const scaledTileSize = TILE_SIZE * zoom;
    const startCol = Math.max(0, Math.floor(-pan.x / scaledTileSize));
    const endCol = Math.min(worldState.width, Math.ceil((-pan.x + viewportSize.width) / scaledTileSize));
    const startRow = Math.max(0, Math.floor(-pan.y / scaledTileSize));
    const endRow = Math.min(worldState.height, Math.ceil((-pan.y + viewportSize.height) / scaledTileSize));

    const visibleTiles = [];

    for (let y = startRow; y < endRow; y++) {
        for (let x = startCol; x < endCol; x++) {
            const tile = mapGrid[y][x];
            let tileContent;
            switch (tile.type) {
                case 'city_slot':
                    tileContent = <CitySlotTile slotData={tile.data} onClick={onCitySlotClick} isPlacingDummyCity={isPlacingDummyCity} playerAlliance={playerAlliance} gameSettings={gameSettings} />;
                    break;
                case 'village':
                    tileContent = <FarmingVillageTile villageData={tile.data} onClick={onVillageClick} conqueredVillages={conqueredVillages} gameSettings={gameSettings} />;
                    break;
                case 'land':
                    tileContent = <LandTile gameSettings={gameSettings} />;
                    break;
                default:
                    tileContent = <WaterTile gameSettings={gameSettings} />;
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

    if (gameSettings.animations) {
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
    }

    return <>{visibleTiles}</>;
};

export default MapGrid;
