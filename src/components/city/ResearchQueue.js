// src/components/city/ResearchQueue.js
import React, { useState, useEffect, useRef } from 'react';
import researchConfig from '../../gameData/research.json';

const formatTime = (seconds) => {
    if (seconds < 0) seconds = 0;
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
};

const ResearchQueueItem = ({ item, onCancel, isFirst, isLast, onHover, onLeave, hoveredItem }) => {
    const [timeLeft, setTimeLeft] = useState(0);

    useEffect(() => {
        if (!isFirst) return; // Only calculate time for the first item.

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

    const research = researchConfig[item.researchId];

    return (
        <div 
            className="flex justify-between items-center bg-gray-600 p-2 rounded relative"
            onMouseEnter={() => onHover(item.researchId)}
            onMouseLeave={onLeave}
        >
            <span className="font-semibold">{research.name}</span>
            <div className="flex items-center gap-4">
                {isFirst && <span className="font-mono text-yellow-300">{formatTime(timeLeft)}</span>}
                {isLast && (
                    <button 
                        onClick={onCancel} 
                        className="text-red-400 hover:text-red-300 font-bold text-xl leading-none px-2 rounded-full"
                        title="Cancel Research"
                    >
                        &times;
                    </button>
                )}
            </div>
            {hoveredItem === item.researchId && (
                <div className="unit-tooltip" style={{ top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: '5px', zIndex: 100, width: '250px', pointerEvents: 'none' }}>
                    <div className="tooltip-header"><h3 className="tooltip-title">{research.name}</h3></div>
                    <div className="tooltip-body" style={{ padding: '0.5rem' }}>
                        <p className="tooltip-description" style={{ fontSize: '0.75rem' }}>{research.description}</p>
                        <div className="tooltip-stats" style={{ border: 'none', padding: 0, marginTop: '8px' }}>
                            <div className="stat-row" style={{ fontSize: '0.7rem' }}><span>Cost:</span><span>{research.cost.wood}W, {research.cost.stone}S, {research.cost.silver}Ag, {research.cost.points || 0}RP</span></div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const ResearchQueue = ({ researchQueue, onCancel }) => {
    const [hoveredItem, setHoveredItem] = useState(null);
    const tooltipTimeoutRef = useRef(null);

    // #comment handle mouse enter to show tooltip
    const handleMouseEnter = (itemId) => {
        clearTimeout(tooltipTimeoutRef.current);
        setHoveredItem(itemId);
    };

    // #comment handle mouse leave to hide tooltip
    const handleMouseLeave = () => {
        tooltipTimeoutRef.current = setTimeout(() => {
            setHoveredItem(null);
        }, 200);
    };

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
                    <ResearchQueueItem 
                        key={`${item.researchId}-${index}`} 
                        item={item} 
                        onCancel={() => onCancel(index)} 
                        isFirst={index === 0}
                        isLast={index === researchQueue.length - 1}
                        onHover={handleMouseEnter}
                        onLeave={handleMouseLeave}
                        hoveredItem={hoveredItem}
                    />
                ))}
            </div>
        </div>
    );
};

export default ResearchQueue;
