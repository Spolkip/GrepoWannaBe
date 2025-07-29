// src/components/city/SenateView.js
import React from 'react';
import buildingConfig from '../../gameData/buildings.json';
import BuildQueue from './BuildQueue';

const formatTime = (seconds) => {
    if (seconds < 60) return `${Math.floor(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
}

// FIX: Add onCancelBuild to the list of props being received
const SenateView = ({ buildings, resources, onUpgrade, getUpgradeCost, onClose, usedPopulation, maxPopulation, buildQueue = [], onCancelBuild }) => {
    
    // Removed isBuildingInQueue function as it's no longer needed to restrict multiple same-building queues

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-30">
            <div className="bg-gray-800 text-white p-6 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center border-b border-gray-600 pb-3 mb-4">
                    <h2 className="text-3xl font-bold font-title text-yellow-300">Senate</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">&times;</button>
                </div>

                {/* FIX: Pass the function down to BuildQueue as the 'onCancel' prop */}
                <BuildQueue buildQueue={buildQueue} onCancel={onCancelBuild} />
                
                <div className='flex justify-between items-center mb-4 p-3 bg-gray-900 rounded-lg'>
                    <p className="text-lg">Population: <span className="font-bold text-green-400">{maxPopulation - usedPopulation}</span> / {maxPopulation}</p>
                    <div className="flex gap-4">
                        <p>Wood: <span className='font-bold text-yellow-300'>{Math.floor(resources.wood)}</span></p>
                        <p>Stone: <span className='font-bold text-gray-300'>{Math.floor(resources.stone)}</span></p>
                        <p>Silver: <span className='font-bold text-blue-300'>{Math.floor(resources.silver)}</span></p>
                    </div>
                </div>

                <div className="overflow-y-auto pr-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Object.entries(buildingConfig).map(([id, config]) => {
                            if (config.constructible === false) return null;
                            const level = buildings[id]?.level || 0;
                            const cost = getUpgradeCost(id, level + 1);
                            const canAfford = resources.wood >= cost.wood && resources.stone >= cost.stone && resources.silver >= cost.silver && (maxPopulation-usedPopulation >= cost.population);
                            // Removed 'inQueue' variable as it's no longer needed for this specific restriction.
                            
                            return (
                                <div key={id} className={`bg-gray-700 p-4 rounded-lg flex flex-col justify-between shadow-md border border-gray-600 transition-opacity ${buildQueue.length >= 5 ? 'opacity-50' : ''}`}>
                                    <div>
                                        <h3 className="text-xl font-semibold text-yellow-400">{config.name}</h3>
                                        <p className="text-sm text-gray-300 mb-2">Level: {level}</p>
                                        <p className="text-sm text-gray-400 mb-3">{config.description}</p>
                                        <div className="text-xs grid grid-cols-2 gap-1 mb-3">
                                            <span>Wood: {cost.wood}</span>
                                            <span>Stone: {cost.stone}</span>
                                            <span>Silver: {cost.silver}</span>
                                            <span>Population: {cost.population}</span>
                                            <span>Time: {formatTime(cost.time)}</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => onUpgrade(id)}
                                        // Modified disabled check to only consider affordability and overall queue limit
                                        disabled={!canAfford || buildQueue.length >= 5}
                                        className={`w-full py-2 rounded font-bold transition-colors ${
                                            !canAfford || buildQueue.length >= 5
                                                ? 'bg-gray-600 cursor-not-allowed opacity-60' // General disabled style
                                                : 'bg-green-600 hover:bg-green-500' // Enabled style
                                        }`}
                                    >
                                        {/* Adjusted button text logic */}
                                        {buildQueue.length >= 5 ? 'Queue Full' : (level === 0 ? 'Build' : `Upgrade to ${level + 1}`)}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SenateView;