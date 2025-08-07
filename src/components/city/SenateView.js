// src/components/city/SenateView.js
import React, { useState } from 'react';
import buildingConfig from '../../gameData/buildings.json';
import specialBuildingsConfig from '../../gameData/specialBuildings.json';
import BuildQueue from './BuildQueue';

// Dynamically import all building images
const buildingImages = {};
const buildingImageContext = require.context('../../images/buildings', false, /\.(png|jpe?g|svg)$/);
buildingImageContext.keys().forEach((item) => {
    const key = item.replace('./', '');
    buildingImages[key] = buildingImageContext(item);
});

const BuildingCard = ({ id, config, level, cost, canAfford, onUpgrade, isQueueFull }) => {
    const isMaxLevel = level >= (config.maxLevel || 99);
    let buttonText = level === 0 ? 'Build' : `Expand to ${level + 1}`;
    if (isMaxLevel) buttonText = 'Max Level';

    let disabledReason = '';
    if (isMaxLevel) disabledReason = 'Max Level';
    else if (isQueueFull) disabledReason = 'Queue Full';
    else if (!canAfford) disabledReason = 'Not enough resources/pop';

    return (
        <div className="bg-gray-700/80 border-2 border-gray-600 rounded-lg p-2 w-48 text-center flex flex-col items-center relative shadow-lg">
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-0.5 h-6 bg-gray-500/50"></div>
            <h4 className="font-bold text-yellow-400 text-base">{config.name}</h4>
            <p className="text-sm text-gray-300 font-semibold">Level {level}</p>
            <img src={buildingImages[config.image]} alt={config.name} className="w-20 h-20 object-contain my-1" />
            <div className="text-xs text-gray-400 mb-2">
                <span>{cost.wood}W</span>, <span>{cost.stone}S</span>, <span>{cost.silver}Ag</span>, <span>{cost.population}P</span>
            </div>
            <button
                onClick={() => onUpgrade(id)}
                disabled={!canAfford || isQueueFull || isMaxLevel}
                className={`w-full py-1.5 rounded font-bold text-sm transition-colors ${!canAfford || isQueueFull || isMaxLevel ? 'btn-disabled' : 'btn-upgrade'}`}
            >
                {disabledReason || buttonText}
            </button>
        </div>
    );
};

const SpecialBuildingCard = ({ cityGameState, onOpenSpecialBuildingMenu }) => {
    const specialBuildingId = cityGameState.specialBuilding;
    const config = specialBuildingId ? specialBuildingsConfig[specialBuildingId] : buildingConfig.special_building_plot;
    
    return (
        <div className="bg-gray-700/80 border-2 border-gray-600 rounded-lg p-2 w-48 text-center flex flex-col items-center relative shadow-lg">
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-0.5 h-6 bg-gray-500/50"></div>
            <h4 className="font-bold text-yellow-400 text-base">{config.name}</h4>
            <p className="text-sm text-gray-300 font-semibold">{specialBuildingId ? 'Constructed' : 'Empty Plot'}</p>
            <img src={buildingImages[config.image]} alt={config.name} className="w-20 h-20 object-contain my-1" />
            <p className="text-xs text-gray-400 mb-2 h-8 overflow-hidden">{config.description}</p>
            <button
                onClick={onOpenSpecialBuildingMenu}
                disabled={!!specialBuildingId}
                className={`w-full py-1.5 rounded font-bold text-sm transition-colors ${!!specialBuildingId ? 'btn-disabled' : 'btn-upgrade'}`}
            >
                {specialBuildingId ? 'Constructed' : 'Build Wonder'}
            </button>
        </div>
    );
};


