import React from 'react';
import TroopDisplay from '../TroopDisplay';
import unitsData from '../../gameData/units.json';

const OtherCityModal = ({ city, onClose, onGoTo, onAction, isVillageTarget }) => {
    if (!city) return null;

    const handleGoTo = () => {
        if (onGoTo) {
            onGoTo(city.x, city.y);
        }
        onClose();
    };

    const title = isVillageTarget 
        ? `Farming Village: ${city.name || 'Unnamed Village'} (Level ${city.level || '?'})` 
        : `City: ${city.cityName || 'Unnamed City'}`;
    
    const ownerText = `Owner: ${city.ownerUsername || 'Unknown'}`;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-sm border-2 border-gray-600" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-title text-2xl text-white">{title}</h3>
                    <button onClick={onClose} className="text-gray-400 text-3xl leading-none hover:text-white">&times;</button>
                </div>
                <p className="text-gray-400 mb-2">{ownerText}</p>
                {city.ownerFaction && <p className="text-gray-400 mb-6">Faction: {city.ownerFaction}</p>}
                
                {isVillageTarget && city.troops && Object.keys(city.troops).length > 0 && (
                    <div className="bg-gray-700 p-3 rounded-lg mb-4">
                        <TroopDisplay units={city.troops} unitsData={unitsData} title="Village Troops" />
                    </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                    {isVillageTarget ? (
                        <button 
                            onClick={() => onAction('attack', city)}
                            className="btn bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded col-span-2"
                        >
                            Attack
                        </button>
                    ) : (
                        <>
                            <button 
                                onClick={() => onAction('attack', city)}
                                className="btn bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
                            >
                                Attack
                            </button>
                            <button 
                                onClick={() => onAction('reinforce', city)}
                                className="btn bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                            >
                                Reinforce
                            </button>
                            <button 
                                onClick={() => onAction('scout', city)}
                                className="btn bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
                            >
                                Scout
                            </button>
                            <button 
                                onClick={() => onAction('trade', city)}
                                className="btn bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
                            >
                                Trade
                            </button>
                             <button 
                                onClick={() => onAction('castSpell', city)}
                                className="btn bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded"
                            >
                                Cast Spell
                            </button>
                            <button 
                                onClick={() => onAction('message', city)}
                                className="btn bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
                            >
                                Message
                            </button>
                            <button 
                                onClick={handleGoTo}
                                className="btn bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded col-span-2"
                            >
                                Go To
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OtherCityModal;
