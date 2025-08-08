// src/components/map/MovementsPanel.js
import React from 'react';
import MovementItem from './MovementItem';
import './MovementsPanel.css'; // Import the new CSS

const MovementsPanel = ({ movements, onClose, combinedSlots, villages, onCancel, onRush, isAdmin }) => {
    const allLocations = { ...combinedSlots, ...villages };

    // #comment Helper to identify if a movement is trade-related
    const isTradeMovement = (m) => {
        if (!m) return false;
        if (m.type === 'trade') return true;
        // It's also a trade if it's a returning trip carrying only resources
        if (m.status === 'returning' && m.resources && Object.values(m.resources).some(r => r > 0)) {
            if (!m.units || Object.values(m.units).every(count => count === 0)) {
                return true;
            }
        }
        return false;
    };

    // #comment Filter out trade movements, as they are handled by the trades tooltip.
    const nonTradeMovements = movements.filter(m => !isTradeMovement(m));

    return (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div className="movements-panel-bg w-full max-w-4xl rounded-lg" onClick={e => e.stopPropagation()}>
                <div className="movements-header rounded-t-sm">
                    <h3>Movement Overview</h3>
                </div>
                <div className="max-h-[60vh] overflow-y-auto">
                    {nonTradeMovements.length > 0 ? (
                        nonTradeMovements.map(movement => (
                            <div key={movement.id} className="flex items-center">
                                <MovementItem
                                    movement={movement}
                                    citySlots={allLocations}
                                    onCancel={onCancel}
                                    onRush={onRush}
                                    isAdmin={isAdmin}
                                />
                            </div>
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
