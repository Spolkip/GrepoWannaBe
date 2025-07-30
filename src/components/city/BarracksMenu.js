// src/components/city/BarracksMenu.js
import React, { useState } from 'react';
import unitConfig from '../../gameData/units.json';
import UnitQueue from './UnitQueue'; // Import the new UnitQueue component

const BarracksMenu = ({ resources, availablePopulation, onTrain, onClose, buildings, unitQueue, onCancelTrain }) => { // Add unitQueue and onCancelTrain to props
    const [trainAmount, setTrainAmount] = useState({});

    // Add this helper function to calculate currently queued population for a unit type
    const getPopulationInQueue = (unitId) => {
        return (unitQueue || []).reduce((sum, item) => {
            return item.unitId === unitId ? sum + (unitConfig[item.unitId]?.cost.population || 0) * item.amount : sum;
        }, 0);
    };

    const handleAmountChange = (unitId, amount) => {
        const newAmount = Math.max(0, parseInt(amount, 10) || 0);
        setTrainAmount(prev => ({ ...prev, [unitId]: newAmount }));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg border-2 border-gray-600" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-title text-3xl text-white">Train Land Troops</h3>
                    <button onClick={onClose} className="text-gray-400 text-3xl leading-none hover:text-white">&times;</button>
                </div>
                {/* Render the UnitQueue here */}
                <UnitQueue unitQueue={unitQueue} onCancel={onCancelTrain} /> 
                <div className="space-y-4">
                    {Object.keys(unitConfig).filter(unitId => unitConfig[unitId].type === 'land').map(unitId => {
                        const unit = unitConfig[unitId];
                        const amount = trainAmount[unitId] || 0;
                        const totalCost = {
                            wood: unit.cost.wood * amount,
                            stone: unit.cost.stone * amount,
                            silver: unit.cost.silver * amount,
                            population: unit.cost.population * amount,
                        };
                        // Also consider units already in training when checking available population
                        const currentUnitPopulationInQueue = getPopulationInQueue(unitId);
                        const canAfford = resources.wood >= totalCost.wood &&
                                        resources.stone >= totalCost.stone &&
                                        resources.silver >= totalCost.silver &&
                                        (availablePopulation - currentUnitPopulationInQueue) >= totalCost.population;

                        return (
                            <div key={unitId} className="bg-gray-700 p-4 rounded-lg">
                                <p className="font-bold text-lg text-white">{unit.name}</p>
                                <p className="text-sm text-gray-400">{unit.description}</p>
                                <p className="text-sm text-gray-400 mt-2">Cost: {unit.cost.wood}W, {unit.cost.stone}S, {unit.cost.silver}Ag, {unit.cost.population}P</p>
                                <div className="flex items-center space-x-4 mt-2">
                                    <input
                                        type="number"
                                        value={amount}
                                        onChange={(e) => handleAmountChange(unitId, e.target.value)}
                                        className="bg-gray-800 text-white rounded p-2 w-24"
                                    />
                                    <button
                                        onClick={() => onTrain(unitId, amount)}
                                        disabled={!canAfford || amount === 0 || unitQueue.length >= 5} // Disable if queue is full
                                        className={`py-2 px-4 text-sm rounded-lg btn ${canAfford && amount > 0 && unitQueue.length < 5 ? 'btn-upgrade' : 'btn-disabled'}`}
                                    >
                                        {unitQueue.length >= 5 ? 'Queue Full' : 'Train'}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default BarracksMenu;