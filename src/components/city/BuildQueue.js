import React, { useState, useEffect } from 'react';
import buildingConfig from '../../gameData/buildings.json';

const formatTime = (seconds) => {
    if (seconds < 0) seconds = 0;
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
};

const QueueItem = ({ item, onCancel }) => {
    const [timeLeft, setTimeLeft] = useState(0);

    useEffect(() => {
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
    }, [item.endTime]);

    const building = buildingConfig[item.buildingId];

    return (
        <div className="flex justify-between items-center bg-gray-600 p-2 rounded">
            <span className="font-semibold">{building.name} (Level {item.level})</span>
            <div className="flex items-center gap-4">
                <span className="font-mono text-yellow-300">{formatTime(timeLeft)}</span>
                <button 
                    onClick={onCancel} 
                    className="text-red-400 hover:text-red-300 font-bold text-xl leading-none px-2 rounded-full"
                    title="Cancel Construction"
                >
                    &times;
                </button>
            </div>
        </div>
    );
};

const BuildQueue = ({ buildQueue, onCancel }) => {
    if (!buildQueue || buildQueue.length === 0) {
        return (
            <div className="bg-gray-900 p-3 rounded-lg mb-4">
                <h4 className="text-lg font-semibold text-gray-400 text-center">Build queue is empty.</h4>
            </div>
        );
    }

    return (
        <div className="bg-gray-900 p-3 rounded-lg mb-4">
            <h4 className="text-lg font-semibold text-yellow-400 mb-2">Construction Queue ({buildQueue.length}/5)</h4>
            <div className="space-y-2">
                {buildQueue.map((item, index) => (
                    <QueueItem key={`${item.buildingId}-${index}`} item={item} onCancel={() => onCancel(index)} />
                ))}
            </div>
        </div>
    );
};

export default BuildQueue;