// src/components/city/AcademyMenu.js
import React from 'react';
import researchConfig from '../../gameData/research.json';
import ResearchQueue from './ResearchQueue'; // Import the new ResearchQueue

const formatTime = (seconds) => {
    if (seconds < 0) seconds = 0;
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
};

const AcademyMenu = ({ cityGameState, onResearch, onClose, researchQueue, onCancelResearch }) => { // Add researchQueue and onCancelResearch to props
    const { buildings, resources, research = {} } = cityGameState;
    const academyLevel = buildings.academy?.level || 0;

    const canAfford = (cost) => {
        return resources.wood >= cost.wood && resources.stone >= cost.stone && resources.silver >= cost.silver;
    };

    const meetsRequirements = (reqs) => {
        if (reqs.academy && academyLevel < reqs.academy) {
            return false;
        }
        if (reqs.research && !research[reqs.research]) {
            return false;
        }
        return true;
    };

    // Determine if a research is already in the queue
    const isResearchInQueue = (researchId) => {
        return (researchQueue || []).some(item => item.researchId === researchId);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-3xl border-2 border-gray-600 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-title text-3xl text-white">Academy (Level {academyLevel})</h3>
                    <button onClick={onClose} className="text-gray-400 text-3xl leading-none hover:text-white">&times;</button>
                </div>
                
                {/* Render the ResearchQueue here */}
                <ResearchQueue researchQueue={researchQueue} onCancel={onCancelResearch} />

                <div className="overflow-y-auto space-y-4 pr-2">
                    {Object.entries(researchConfig).map(([id, config]) => {
                        const isResearched = research[id];
                        const requirementsMet = meetsRequirements(config.requirements);
                        const affordable = canAfford(config.cost);
                        const inQueue = isResearchInQueue(id); // Check if in queue

                        let button;
                        if (isResearched) {
                            button = <button disabled className="btn btn-disabled w-full py-2 mt-2">Completed</button>;
                        } else if (inQueue) { // New condition for in queue
                            button = <button disabled className="btn btn-disabled w-full py-2 mt-2">In Queue</button>;
                        } else if (!requirementsMet) {
                            let reqText = `Requires Academy Lvl ${config.requirements.academy || 0}`;
                            if (config.requirements.research) {
                                reqText += ` & ${researchConfig[config.requirements.research].name}`;
                            }
                            button = <button disabled className="btn btn-disabled w-full py-2 mt-2">{reqText}</button>;
                        } else {
                            button = <button onClick={() => onResearch(id)} disabled={!affordable || researchQueue.length >= 5} className={`btn ${affordable && researchQueue.length < 5 ? 'btn-upgrade' : 'btn-disabled'} w-full py-2 mt-2`}>
                                {researchQueue.length >= 5 ? 'Queue Full' : 'Research'}
                            </button>;
                        }

                        return (
                            <div key={id} className={`p-4 rounded-lg flex justify-between items-center ${isResearched ? 'bg-green-900/50' : 'bg-gray-700'} ${inQueue ? 'opacity-80' : ''}`}>
                                <div>
                                    <h4 className="text-xl font-bold text-yellow-300">{config.name}</h4>
                                    <p className="text-sm text-gray-400">{config.description}</p>
                                    <div className="text-xs text-gray-300 mt-2">
                                        <span>Cost: {config.cost.wood}W, {config.cost.stone}S, {config.cost.silver}Ag</span>
                                        <span className="ml-4">Time: {formatTime(config.cost.time)}</span>
                                    </div>
                                </div>
                                <div className="w-1/4 ml-4">
                                    {button}
                                </div> {/* Closing div tag added here, the extra '}' was removed */}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export { AcademyMenu };