// src/components/city/ShipyardMenu.js
import React, { useState, useEffect } from 'react';
import unitConfig from '../../gameData/units.json';
import UnitQueue from './UnitQueue';

// Dynamically import all unit images
const unitImages = {};
const imageContext = require.context('../../images', false, /\.(png|jpe?g|svg)$/);
imageContext.keys().forEach((item) => {
    const key = item.replace('./', '');
    unitImages[key] = imageContext(item);
});

const UnitStats = ({ unit }) => (
    <div className="w-1/2 bg-gray-900 p-4 rounded-lg space-y-2">
        <h5 className="font-bold text-lg text-yellow-300 mb-3">Unit Information</h5>
        <div className="flex items-center justify-between text-sm"><span>⚔️ Attack</span><span className="font-bold">{unit.attack}</span></div>
        <div className="flex items-center justify-between text-sm"><span>🛡️ Defense</span><span className="font-bold">{unit.defense}</span></div>
        <div className="flex items-center justify-between text-sm"><span>⛵ Speed</span><span className="font-bold">{unit.speed}</span></div>
        {unit.capacity > 0 && <div className="flex items-center justify-between text-sm"><span>📦 Capacity</span><span className="font-bold">{unit.capacity}</span></div>}
    </div>
);

const ShipyardMenu = ({ resources, availablePopulation, onTrain, onClose, cityGameState, unitQueue, onCancelTrain }) => {
    const navalUnits = Object.keys(unitConfig).filter(id => unitConfig[id].type === 'naval');
    const [selectedUnitId, setSelectedUnitId] = useState(navalUnits[0] || null);
    const [trainAmount, setTrainAmount] = useState(1);
    
    useEffect(() => {
        setTrainAmount(1);
    }, [selectedUnitId]);

    if (!selectedUnitId) {
        // You might want a better placeholder if no naval units exist in your gameData
        return <div className="text-white">Build a shipyard to see available units.</div>
    }

    const selectedUnit = unitConfig[selectedUnitId];
    const cityUnits = cityGameState?.units || {};
    const navalUnitQueue = (unitQueue || []).filter(item => unitConfig[item.unitId]?.type === 'naval');

    const totalCost = {
        wood: selectedUnit.cost.wood * trainAmount,
        stone: selectedUnit.cost.stone * trainAmount,
        silver: selectedUnit.cost.silver * trainAmount,
        population: selectedUnit.cost.population * trainAmount,
    };

    const canAfford = resources.wood >= totalCost.wood &&
                    resources.stone >= totalCost.stone &&
                    resources.silver >= totalCost.silver &&
                    availablePopulation >= totalCost.population;

    const handleTrain = () => {
        if(trainAmount > 0) onTrain(selectedUnitId, trainAmount);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-4xl border-2 border-gray-600 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-title text-3xl text-white">Shipyard</h3>
                    <button onClick={onClose} className="text-gray-400 text-3xl leading-none hover:text-white">&times;</button>
                </div>

                <div className="flex-grow flex gap-4 overflow-y-auto">
                    {/* Left Panel: Unit Selection */}
                    <div className="w-1/3 flex flex-col gap-2">
                        {navalUnits.map(unitId => {
                            const unit = unitConfig[unitId];
                            const isSelected = selectedUnitId === unitId;
                            return (
                                <button
                                    key={unitId}
                                    onClick={() => setSelectedUnitId(unitId)}
                                    className={`flex items-center p-2 rounded border-2 transition-colors w-full ${isSelected ? 'bg-gray-600 border-yellow-500' : 'bg-gray-700 border-gray-600 hover:border-yellow-400'}`}
                                >
                                    <img src={unitImages[unit.image]} alt={unit.name} className="w-12 h-12 mr-3 object-contain" />
                                    <div>
                                        <p className="font-bold text-left text-white">{unit.name}</p>
                                        <p className="text-sm text-left text-gray-400">In City: {cityUnits[unitId] || 0}</p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {/* Right Panel: Details */}
                    <div className="w-2/3 flex flex-col gap-4">
                        <div className="bg-gray-700 p-4 rounded-lg">
                            <h4 className="font-title text-2xl text-yellow-400">{selectedUnit.name}</h4>
                            <p className="text-gray-400 italic mt-1">{selectedUnit.description}</p>
                        </div>
                        <div className="flex gap-4">
                            <div className="w-1/2 bg-gray-900 p-4 rounded-lg space-y-1">
                                <h5 className="font-bold text-lg text-yellow-300 mb-2">Cost (Total)</h5>
                                <p className="text-sm text-gray-300">Wood: {selectedUnit.cost.wood} ({totalCost.wood})</p>
                                <p className="text-sm text-gray-300">Stone: {selectedUnit.cost.stone} ({totalCost.stone})</p>
                                <p className="text-sm text-gray-300">Silver: {selectedUnit.cost.silver} ({totalCost.silver})</p>
                                <p className="text-sm text-gray-300">Population: {selectedUnit.cost.population} ({totalCost.population})</p>
                                <p className="text-sm text-gray-300">Time per unit: {selectedUnit.cost.time}s</p>
                            </div>
                            <UnitStats unit={selectedUnit} />
                        </div>
                        <div className="bg-gray-700 p-4 rounded-lg flex items-center justify-between">
                            <input
                                type="number"
                                value={trainAmount}
                                onChange={(e) => setTrainAmount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                                className="bg-gray-800 text-white rounded p-2 w-24"
                            />
                            <button
                                onClick={handleTrain}
                                disabled={!canAfford || (unitQueue || []).length >= 5}
                                className={`py-2 px-6 text-lg rounded-lg btn ${(canAfford && (unitQueue || []).length < 5) ? 'btn-confirm' : 'btn-disabled'}`}
                            >
                                {(unitQueue || []).length >= 5 ? 'Queue Full' : 'Build'}
                            </button>
                        </div>
                    </div>
                </div>

                <UnitQueue unitQueue={navalUnitQueue} onCancel={onCancelTrain} />
            </div>
        </div>
    );
};

export default ShipyardMenu;