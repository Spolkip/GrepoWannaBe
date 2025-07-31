import React, { useState } from 'react';
import { useGame } from '../../contexts/GameContext';
import allianceResearch from '../../gameData/allianceResearch.json';

const AllianceResearch = () => {
    const { playerAlliance, donateToAllianceResearch } = useGame();
    const [donation, setDonation] = useState({ wood: 0, stone: 0, silver: 0 });
    const [selectedResearch, setSelectedResearch] = useState(null);

    const handleDonationChange = (e) => {
        setDonation({ ...donation, [e.target.name]: parseInt(e.target.value) || 0 });
    };

    const handleDonate = (researchId) => {
        donateToAllianceResearch(researchId, donation);
        setDonation({ wood: 0, stone: 0, silver: 0 });
    };

    return (
        <div>
            <h3 className="text-xl font-bold mb-2">Alliance Research</h3>
            <div className="grid grid-cols-2 gap-4">
                {Object.entries(allianceResearch).map(([id, research]) => {
                    const level = playerAlliance.research[id]?.level || 0;
                    const progress = playerAlliance.research[id]?.progress || {};
                    const cost = {
                        wood: Math.floor(research.baseCost.wood * Math.pow(research.costMultiplier, level)),
                        stone: Math.floor(research.baseCost.stone * Math.pow(research.costMultiplier, level)),
                        silver: Math.floor(research.baseCost.silver * Math.pow(research.costMultiplier, level)),
                    };

                    return (
                        <div key={id} className="p-4 bg-gray-700 rounded">
                            <h4 className="font-bold">{research.name} (Level {level})</h4>
                            <p className="text-sm text-gray-400">{research.description}</p>
                            {level < research.maxLevel && (
                                <>
                                    <div className="my-2">
                                        <p>Progress:</p>
                                        <p className="text-xs">Wood: {progress.wood || 0} / {cost.wood}</p>
                                        <p className="text-xs">Stone: {progress.stone || 0} / {cost.stone}</p>
                                        <p className="text-xs">Silver: {progress.silver || 0} / {cost.silver}</p>
                                    </div>
                                    <button onClick={() => setSelectedResearch(id)} className="btn btn-sm btn-primary">Donate</button>
                                </>
                            )}
                        </div>
                    );
                })}
            </div>

            {selectedResearch && (
                <div className="mt-4 p-4 bg-gray-800 rounded">
                    <h4 className="font-bold">Donate to {allianceResearch[selectedResearch].name}</h4>
                    <div className="flex gap-2 my-2">
                        <input type="number" name="wood" value={donation.wood} onChange={handleDonationChange} className="w-full bg-gray-900 p-1 rounded" placeholder="Wood" />
                        <input type="number" name="stone" value={donation.stone} onChange={handleDonationChange} className="w-full bg-gray-900 p-1 rounded" placeholder="Stone" />
                        <input type="number" name="silver" value={donation.silver} onChange={handleDonationChange} className="w-full bg-gray-900 p-1 rounded" placeholder="Silver" />
                    </div>
                    <button onClick={() => handleDonate(selectedResearch)} className="btn btn-confirm">Confirm Donation</button>
                    <button onClick={() => setSelectedResearch(null)} className="btn btn-secondary ml-2">Cancel</button>
                </div>
            )}
        </div>
    );
};

export default AllianceResearch;
