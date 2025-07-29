import React, { useState } from 'react';

const AdminCheatMenu = ({ onCheat, onClose }) => {
    const [amounts, setAmounts] = useState({ wood: 0, stone: 0, silver: 0, population: 0 });

    const handleCheat = () => {
        onCheat(amounts);
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
                </div>
                <button onClick={handleCheat} className="btn btn-primary w-full py-2 mt-6">
                    Add Resources
                </button>
            </div>
        </div>
    );
};

export default AdminCheatMenu;