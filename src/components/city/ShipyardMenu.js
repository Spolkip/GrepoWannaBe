import React, { useState } from 'react';
import unitConfig from '../../gameData/units.json';

const ShipyardMenu = ({ resources, availablePopulation, onTrain, onClose, buildings }) => {
    const [trainAmount, setTrainAmount] = useState({});
    const shipyardLevel = buildings.shipyard?.level || 0;

    const handleAmountChange = (unitId, amount) => {
        const newAmount = Math.max(0, parseInt(amount, 10) || 0);
        setTrainAmount(prev => ({ ...prev, [unitId]: newAmount }));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg border-2 border-gray-600" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-title text-3xl text-white">Build Naval Units</h3>
                    <button onClick={onClose} className="text-gray-400 text-3xl leading-none hover:text-white">&times;</button>
                </div>
                {shipyardLevel > 0 ? (
                    <div className="space-y-4">
                        {Object.keys(unitConfig).filter(unitId => unitConfig[unitId].type === 'naval').map(unitId => {
                            const unit = unitConfig[unitId];
                            const amount = trainAmount[unitId] || 0;
                            const totalCost = {
                                wood: unit.cost.wood * amount,
                                stone: unit.cost.stone * amount,
                                silver: unit.cost.silver * amount,
                                population: unit.cost.population * amount,
                            };
                            const canAfford = resources.wood >= totalCost.wood &&
                                            resources.stone >= totalCost.stone &&
                                            resources.silver >= totalCost.silver &&
                                            availablePopulation >= totalCost.population;
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
                                            disabled={!canAfford || amount === 0}
                                            className={`py-2 px-4 text-sm rounded-lg btn ${canAfford && amount > 0 ? 'btn-upgrade' : 'btn-disabled'}`}
                                        >
                                            Build
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <p className="text-gray-400">Build a Shipyard to construct naval units.</p>
                )}
            </div>
        </div>
    );
};

export default ShipyardMenu;