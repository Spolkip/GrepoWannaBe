// src/components/map/ScoutPanel.js
import React from 'react';

const ScoutPanel = ({ selectedResources, gameState, handleResourceChange }) => {
    const availableCaveSilver = gameState.cave?.silver || 0;

    return (
        <div className="space-y-2">
            <h4 className="text-lg text-white font-bold mt-4 mb-2">Silver for Espionage</h4>
            <div className="flex justify-between items-center">
                <span className="text-white capitalize">Silver in Cave ({Math.floor(availableCaveSilver)})</span>
                <input
                    type="number"
                    value={selectedResources.silver || 0}
                    onChange={(e) => handleResourceChange('silver', e.target.value)}
                    className="bg-gray-700 text-white rounded p-1 w-32"
                />
            </div>
        </div>
    );
};

export default ScoutPanel;