// src/components/alliance/AllianceWonder.js
import React, { useState, useEffect } from 'react';
import { useAlliance } from '../../contexts/AllianceContext';
import { useGame } from '../../contexts/GameContext';
import allianceWonders from '../../gameData/alliance_wonders.json';
import { getWonderProgress } from '../../hooks/actions/useAllianceWonderActions';

const AllianceWonder = () => {
    const { playerAlliance, donateToWonder, claimWonderLevel } = useAlliance();
    const { worldId } = useGame();
    const [donation, setDonation] = useState({ wood: 0, stone: 0, silver: 0 });
    const [selectedWonder, setSelectedWonder] = useState(null);
    const [message, setMessage] = useState('');

    const isLeader = playerAlliance?.leader?.uid === currentUser?.uid;

    const currentWonder = playerAlliance?.allianceWonder;
    const wonderConfig = currentWonder ? allianceWonders[currentWonder.id] : null;

    const handleDonationChange = (e) => {
        const { name, value } = e.target;
        setDonation(prev => ({ ...prev, [name]: parseInt(value) || 0 }));
    };

    const handleDonate = async () => {
        setMessage('');
        if (!currentWonder) {
            setMessage('No wonder has been selected yet.');
            return;
        }
        try {
            await donateToWonder(currentWonder.id, donation);
            setMessage('Donation successful!');
            setDonation({ wood: 0, stone: 0, silver: 0 });
        } catch (error) {
            setMessage(`Donation failed: ${error.message}`);
        }
    };
    
    const handleClaimLevel = async () => {
        setMessage('');
        if (!currentWonder || !isLeader) return;
        try {
            await claimWonderLevel(currentWonder.id);
            setMessage(`Wonder upgraded to level ${currentWonder.level + 1}!`);
        } catch (error) {
            setMessage(`Claim failed: ${error.message}`);
        }
    };

    const handleSelectWonder = (wonderId) => {
        if (!isLeader || currentWonder) return;
        setSelectedWonder(wonderId);
    };

    const handleStartWonder = async () => {
        setMessage('');
        if (!isLeader || !selectedWonder) return;
        try {
            // A simple cost to start a wonder, could be configurable
            const startCost = { wood: 50000, stone: 50000, silver: 25000 };
            await donateToWonder(selectedWonder, startCost, true);
            setMessage(`Construction of ${allianceWonders[selectedWonder].name} has begun!`);
            setSelectedWonder(null);
        } catch (error) {
            setMessage(`Failed to start wonder: ${error.message}`);
        }
    };

    const getWonderCost = (level) => {
        if (!wonderConfig) return { wood: 0, stone: 0, silver: 0 };
        const costMultiplier = Math.pow(1.5, level);
        return {
            wood: Math.floor(100000 * costMultiplier),
            stone: Math.floor(100000 * costMultiplier),
            silver: Math.floor(50000 * costMultiplier)
        };
    };

    const renderWonderProgress = () => {
        if (!currentWonder) {
            if (!isLeader) return <p>Your alliance has not yet chosen a wonder.</p>;
            return (
                <div className="flex flex-col gap-4">
                    <p>As the leader, you can choose a wonder for the alliance to build.</p>
                    <div className="grid grid-cols-2 gap-4">
                        {Object.entries(allianceWonders).map(([id, wonder]) => (
                            <button
                                key={id}
                                onClick={() => handleSelectWonder(id)}
                                className={`btn ${selectedWonder === id ? 'btn-confirm' : 'btn-primary'}`}
                            >
                                {wonder.name}
                            </button>
                        ))}
                    </div>
                    {selectedWonder && (
                        <button onClick={handleStartWonder} className="btn btn-confirm">Start Construction</button>
                    )}
                </div>
            );
        }

        const nextLevel = currentWonder.level + 1;
        const nextLevelCost = getWonderCost(nextLevel);
        const progress = getWonderProgress(playerAlliance, currentWonder.id);
        const progressPercent = (
            (progress.wood / nextLevelCost.wood) +
            (progress.stone / nextLevelCost.stone) +
            (progress.silver / nextLevelCost.silver)
        ) / 3 * 100;

        return (
            <div>
                <h4 className="text-xl font-bold mb-2">{wonderConfig.name} (Level {currentWonder.level})</h4>
                <p className="text-sm italic mb-4">{wonderConfig.description}</p>
                <div className="w-full bg-gray-700 rounded-full h-8 mb-4 relative">
                    <div
                        className="bg-yellow-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, progressPercent)}%` }}
                    ></div>
                    <span className="absolute inset-0 flex items-center justify-center text-white font-bold">
                        {Math.min(100, progressPercent).toFixed(1)}%
                    </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm text-center mb-4">
                    <div>Wood: {progress.wood} / {nextLevelCost.wood}</div>
                    <div>Stone: {progress.stone} / {nextLevelCost.stone}</div>
                    <div>Silver: {progress.silver} / {nextLevelCost.silver}</div>
                </div>

                {isLeader && (
                    <button
                        onClick={handleClaimLevel}
                        disabled={progressPercent < 100}
                        className="btn btn-confirm w-full mb-4"
                    >
                        {progressPercent >= 100 ? `Claim Level ${nextLevel}` : `Requires more resources`}
                    </button>
                )}

                <div className="bg-gray-700 p-4 rounded-lg">
                    <h5 className="font-bold text-lg mb-2">Donate Resources</h5>
                    <div className="flex gap-2">
                        <input type="number" name="wood" value={donation.wood} onChange={handleDonationChange} className="w-full bg-gray-800 p-1 rounded" placeholder="Wood" />
                        <input type="number" name="stone" value={donation.stone} onChange={handleDonationChange} className="w-full bg-gray-800 p-1 rounded" placeholder="Stone" />
                        <input type="number" name="silver" value={donation.silver} onChange={handleDonationChange} className="w-full bg-gray-800 p-1 rounded" placeholder="Silver" />
                    </div>
                    <button onClick={handleDonate} className="btn btn-confirm w-full mt-4">Donate</button>
                </div>
            </div>
        );
    };

    return (
        <div className="bg-amber-100 text-gray-900 p-4 rounded-lg shadow-md space-y-6">
            <h3 className="text-xl font-bold mb-2 border-b border-amber-300 pb-2">Alliance Wonder</h3>
            {message && <p className="text-center text-amber-800 mb-4">{message}</p>}
            {renderWonderProgress()}
        </div>
    );
};

export default AllianceWonder;
