// src/components/map/MovementsToolTip.js
import React from 'react';
import MovementItem from './MovementItem';
import './MovementsToolTip.css';

const MovementsTooltip = ({ movements, combinedSlots, onCancel }) => {
    // #comment Helper to identify if a movement is trade-related
    const isTradeMovement = (m) => {
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
    const activeMovements = movements.filter(m => !isTradeMovement(m));

    return (
        <div className="activity-tooltip">
            {activeMovements.length > 0 ? (
                activeMovements.map(movement => (
                    <MovementItem
                        key={movement.id}
                        movement={movement}
                        citySlots={combinedSlots}
                        onCancel={onCancel}
                    />
                ))
            ) : (
                <p className="p-4 text-center text-sm">No active movements.</p>
            )}
        </div>
    );
};

export default MovementsTooltip;