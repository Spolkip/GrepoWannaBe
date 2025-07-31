// src/components/city/WorshipDisplay.js

import React from 'react';
import godsConfig from '../../gameData/gods.json';

// Dynamically import all images from the images/gods folder
const images = require.context('../../images/gods', false, /\.(png|jpe?g|svg)$/);
const imageMap = images.keys().reduce((acc, item) => {
    const key = item.replace('./', '');
    acc[key] = images(item);
    return acc;
}, {});


const WorshipDisplay = ({ godName, playerReligion, worship, buildings, onOpenPowers }) => {

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
            {godName && godDetails ? (
                <div className="text-center">
                    <img src={imageMap[godDetails.image]} alt={godDetails.name} className="w-24 h-24 mx-auto rounded-full border-4 border-yellow-500" />
                    <p className="text-lg font-bold text-white mt-2">{godName}</p>
                    <p className="text-sm text-blue-300 mt-2">Favor: {Math.floor(favor)} / {maxFavor}</p>
                    <button onClick={onOpenPowers} className="btn btn-primary w-full mt-4 py-1">View Powers</button>
                </div>
            ) : (
                <p className="text-gray-400 text-center text-sm">Build a Temple to worship a god.</p>
            )}
        </div>
    );
};

export default WorshipDisplay;