// src/components/city/UnitQueue.js
import React, { useState, useEffect } from 'react';
import unitConfig from '../../gameData/units.json';

// Dynamically import all unit images
const unitImages = {};
const imageContext = require.context('../../images', false, /\.(png|jpe?g|svg)$/);
imageContext.keys().forEach((item) => {
    const key = item.replace('./', '');
    unitImages[key] = imageContext(item);
});

const formatTime = (seconds) => {
    if (seconds < 0) seconds = 0;
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
};

const UnitQueueItem = ({ item, onCancel, isFirst }) => {
    const [timeLeft, setTimeLeft] = useState(0);

    useEffect(() => {
        if (!isFirst) return;
        const calculateTimeLeft = () => {
            const endTime = item.endTime?.toDate ? item.endTime.toDate() : new Date(item.endTime);
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

    const unit = unitConfig[item.unitId];
    if (!unit) return null;
    const imageSrc = unitImages[unit.image];
    return (
        <div className="relative w-16 h-16 bg-gray-700 border-2 border-gray-600 rounded-md flex-shrink-0" title={`${item.amount}x ${unit.name}`}>
            <img src={imageSrc} alt={unit.name} className="w-full h-full object-contain p-1" />
            <span className="absolute bottom-0 right-0 text-white bg-black bg-opacity-75 px-1.5 py-0.5 text-xs font-bold rounded-tl-md rounded-br-md">{item.amount}</span>
            {isFirst && (
                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-75 text-white text-xs text-center py-0.5 font-mono">
                    {formatTime(timeLeft)}
                </div>
            )}
            <button
                onClick={onCancel}
                className="absolute -top-2 -right-2 w-5 h-5 flex items-center justify-center bg-red-600 text-white rounded-full font-bold text-xs hover:bg-red-500 transition-colors z-10"
                title="Cancel"
            >
                &times;
            </button>
        </div>
    );
};

const UnitQueue = ({ unitQueue, onCancel, title = "In Training" }) => {
    if (!unitQueue || unitQueue.length === 0) {
        return (
            <div className="mt-auto pt-4">
                 <h4 className="text-lg font-semibold text-yellow-400 mb-2">{title} (0/5)</h4>
                 <div className="flex space-x-3 bg-gray-900 p-2 rounded-lg h-24 items-center justify-center">
                    <p className="text-gray-500">Queue is empty.</p>
                 </div>
            </div>
        );
    }
    return (
        <div className="mt-auto pt-4">
            <h4 className="text-lg font-semibold text-yellow-400 mb-2">{title} ({unitQueue.length}/5)</h4>
            <div className="flex space-x-3 bg-gray-900 p-2 rounded-lg overflow-x-auto h-24 items-center">
                {unitQueue.map((item, index) => (
                    <UnitQueueItem 
                        key={`${item.unitId}-${index}`} 
                        item={item} 
                        onCancel={() => onCancel(index)} 
                        isFirst={index === 0}
                    />
                ))}
            </div>
        </div>
    );
};

export default UnitQueue;
