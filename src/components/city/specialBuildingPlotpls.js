import React from 'react';
import specialBuildings from '../../gameData/specialBuildings.json';

const SpecialBuildingPlot = ({ cityGameState, onOpenMenu, buildingImages }) => {
    // #comment Add a guard clause to prevent a crash if the cityGameState is not yet available during rendering.
    if (!cityGameState) {
        return (
            <div className="building-spot empty">
                <p>Loading...</p>
            </div>
        );
    }

    const specialBuildingId = cityGameState.specialBuilding;

    if (specialBuildingId) {
        const building = specialBuildings[specialBuildingId];
        const imageSrc = buildingImages && building.image ? buildingImages[building.image] : '';
        return (
            <div className="building-spot" onClick={onOpenMenu}>
                <img src={imageSrc} alt={building.name} />
                <p>{building.name}</p>
            </div>
        );
    }

    return (
        <div className="building-spot empty" onClick={onOpenMenu}>
            <p>Special Building Plot</p>
        </div>
    );
};

export default SpecialBuildingPlot;
