import React from 'react';
import buildingConfig from '../../gameData/buildings.json';

const BuildingDetailsModal = ({ buildingId, buildingData, onClose, getProductionRates, getWarehouseCapacity, getFarmCapacity, onOpenBarracks, onOpenShipyard }) => {
    const config = buildingConfig[buildingId];
    if (!config) return null;

    const nextLevel = buildingData.level + 1;

    const isWarehouse = buildingId === 'warehouse';
    const isProductionBuilding = ['timber_camp', 'quarry', 'silver_mine'].includes(buildingId);
    const isFarm = buildingId === 'farm';
    const isBarracks = buildingId === 'barracks';
    const isShipyard = buildingId === 'shipyard';

    const getResourceType = (id) => {
        if (id === 'timber_camp') return 'wood';
        if (id === 'quarry') return 'stone';
        if (id === 'silver_mine') return 'silver';
        return '';
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md border-2 border-gray-600" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="font-title text-3xl text-white">{config.name}</h3>
                        <p className="text-yellow-300 font-bold text-lg">Level {buildingData.level}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 text-3xl leading-none hover:text-white">&times;</button>
                </div>
                <p className="text-gray-400 mt-2 mb-6">{config.description}</p>

                {isWarehouse && (
                    <div className="text-sm space-y-1 mb-6 text-gray-300">
                        <p className="font-semibold text-lg">Capacity:</p>
                        <p>Current: {getWarehouseCapacity(buildingData.level).toLocaleString()}</p>
                        <p>Next Level: {getWarehouseCapacity(nextLevel).toLocaleString()}</p>
                    </div>
                )}

                {isProductionBuilding && (
                    <div className="text-sm space-y-1 mb-6 text-gray-300">
                        <p className="font-semibold text-lg">Production (per hour):</p>
                        <p>Current: {getProductionRates({ [buildingId]: buildingData })[getResourceType(buildingId)].toLocaleString()}</p>
                        <p>Next Level: {getProductionRates({ [buildingId]: { level: nextLevel } })[getResourceType(buildingId)].toLocaleString()}</p>
                    </div>
                )}

                {isFarm && (
                    <div className="text-sm space-y-1 mb-6 text-gray-300">
                        <p className="font-semibold text-lg">Population Capacity:</p>
                        <p>Current: {getFarmCapacity(buildingData.level).toLocaleString()}</p>
                        <p>Next Level: {getFarmCapacity(nextLevel).toLocaleString()}</p>
                    </div>
                )}

                {isBarracks && (
                    <button onClick={onOpenBarracks} className="btn btn-primary w-full py-2">
                        Train Troops
                    </button>
                )}

                {isShipyard && (
                    <button onClick={onOpenShipyard} className="btn btn-primary w-full py-2">
                        Build Naval Units
                    </button>
                )}
            </div>
        </div>
    );
};

export default BuildingDetailsModal;