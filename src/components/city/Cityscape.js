// src/components/city/Cityscape.js
import React from 'react';
import BuildingSpot from './BuildingSpot';
import buildingLayout from '../../gameData/BuildingLayout.json';
import buildingConfig from '../../gameData/buildings.json'; // Import building config

const Cityscape = ({ buildings, onBuildingClick, buildingImages }) => {
  return (
    <div
      style={{
        width: '2000px', // Large canvas for the city
        height: '1200px',
        position: 'relative',
        background: `linear-gradient(to bottom, #2a623d 85%, #1e3a8a 25%)`, // 70% land, 30% sea
      }}
    >
      {buildingLayout.map((building) => {
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
