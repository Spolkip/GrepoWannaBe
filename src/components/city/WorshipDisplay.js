// src/components/city/WorshipDisplay.js

import React from 'react';
import godsConfig from '../../gameData/gods.json';

const WorshipDisplay = ({ godName, playerReligion, worship, buildings }) => {

    const getGodDetails = (name, religion) => {
        if (!name || !religion) return null;
        const religionKey = religion.toLowerCase();
        const pantheon = godsConfig[religionKey];
        if (!pantheon) return null;
        return Object.values(pantheon).find(g => g.name === name);
    };

    const godDetails = getGodDetails(godName, playerReligion);

    const favor = godName && worship ? (worship[godName] || 0) : 0;
    const templeLevel = buildings?.temple?.level || 0;
    const maxFavor = templeLevel > 0 ? 100 + (templeLevel * 20) : 0;

    return (
        <div className="bg-gray-800 rounded-lg shadow-lg p-4 border-2 border-yellow-500 w-48 mb-4">
            <h3 className="font-title text-xl text-yellow-300 text-center mb-2">Worshipping</h3>
            {godName ? (
                <div className="text-center">
                    <p className="text-lg font-bold text-white">{godName}</p>
                    {godDetails && <p className="text-xs text-gray-400 mt-1">{godDetails.description}</p>}
                    <p className="text-sm text-blue-300 mt-2">Faith: {Math.floor(favor)} / {maxFavor}</p>
                </div>
            ) : (
                <p className="text-gray-400 text-center text-sm">Build a Temple to worship a god.</p>
            )}
        </div>
    );
};

export default WorshipDisplay;