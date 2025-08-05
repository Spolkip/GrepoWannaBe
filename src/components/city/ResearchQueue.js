// src/components/city/ResearchQueue.js
import React, { useState, useEffect } from 'react';
import researchConfig from '../../gameData/research.json';

const formatTime = (seconds) => {
    if (seconds < 0) seconds = 0;
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
};

const ResearchQueueItem = ({ item, onCancel }) => {
    const [timeLeft, setTimeLeft] = useState(0);

    useEffect(() => {
        // #comment This useEffect is now solely responsible for calculating the time left for the item.
        const calculateTimeLeft = () => {
            // #comment Ensure endTime is a valid Date object before calling getTime()
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
    }, [item.endTime]);

    const research = researchConfig[item.researchId];

    return (
        <div className="flex justify-between items-center bg-gray-600 p-2 rounded">
            <span className="font-semibold">{research.name}</span>
            <div className="flex items-center gap-4">
                <span className="font-mono text-yellow-300">{formatTime(timeLeft)}</span>
                <button 
                    onClick={onCancel} 
                    className="text-red-400 hover:text-red-300 font-bold text-xl leading-none px-2 rounded-full"
                    title="Cancel Research"
                >
                    &times;
                </button>
            </div>
        </div>
    );
};

const ResearchQueue = ({ researchQueue, onCancel }) => {
    if (!researchQueue || researchQueue.length === 0) {
        return (
            <div className="bg-gray-900 p-3 rounded-lg mb-4">
                <h4 className="text-lg font-semibold text-gray-400 text-center">Research queue is empty.</h4>
            </div>
        );
    }

    return (
        <div className="bg-gray-900 p-3 rounded-lg mb-4">
            <h4 className="text-lg font-semibold text-yellow-400 mb-2">Research Queue ({researchQueue.length}/5)</h4>
            <div className="space-y-2">
                {researchQueue.map((item, index) => (
                    <ResearchQueueItem key={`${item.researchId}-${index}`} item={item} onCancel={() => onCancel(index)} />
                ))}
            </div>
        </div>
    );
};

export default ResearchQueue;
