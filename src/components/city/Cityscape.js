import React from 'react';
import BuildingSpot from './BuildingSpot';
import buildingLayout from './BuildingLayout.json';

const Cityscape = ({ buildings, onBuildingClick }) => {
  return (
    <div
      style={{
        width: '2000px', // Large canvas for the city
        height: '2000px',
        position: 'relative',
        background: `linear-gradient(to bottom, #2a623d 70%, #1e3a8a 70%)`, // 70% land, 30% sea
      }}
    >
      {buildingLayout.map((building) => {
        const buildingData = buildings[building.id];
        const level = buildingData?.level || 0;
        
        return (
          <BuildingSpot
            key={building.id}
            building={building}
            level={level}
            onClick={() => onBuildingClick(building.id)}
          />
        );
      })}
    </div>
  );
};

export default Cityscape;