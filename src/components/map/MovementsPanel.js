// src/components/map/MovementsPanel.js
import React from 'react';
import MovementItem from './MovementItem';
import './MovementsPanel.css'; // Import the new CSS

const MovementsPanel = ({ movements, onClose, combinedSlots, villages, onCancel, onRush, isAdmin }) => {
    const allLocations = { ...combinedSlots, ...villages };

    // #comment Filter out trade movements and resource returns, as they are handled by the trades tooltip.
    const nonTradeMovements = movements.filter(m => 
        !(m.type === 'trade' || (m.status === 'returning' && m.resources && Object.values(m.resources).some(r => r > 0)))
    );

    return (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div className="movements-panel-bg w-full max-w-4xl rounded-lg" onClick={e => e.stopPropagation()}>
                <div className="movements-header rounded-t-sm">
                    <h3>Movement Overview</h3>
                </div>
                <div className="max-h-[60vh] overflow-y-auto">
                    {nonTradeMovements.length > 0 ? (
                        nonTradeMovements.map(movement => (
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