const SenateView = ({ buildings, resources, onUpgrade, onDemolish, getUpgradeCost, onClose, usedPopulation, maxPopulation, buildQueue = [], onCancelBuild, setMessage, cityGameState, onOpenSpecialBuildingMenu, onDemolishSpecialBuilding }) => {
    const [activeTab, setActiveTab] = useState('upgrade');
    
    const buildingRows = [
        ['senate'],
        ['timber_camp', 'quarry', 'silver_mine', 'farm'],
        ['warehouse', 'market', 'barracks', 'shipyard'],
        ['academy', 'temple', 'divine_temple', 'hospital'],
        ['city_wall', 'cave', 'special_building_plot']
    ];

    const isBuildingInQueue = (buildingId) => (buildQueue || []).some(task => task.buildingId === buildingId);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-30">
            <div className="bg-gray-800 text-white p-6 rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center border-b border-gray-600 pb-3 mb-4">
                    <h2 className="text-3xl font-bold font-title text-yellow-300">Senate</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">&times;</button>
                </div>
                
                <BuildQueue buildQueue={buildQueue} onCancel={onCancelBuild} />
                
                <div className='flex justify-between items-center mb-4 p-3 bg-gray-900 rounded-lg'>
                    <p className="text-lg">Population: <span className="font-bold text-green-400">{maxPopulation - usedPopulation}</span> / {maxPopulation}</p>
                    <div className="flex gap-4">
                        <p>Wood: <span className='font-bold text-yellow-300'>{Math.floor(resources.wood)}</span></p>
                        <p>Stone: <span className='font-bold text-gray-300'>{Math.floor(resources.stone)}</span></p>
                        <p>Silver: <span className='font-bold text-blue-300'>{Math.floor(resources.silver)}</span></p>
                    </div>
                </div>

                <div className="flex border-b border-gray-600 mb-4">
                    <button onClick={() => setActiveTab('upgrade')} className={`flex-1 p-2 text-lg font-bold transition-colors ${activeTab === 'upgrade' ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>Upgrade</button>
                    <button onClick={() => setActiveTab('demolish')} className={`flex-1 p-2 text-lg font-bold transition-colors ${activeTab === 'demolish' ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>Demolish</button>
                </div>

                <div className="overflow-y-auto pr-2">
                    {activeTab === 'upgrade' && (
                        <div className="flex flex-col items-center space-y-12 py-6">
                            {buildingRows.map((row, rowIndex) => (
                                <div key={rowIndex} className="flex justify-center items-start gap-6 relative">
                                    {row.length > 1 && rowIndex > 0 && <div className="absolute -top-9 left-0 right-0 h-0.5 bg-gray-500/50 z-0 w-3/4 mx-auto"></div>}
                                    {row.map(id => {
                                        if (id === 'special_building_plot') {
                                            return <SpecialBuildingCard key={id} cityGameState={cityGameState} onOpenSpecialBuildingMenu={onOpenSpecialBuildingMenu} />;
                                        }
                                        const config = buildingConfig[id];
                                        if (config.constructible === false && id !== 'senate') return null;
                                        const level = buildings[id]?.level || 0;
                                        const cost = getUpgradeCost(id, level + 1);
                                        const canAfford = resources.wood >= cost.wood && resources.stone >= cost.stone && resources.silver >= cost.silver && (maxPopulation - usedPopulation >= cost.population);
                                        const isQueueFull = (buildQueue || []).length >= 5;

                                        return (
                                            <BuildingCard 
                                                key={id} 
                                                id={id}
                                                config={config}
                                                level={level}
                                                cost={cost}
                                                canAfford={canAfford}
                                                onUpgrade={onUpgrade}
                                                isQueueFull={isQueueFull}
                                            />
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    )}
                    {activeTab === 'demolish' && (
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {Object.entries(buildings)
                                .filter(([id, data]) => data.level > 0 && buildingConfig[id].constructible !== false && id !== 'senate')
                                .map(([id, data]) => {
                                    const config = buildingConfig[id];
                                    const inQueue = isBuildingInQueue(id);
                                    return (
                                        <div key={id} className="bg-gray-700 p-4 rounded-lg flex justify-between items-center">
                                            <div>
                                                <h4 className="text-xl font-semibold text-yellow-400">{config.name}</h4>
                                                <p className="text-sm text-gray-300">Level {data.level}</p>
                                            </div>
                                            <button 
                                                onClick={() => onDemolish(id, setMessage)}
                                                disabled={inQueue || (buildQueue || []).length >= 5}
                                                className={`py-2 px-4 rounded font-bold ${inQueue || (buildQueue || []).length >= 5 ? 'btn-disabled' : 'btn-danger'}`}
                                            >
                                                {inQueue ? 'In Queue' : 'Demolish'}
                                            </button>
                                        </div>
                                    );
                                })
                            }
                            {cityGameState.specialBuilding && (
                                <div className="bg-gray-700 p-4 rounded-lg flex justify-between items-center">
                                    <div>
                                        <h4 className="text-xl font-semibold text-yellow-400">{specialBuildingsConfig[cityGameState.specialBuilding].name}</h4>
                                        <p className="text-sm text-gray-300">Wonder</p>
                                    </div>
                                    <button 
                                        onClick={onDemolishSpecialBuilding}
                                        className="py-2 px-4 rounded font-bold btn-danger"
                                    >
                                        Demolish
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SenateView;
