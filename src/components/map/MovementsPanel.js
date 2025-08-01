// src/components/map/MovementsPanel.js
import React from 'react';
import MovementItem from './MovementItem';
import './MovementsPanel.css'; // Import the new CSS

const MovementsPanel = ({ movements, onClose, combinedSlots, villages, onCancel, onRush, isAdmin }) => {
    const allLocations = { ...combinedSlots, ...villages };

    return (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div className="movements-panel-bg w-full max-w-4xl rounded-lg" onClick={e => e.stopPropagation()}>
                <div className="movements-header rounded-t-sm">
                    <h3>Movement Overview</h3>
                </div>
                <div className="max-h-[60vh] overflow-y-auto">
                    {movements.length > 0 ? (
                        movements.map(movement => (
                            <MovementItem
                                key={movement.id}
                                movement={movement}
                                citySlots={allLocations}
                                onCancel={onCancel}
                                onRush={onRush}
                                isAdmin={isAdmin}
                            />
                        ))
                    ) : (
                        <p className="p-8 text-center text-gray-700 italic">No active movements.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MovementsPanel;
