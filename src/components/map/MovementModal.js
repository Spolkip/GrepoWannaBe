// spolkip/grepoliswannabe/GrepolisWannaBe-84ea944fec8305f67d645494c64605ee04b71622/src/components/map/MovementModal.js
import React, { useState, useMemo, useEffect } from 'react';
import { calculateTravelTime, formatTravelTime } from '../../utils/travel';
import unitConfig from '../../gameData/units.json';
import { useGame } from '../../contexts/GameContext';

// Import new panels
import TradePanel from './TradePanel';
import ScoutPanel from './ScoutPanel';

// Dynamically import all images from the images folder (this is for unit images)
const images = require.context('../../images', false, /\.(png|jpe?g|svg)$/);
const imageMap = images.keys().reduce((acc, item) => {
    const key = item.replace('./', '');
    acc[key] = images(item);
    return acc;
}, {});

// MovementModal component allows players to send units or resources for various actions.
const MovementModal = ({ mode, targetCity, playerCity, playerUnits: initialPlayerUnits, playerResources: initialPlayerResources, travelTimeInfo, onSend, onClose, setMessage }) => {
    const { gameState } = useGame();

    const currentUnits = initialPlayerUnits || gameState?.units || {};
    const currentResources = initialPlayerResources || gameState?.resources || {};

    const [selectedUnits, setSelectedUnits] = useState({});
    const [selectedResources, setSelectedResources] = useState({ wood: 0, stone: 0, silver: 0 });
    const [attackLayers, setAttackLayers] = useState({
        front: '',
        mid: '',
        back: ''
    });

    const transportCapacity = useMemo(() => {
        let capacity = 0;
        for (const unitId in selectedUnits) {
            if (unitConfig[unitId]?.type === 'naval' && unitConfig[unitId]?.capacity) {
                capacity += selectedUnits[unitId] * unitConfig[unitId].capacity;
            }
        }
        return capacity;
    }, [selectedUnits]);

    const currentUnitsLoad = useMemo(() => {
        let load = 0;
        for (const unitId in selectedUnits) {
            if (unitConfig[unitId]?.type === 'land' && unitConfig[unitId]?.cost?.population) {
                load += selectedUnits[unitId] * unitConfig[unitId].cost.population;
            }
        }
        return load;
    }, [selectedUnits]);

    useEffect(() => {
        const newAttackLayers = { ...attackLayers };
        let needsReset = false;
        for (const layer in newAttackLayers) {
            const unitId = newAttackLayers[layer];
            if (unitId && (!selectedUnits[unitId] || selectedUnits[unitId] === 0)) {
                newAttackLayers[layer] = '';
                needsReset = true;
            }
        }
        if (needsReset) {
            setAttackLayers(newAttackLayers);
        }
    }, [selectedUnits, attackLayers]);

    const handleUnitChange = (unitId, value) => {
        const amount = Math.max(0, Math.min(currentUnits[unitId] || 0, parseInt(value, 10) || 0));
        setSelectedUnits(prev => ({ ...prev, [unitId]: amount }));
    };

    const handleResourceChange = (resource, value) => {
        const parsedAmount = parseInt(value, 10) || 0;
        let amount = parsedAmount;

        if (mode === 'scout' && resource === 'silver') {
            const availableCaveSilver = gameState.cave?.silver || 0;
            amount = Math.max(0, Math.min(availableCaveSilver, parsedAmount));
        } else {
            amount = Math.max(0, Math.min(currentResources[resource] || 0, parsedAmount));
        }
        setSelectedResources(prev => ({ ...prev, [resource]: amount }));
    };

    const handleLayerChange = (layerName, unitId) => {
        setAttackLayers(prev => {
            const newLayers = { ...prev, [layerName]: unitId };
            return newLayers;
        });
    };

    const slowestSpeed = useMemo(() => {
        if (mode === 'trade' || mode === 'scout') return 10;
        const speeds = Object.entries(selectedUnits)
            .filter(([, count]) => count > 0)
            .map(([unitId]) => unitConfig[unitId].speed);
        return speeds.length > 0 ? Math.min(...speeds) : null;
    }, [selectedUnits, mode]);

    const finalTravelTime = useMemo(() => {
        if (!travelTimeInfo?.distance || !slowestSpeed) return 'N/A';
        const timeInSeconds = calculateTravelTime(travelTimeInfo.distance, slowestSpeed);
        return formatTravelTime(timeInSeconds);
    }, [slowestSpeed, travelTimeInfo?.distance]);

    const handleSend = () => {
        let totalUnitsSelected = Object.values(selectedUnits).reduce((sum, count) => sum + count, 0);
        let totalResourcesSelected = Object.values(selectedResources).reduce((sum, amount) => sum + amount, 0);

        if ((mode === 'attack' || mode === 'reinforce') && totalUnitsSelected === 0) {
            setMessage("Please select at least one unit to send for attack or reinforcement.");
            return;
        }
        if (mode === 'scout') {
            const silverForScout = selectedResources.silver || 0;
            if (silverForScout <= 0) {
                setMessage("Please enter an amount of silver for scouting.");
                return;
            }
            if (silverForScout > (gameState.cave?.silver || 0)) {
                setMessage("Not enough silver in the cave for scouting.");
                return;
            }
        }
        if (mode === 'trade' && totalResourcesSelected === 0) {
            setMessage("Please select at least one resource to trade.");
            return;
        }

        const hasLandUnitsSelected = Object.keys(selectedUnits).some(unitId => unitConfig[unitId]?.type === 'land' && selectedUnits[unitId] > 0);
        const hasNavalUnitsSelected = Object.keys(selectedUnits).some(unitId => unitConfig[unitId]?.type === 'naval' && selectedUnits[unitId] > 0);

        if (hasLandUnitsSelected && hasNavalUnitsSelected && currentUnitsLoad > transportCapacity) {
            setMessage(`Not enough transport ship capacity. You need ${currentUnitsLoad - transportCapacity} more capacity.`);
            return;
        }

        if (mode === 'attack') {
            const selectedLayerUnits = Object.values(attackLayers).filter(unitId => unitId !== '');
            const uniqueLayerUnits = new Set(selectedLayerUnits);

            if (selectedLayerUnits.length !== uniqueLayerUnits.size) {
                setMessage("Each attack formation layer must have a unique unit selected.");
                return;
            }

            for (const layerName in attackLayers) {
                const unitId = attackLayers[layerName];
                if (unitId !== '' && (selectedUnits[unitId] || 0) === 0) {
                    setMessage(`Your selected ${layerName} unit (${unitConfig[unitId].name}) has 0 troops in the current selection. Please adjust unit counts or selection.`);
                    return;
                }
                if (unitId !== '' && unitConfig[unitId]?.type !== 'land') {
                    setMessage(`The unit selected for ${layerName} (${unitConfig[unitId].name}) must be a land unit.`);
                    return;
                }
            }
        }

        const resourcesToSend = {};
        if (mode === 'scout') {
            resourcesToSend.silver = selectedResources.silver;
        } else if (mode === 'trade') {
            Object.assign(resourcesToSend, selectedResources);
        }

        onSend({
            mode,
            targetCity,
            units: mode === 'scout' || mode === 'trade' ? {} : selectedUnits,
            resources: resourcesToSend,
            travelTime: finalTravelTime,
            attackFormation: mode === 'attack' ? attackLayers : {}
        });
        onClose();
    };
    
    const renderContent = () => {
        const landUnitsList = Object.keys(unitConfig)
            .filter(unitId => unitConfig[unitId].type === 'land')
            .map(unitId => ({
                id: unitId,
                ...unitConfig[unitId],
                currentCount: currentUnits[unitId] || 0
            }));

        const navalUnitsList = Object.keys(unitConfig)
            .filter(unitId => unitConfig[unitId].type === 'naval')
            .map(unitId => ({
                id: unitId,
                ...unitConfig[unitId],
                currentCount: currentUnits[unitId] || 0
            }));

        const selectedLandUnitsForFormation = Object.keys(selectedUnits).filter(unitId => 
            selectedUnits[unitId] > 0 && unitConfig[unitId]?.type === 'land'
        );

        const attackLayerOptions = [
            { name: 'front', label: 'Front Line' },
            { name: 'mid', label: 'Mid Line' },
            { name: 'back', 'label': 'Back Line' }
        ];

        const capacityProgress = transportCapacity > 0 ? (currentUnitsLoad / transportCapacity) * 100 : 0;
        const progressBarColor = capacityProgress > 100 ? 'bg-red-500' : 'bg-green-500';

        if (mode === 'attack' || mode === 'reinforce') {
            return (
                <div className="space-y-4">
                    {/* Land Units Section */}
                    {landUnitsList.length > 0 && (
                        <div className="bg-gray-700 p-3 rounded-lg ">
                            <h4 className="font-bold text-lg text-yellow-300">Land Units</h4>
                            <div className="grid grid-cols-3 sm:grid-cols-6 gap-0 ">
                                {landUnitsList.map(unit => (
                                    <div key={unit.id} className="flex flex-col items-center p-1 rounded-lg w-12">
                                        <div className="relative w-11 h-12 mb-1">
                                            <img src={imageMap[unit.image]} alt="" className="w-full h-full object-cover rounded-md " />
                                             <span className="absolute bottom-0 right-0 bg-gray-900 text-white text-xs px-1 rounded-tl-md font-bold">
                                                {unit.currentCount}
                                            </span>
                                        </div>
                                        <input
                                            type="number"
                                            value={selectedUnits[unit.id] || 0}
                                            onChange={(e) => handleUnitChange(unit.id, e.target.value)}
                                            className="w-12 bg-gray-900 text-white text-center rounded p-0.5 text-sm hide-number-spinners"
                                            min="0"
                                            max={unit.currentCount}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Naval Units Section */}
                    {navalUnitsList.length > 0 && (
                        <div className="bg-gray-700 p-3 rounded-lg">
                            <h4 className="font-bold text-lg text-yellow-300">Naval Units</h4>
                            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1">
                                {navalUnitsList.map(unit => (
                                    <div key={unit.id} className="flex flex-col items-center p-1">
                                        <div className="relative w-12 h-12">
                                            <img src={imageMap[unit.image]} alt={unit.name} className="w-full h-full object-cover rounded-md" />
                                            <span className="absolute bottom-0 right-0 bg-gray-900 text-white text-xs px-1 rounded-tl-md font-bold">
                                                {unit.currentCount}
                                            </span>
                                        </div>
                                        <input
                                            type="number"
                                            value={selectedUnits[unit.id] || 0}
                                            onChange={(e) => handleUnitChange(unit.id, e.target.value)}
                                            className="w-12 bg-gray-900 text-white text-center rounded p-0.5 text-sm"
                                            min="0"
                                            max={unit.currentCount}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Transport Capacity Bar */}
                    {transportCapacity > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-700">
                            <h4 className="text-lg text-white font-bold">Transport Capacity</h4>
                            <div className="w-full bg-gray-700 rounded-full h-6 relative">
                                <div 
                                    className={`h-full rounded-full ${progressBarColor}`} 
                                    style={{ width: `${Math.min(100, capacityProgress)}%` }}
                                ></div>
                                <div className="absolute inset-0 flex items-center justify-center text-white text-sm font-bold">
                                    {currentUnitsLoad} / {transportCapacity}
                                </div>
                            </div>
                            {capacityProgress > 100 && (
                                <p className="text-red-400 text-sm mt-1">Over capacity! Reduce land units or add more transport ships.</p>
                            )}
                        </div>
                    )}

                    {mode === 'attack' && selectedLandUnitsForFormation.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-700">
                            <h4 className="text-lg text-white font-bold mb-2">Attack Formation</h4>
                            {/* Render dropdowns for each attack layer */}
                            {attackLayerOptions.map(layer => (
                                <div key={layer.name} className="flex flex-col space-y-2 mt-2">
                                    <label className="text-white">{layer.label}:</label>
                                    <select
                                        value={attackLayers[layer.name]}
                                        onChange={(e) => handleLayerChange(layer.name, e.target.value)}
                                        className="bg-gray-700 text-white rounded p-2"
                                    >
                                        <option value="">None</option>
                                        {/* Filter out units already selected in other layers AND units not selected for attack */}
                                        {selectedLandUnitsForFormation
                                            .filter(unitId => !Object.values(attackLayers).some((selectedUnit, key) => selectedUnit === unitId && key !== layer.name))
                                            .map(unitId => (
                                                <option key={unitId} value={unitId}>{unitConfig[unitId].name}</option>
                                            ))}
                                    </select>
                                </div>
                            ))}
                        </div>
                    )}
                     {mode === 'attack' && selectedLandUnitsForFormation.length === 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-700">
                            <p className="text-gray-400">Select land units to configure attack formation.</p>
                        </div>
                    )}
                </div>
            );
        }
        if (mode === 'scout') {
            return (
                <ScoutPanel
                    selectedResources={selectedResources}
                    gameState={gameState}
                    handleResourceChange={handleResourceChange}
                />
            );
        }
        if (mode === 'trade') {
            return (
                <TradePanel
                    selectedResources={selectedResources}
                    currentResources={currentResources}
                    handleResourceChange={handleResourceChange}
                />
            );
        }
        return null;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-transparent" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-[400px] max-h-[90vh] border-2 border-gray-600" onClick={e => e.stopPropagation()}>
                <h3 className="font-title text-2xl text-white mb-4 capitalize">{mode} {targetCity.cityName || targetCity.name}</h3>
                <div className="max-h-[70vh] overflow-y-auto pr-2">
                    {renderContent()}
                </div>
                <p className="text-gray-400 mt-4">Travel Time: <span className="font-bold text-yellow-300">{finalTravelTime}</span></p>
                <button onClick={handleSend} className="btn btn-primary w-full py-2 mt-6">
                    Send
                </button>
            </div>
        </div>
    );
};

export default MovementModal;