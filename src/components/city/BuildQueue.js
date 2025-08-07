// src/components/city/BuildQueue.js
import React, { useState, useEffect } from 'react';
import buildingConfig from '../../gameData/buildings.json';
import specialBuildingsConfig from '../../gameData/specialBuildings.json';

// Dynamically import all building images
const buildingImages = {};
const buildingImageContext = require.context('../../images/buildings', false, /\.(png|jpe?g|svg)$/);
buildingImageContext.keys().forEach((item) => {
    const key = item.replace('./', '');
    buildingImages[key] = buildingImageContext(item);
});


const formatTime = (seconds) => {
    if (seconds < 0) seconds = 0;
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
};

const QueueItem = ({ item, isFirst, onCancel }) => {
    const [timeLeft, setTimeLeft] = useState(0);

    useEffect(() => {
        if (!isFirst) return; // Only calculate time for the first item in the queue

        const calculateTimeLeft = () => {
            const endTime = (item.endTime instanceof Date) ? item.endTime : new Date(item.endTime);
            if (isNaN(endTime.getTime())) {
                setTimeLeft(0);
                return;
            }
            const remaining = Math.max(0, endTime.getTime() - Date.now());
            setTimeLeft(remaining / 1000);
        };

        calculateTimeLeft();
        const interval = setInterval(calculateTimeLeft, 1000);
        return () => clearInterval(interval);
    }, [item.endTime, isFirst]);

    // #comment Check if the item is a special building and get its config accordingly.
    const building = item.isSpecial
        ? specialBuildingsConfig[item.buildingId]
        : buildingConfig[item.buildingId];

    if (!building) return null;
    const imageSrc = buildingImages[building.image];

    return (
        <div className="relative w-16 h-16 bg-gray-700 border-2 border-gray-600 rounded-md flex-shrink-0" title={`${building.name} (Level ${item.level})`}>
            <img src={imageSrc} alt={building.name} className="w-full h-full object-contain p-1" />
            <span className="absolute top-0 right-0 bg-yellow-500 text-black text-xs font-bold px-1 rounded-bl-md z-10">
                ^{item.level}
            </span>
            {isFirst && (
                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-75 text-white text-xs text-center py-0.5 font-mono">
                    {formatTime(timeLeft)}
                </div>
            )}
            <button
                onClick={onCancel}
                className="absolute -top-2 -right-2 w-5 h-5 flex items-center justify-center bg-red-600 text-white rounded-full font-bold text-xs hover:bg-red-500 transition-colors z-10"
                title="Cancel Construction"
            >
                &times;
            </button>
        </div>
    );
};

const BuildQueue = ({ buildQueue, onCancel }) => {
    const queueCapacity = 5;
    const emptySlots = Array(Math.max(0, queueCapacity - (buildQueue?.length || 0))).fill(null);

    return (
        <div className="bg-gray-900 p-2 rounded-lg mb-4 flex items-center gap-3 border border-gray-700">
            <div className="w-16 h-16 bg-gray-700 rounded-lg flex items-center justify-center text-4xl flex-shrink-0" title="Construction">
                🔨
            </div>
            <div className="flex-grow flex items-center gap-3">
                {buildQueue && buildQueue.map((item, index) => (
                    <QueueItem key={`${item.buildingId}-${index}`} item={item} isFirst={index === 0} onCancel={() => onCancel(index)} />
                ))}
                {emptySlots.map((_, index) => (
                    <div key={`empty-${index}`} className="w-16 h-16 bg-gray-800 border-2 border-dashed border-gray-600 rounded-md flex items-center justify-center flex-shrink-0">
                        <img src={buildingImages['temple.png']} alt="Empty Slot" className="w-10 h-10 opacity-20" />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default BuildQueue;
