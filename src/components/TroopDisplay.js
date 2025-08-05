// src/components/TroopDisplay.js
import React, { useState } from 'react';
import unitConfig from '../gameData/units.json';

// Dynamically import all images from the images and images/buildings folder
const images = {};
const imageContexts = [
    require.context('../images', false, /\.(png|jpe?g|svg)$/),
    require.context('../images/buildings', false, /\.(png|jpe?g|svg)$/),
    require.context('../images/gods', false, /\.(png|jpe?g|svg)$/),
];

imageContexts.forEach(context => {
    context.keys().forEach((item) => {
        const key = item.replace('./', '');
        images[key] = context(item);
    });
});

const TroopDisplay = ({ units, title }) => {
    const [hoveredUnit, setHoveredUnit] = useState(null);
    const landUnits = Object.entries(units || {}).filter(([id, count]) => count > 0 && unitConfig[id]?.type === 'land');
    const navalUnits = Object.entries(units || {}).filter(([id, count]) => count > 0 && unitConfig[id]?.type === 'naval');
    const mythicUnits = Object.entries(units || {}).filter(([id, count]) => count > 0 && unitConfig[id]?.mythical);


    const renderUnit = ([unitId, count]) => {
        const unit = unitConfig[unitId];
        if (!unit || !unit.image) return null;

        const imageUrl = images[unit.image];
        if (!imageUrl) return null;

        return (
            <div 
                key={unitId} 
                className="troop-item" 
                onMouseEnter={() => setHoveredUnit(unitId)} 
                onMouseLeave={() => setHoveredUnit(null)}
            >
                <img src={imageUrl} alt={unit.name} className="troop-image" />
                <span className="troop-count">{count}</span>
            </div>
        );
    };

    const renderTooltip = () => {
        if (!hoveredUnit) return null;
        const unit = unitConfig[hoveredUnit];
        if (!unit) return null;

        return (
            <div className="unit-tooltip">
                <div className="tooltip-header">
                    <h3 className="tooltip-title">{unit.name}</h3>
                </div>
                <div className="tooltip-body">
                    <img src={images[unit.image]} alt={unit.name} className="tooltip-image" />
                    <div className="tooltip-stats">
                        <div className="stat-row"><span>⚔️ Attack</span><span>{unit.attack}</span></div>
                        <div className="stat-row"><span>🛡️ Defense</span><span>{unit.defense}</span></div>
                        <div className="stat-row"><span>🏃 Speed</span><span>{unit.speed}</span></div>
                    </div>
                    <p className="tooltip-description">{unit.description}</p>
                </div>
            </div>
        );
    };

    return (
        <div className="w-48 bg-gray-800 p-2 flex flex-col gap-2 border-2 border-gray-600 rounded-lg shadow-lg relative">
            {renderTooltip()}
            {landUnits.length > 0 && (
                <div className="troop-section">
                    <h4 className="troop-section-header">Barracks</h4>
                    <div className="troop-grid">
                        {landUnits.map(renderUnit)}
                    </div>
                </div>
            )}
            {mythicUnits.length > 0 && (
                <div className="troop-section">
                    <h4 className="troop-section-header">Divine Temple</h4>
                    <div className="troop-grid">
                        {mythicUnits.map(renderUnit)}
                    </div>
                </div>
            )}
            {navalUnits.length > 0 && (
                 <div className="troop-section">
                    <h4 className="troop-section-header">Harbor</h4>
                    <div className="troop-grid">
                        {navalUnits.map(renderUnit)}
                    </div>
                </div>
            )}
            {(landUnits.length === 0 && navalUnits.length === 0 && mythicUnits.length === 0) && (
                 <p className="text-gray-400 text-xs text-center p-4">No troops in this city.</p>
            )}
        </div>
    );
};

export default TroopDisplay;
