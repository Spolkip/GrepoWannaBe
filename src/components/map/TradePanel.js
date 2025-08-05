// src/components/map/TradePanel.js
import React from 'react';
import woodImage from '../../images/resources/wood.png';
import stoneImage from '../../images/resources/stone.png';
import silverImage from '../../images/resources/silver.png';

const TradePanel = ({ selectedResources, currentResources, handleResourceChange }) => {
    const resourceImages = {
        wood: woodImage,
        stone: stoneImage,
        silver: silverImage,
    };


    return (
        <div className="space-y-2">
            <h4 className="text-lg text-white font-bold mb-2">Select Resources</h4>
            <div className="flex justify-around items-end w-full">
                {Object.keys(selectedResources).map(resource =>
                    <div key={resource} className="flex flex-col items-center">
                        <img
                            src={resourceImages[resource]}
                            alt={resource}
                            className="w-12 h-12 mb-1 bg-gray-700 rounded"
                        />
                        <input
                            type="number"
                            value={selectedResources[resource] || 0}
                            onChange={(e) => handleResourceChange(resource, e.target.value)}
                            className="bg-gray-700 text-white text-center rounded p-1 w-14 hide-number-spinners"
                            min="0"
                            max={currentResources[resource]}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default TradePanel;
