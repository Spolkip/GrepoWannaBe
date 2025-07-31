// src/components/map/MovementsPanel.js
import React from 'react';
import MovementItem from './MovementItem'; // Import MovementItem component

// MovementsPanel component displays a list of all active troop movements.
const MovementsPanel = ({ movements, onClose, combinedSlots, villages, onRush, isAdmin }) => {
    const allLocations = { ...combinedSlots, ...villages };

    return (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-2xl border-2 border-gray-600" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-title text-3xl text-white">Movements</h3>
                    <button onClick={onClose} className="text-gray-400 text-3xl leading-none hover:text-white">&times;</button>
                </div>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                    {movements.length > 0 ? movements.map(movement => (
                        // Render each movement using the MovementItem component
                        <MovementItem
                            key={movement.id}
                            movement={movement}
                            citySlots={allLocations}
                            onRush={onRush}
                            isAdmin={isAdmin}
                        />
                    )) : <p className="text-gray-400">No active movements.</p>}
                </div>
            </div>
        </div>
    );
};

export default MovementsPanel;