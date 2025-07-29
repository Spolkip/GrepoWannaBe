import React, { useState, useMemo, useEffect } from 'react';
import { calculateTravelTime, formatTravelTime } from '../../utils/travel';
import unitConfig from '../../gameData/units.json';
import { useGame } from '../../contexts/GameContext';

// Import panels
import TradePanel from './TradePanel';
import ScoutPanel from './ScoutPanel';

const images = require.context('../../images', false, /\.(png|jpe?g|svg)$/);
const imageMap = images.keys().reduce((acc, item) => {
    const key = item.replace('./', '');
    acc[key] = images(item);
    return acc;
}, {});

const MovementModal = ({ mode, targetCity, playerCity, playerUnits: initialPlayerUnits, playerResources: initialPlayerResources, travelTimeInfo, onSend, onClose, setMessage }) => {
    const { gameState } = useGame();

    const currentUnits = initialPlayerUnits || gameState?.units || {};
    const currentResources = initialPlayerResources || gameState?.resources || {};

    const [selectedUnits, setSelectedUnits] = useState({});
    const [selectedShips, setSelectedShips] = useState({});
    const [selectedResources, setSelectedResources] = useState({ wood: 0, stone: 0, silver: 0 });
    const [attackLayers, setAttackLayers] = useState({ front: '', mid: '', back: '' });

    const isDifferentIsland = targetCity.islandId !== playerCity.islandId;

    const transportCapacity = useMemo(() => {
        let capacity = 0;
        for (const unitId in selectedShips) {
            if (unitConfig[unitId]?.capacity) {
                capacity += selectedShips[unitId] * unitConfig[unitId].capacity;
            }
        }
        return capacity;
    }, [selectedShips]);

    const landUnitsLoad = useMemo(() => {
        let load = 0;
        for (const unitId in selectedUnits) {
            if (unitConfig[unitId]?.type === 'land') {
                load += selectedUnits[unitId];
            }
        }
        return load;
    }, [selectedUnits]);

    const handleUnitChange = (unitId, value, isNaval) => {
        const amount = Math.max(0, Math.min(currentUnits[unitId] || 0, parseInt(value, 10) || 0));
        const setter = isNaval ? setSelectedShips : setSelectedUnits;
        setter(prev => ({ ...prev, [unitId]: amount }));
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
    
    const slowestSpeed = useMemo(() => {
        if (mode === 'trade' || mode === 'scout') return 10;
        
        const unitsToConsider = isDifferentIsland ? selectedShips : selectedUnits;
        const speeds = Object.entries(unitsToConsider)
            .filter(([, count]) => count > 0)
            .map(([unitId]) => unitConfig[unitId].speed);

        return speeds.length > 0 ? Math.min(...speeds) : null;
    }, [selectedUnits, selectedShips, isDifferentIsland, mode]);
    

    const finalTravelTime = useMemo(() => {
        if (!travelTimeInfo?.distance || !slowestSpeed) return 'N/A';
        const timeInSeconds = calculateTravelTime(travelTimeInfo.distance, slowestSpeed);
        return formatTravelTime(timeInSeconds);
    }, [slowestSpeed, travelTimeInfo?.distance]);

    const handleSend = () => {
        if (isDifferentIsland && Object.values(selectedShips).every(count => count === 0)) {
            setMessage("You must send ships to reach another island.");
            return;
        }
        if (landUnitsLoad > transportCapacity) {
            setMessage(`Over transport capacity by ${landUnitsLoad - transportCapacity}.`);
            return;
        }
        
        onSend({
            mode,
            targetCity,
            units: selectedUnits,
            ships: selectedShips,
            resources: mode === 'trade' || mode === 'scout' ? selectedResources : {},
            attackFormation: attackLayers
        });
        onClose();
    };

    const renderUnits = (type) => {
        const unitList = Object.keys(unitConfig).filter(id => unitConfig[id].type === type);
        if (unitList.length === 0) return null;

        return (
            <div className="bg-gray-700 p-3 rounded-lg">
                <h4 className="font-bold text-lg text-yellow-300 capitalize">{type} Units</h4>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {unitList.map(unitId => {
                        const unit = { id: unitId, ...unitConfig[unitId], currentCount: currentUnits[unitId] || 0 };
                        const isNaval = type === 'naval';
                        const selectedCount = isNaval ? (selectedShips[unitId] || 0) : (selectedUnits[unitId] || 0);

                        return (
                             <div key={unit.id} className="flex flex-col items-center p-1 rounded-lg">
                                <div className="relative w-12 h-12 mb-1">
                                    <img src={imageMap[unit.image]} alt={unit.name} className="w-full h-full object-cover rounded-md" />
                                    <span className="absolute bottom-0 right-0 bg-gray-900 text-white text-xs px-1 rounded-tl-md font-bold">
                                        {unit.currentCount}
                                    </span>
                                </div>
                                <input
                                    type="number"
                                    value={selectedCount}
                                    onChange={(e) => handleUnitChange(unit.id, e.target.value, isNaval)}
                                    className="w-14 bg-gray-900 text-white text-center rounded p-1 text-sm hide-number-spinners"
                                    min="0"
                                    max={unit.currentCount}
                                />
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-[450px] max-h-[90vh] border-2 border-gray-600" onClick={e => e.stopPropagation()}>
                <h3 className="font-title text-2xl text-white mb-4 capitalize">{mode} {targetCity.cityName || targetCity.name}</h3>
                <div className="max-h-[70vh] overflow-y-auto pr-2 space-y-4">
                    {mode === 'attack' || mode === 'reinforce' ? (
                        <>
                            {renderUnits('land')}
                            {isDifferentIsland && renderUnits('naval')}
                            {isDifferentIsland && transportCapacity > 0 && (
                                <div className="mt-4 pt-4 border-t border-gray-700">
                                    <h4 className="text-lg text-white font-bold">Transport Capacity</h4>
                                    <div className="w-full bg-gray-700 rounded-full h-6 relative">
                                        <div 
                                            className={`h-full rounded-full ${landUnitsLoad > transportCapacity ? 'bg-red-500' : 'bg-green-500'}`} 
                                            style={{ width: `${Math.min(100, (landUnitsLoad / transportCapacity) * 100)}%` }}
                                        ></div>
                                        <div className="absolute inset-0 flex items-center justify-center text-white text-sm font-bold">
                                            {landUnitsLoad} / {transportCapacity}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : mode === 'scout' ? (
                        <ScoutPanel selectedResources={selectedResources} gameState={gameState} handleResourceChange={handleResourceChange} />
                    ) : (
                        <TradePanel selectedResources={selectedResources} currentResources={currentResources} handleResourceChange={handleResourceChange} />
                    )}
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