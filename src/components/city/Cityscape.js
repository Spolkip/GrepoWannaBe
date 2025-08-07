// src/components/city/Cityscape.js
import React from 'react';
import BuildingSpot from './BuildingSpot';
import SpecialBuildingPlot from './specialBuildingPlotpls';
import buildingLayout from '../../gameData/BuildingLayout.json';
import buildingConfig from '../../gameData/buildings.json'; // Import building config

const Cityscape = ({ buildings, onBuildingClick, buildingImages, cityGameState, onOpenSpecialBuildingMenu }) => {
  return (
    <div
      style={{
        width: '2000px', // Large canvas for the city
        height: '1200px',
        position: 'relative',
        background: 'transparent', // Make this transparent so the parent background shows
      }}
    >
      {/* Add a green overlay to represent the island's landmass */}
      <div 
        className="absolute"
        style={{
          top: '0',
          left: '0',
          width: '100%',
          height: '85%', // Cover most of the area, leaving the bottom for the sea/shipyard
          backgroundColor: '#2a623d', // Same land color as before
          zIndex: 0
        }}
      />
      
      {buildingLayout.map((building) => {
        if (building.id === 'special_building_plot') {
            // #comment Add a check to ensure cityGameState is defined before rendering the special plot.
            // #comment This prevents a crash if the game state is temporarily unavailable during a render cycle.
            if (!cityGameState) return null; 
            
            return (
                <SpecialBuildingPlot
                    key={building.id}
                    cityGameState={cityGameState}
                    onOpenMenu={onOpenSpecialBuildingMenu}
                    buildingImages={buildingImages}
                />
            );
        }
        const buildingData = buildings[building.id];
        const level = buildingData?.level || 0;
        const config = buildingConfig[building.id]; // Get config for the building
        
        return (
          <BuildingSpot
            key={building.id}
            building={building}
            level={level}
            onClick={() => onBuildingClick(building.id)}
            image={config?.image ? buildingImages[config.image] : null} // Pass image URL
          />
        );
      })}
    </div>
  );
};

export default Cityscape;
