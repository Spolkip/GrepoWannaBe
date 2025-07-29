import React, { useState } from 'react';
import unitConfig from '../../gameData/units.json';

const AdminCheatMenu = ({ onCheat, onClose }) => {
    const [amounts, setAmounts] = useState({ wood: 0, stone: 0, silver: 0, population: 0 });
    const [troop, setTroop] = useState({ unit: 'swordsman', amount: 0 });
    const [warehouseLevels, setWarehouseLevels] = useState(0);

    const handleCheat = () => {
        onCheat(amounts, troop, warehouseLevels);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md border-2 border-gray-600" onClick={e => e.stopPropagation()}>
                <h3 className="font-title text-2xl text-white mb-4">Admin Cheats</h3>
                <div className="space-y-4">
                    {Object.keys(amounts).map(resource => (
                        <div key={resource} className="flex justify-between items-center">
                            <label className="text-white capitalize">{resource}</label>
                            <input
                                type="number"
                                value={amounts[resource]}
                                onChange={(e) => setAmounts(prev => ({ ...prev, [resource]: parseInt(e.target.value, 10) || 0 }))}
                                className="bg-gray-700 text-white rounded p-2 w-32"
                            />
                        </div>
                    ))}
                    <div className="flex justify-between items-center">
                        <label className="text-white capitalize">Add Troops</label>
                        <select
                            value={troop.unit}
                            onChange={(e) => setTroop(prev => ({ ...prev, unit: e.target.value }))}
                            className="bg-gray-700 text-white rounded p-2 w-32"
                        >
                            {Object.keys(unitConfig).map(unitId => (
                                <option key={unitId} value={unitId}>{unitConfig[unitId].name}</option>
                            ))}
                        </select>
                        <input
                            type="number"
                            value={troop.amount}
                            onChange={(e) => setTroop(prev => ({ ...prev, amount: parseInt(e.target.value, 10) || 0 }))}
                            className="bg-gray-700 text-white rounded p-2 w-24"
                        />
                    </div>
                    <div className="flex justify-between items-center">
                        <label className="text-white capitalize">Upgrade Warehouse</label>
                        <input
                            type="number"
                            value={warehouseLevels}
                            onChange={(e) => setWarehouseLevels(parseInt(e.target.value, 10) || 0)}
                            className="bg-gray-700 text-white rounded p-2 w-32"
                        />
                    </div>
                </div>
                <button onClick={handleCheat} className="btn btn-primary w-full py-2 mt-6">
                    Apply Cheats
                </button>
            </div>
        </div>
    );
};

export default AdminCheatMenu;