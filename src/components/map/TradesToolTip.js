// src/components/map/TradesTooltip.js
import React from 'react';
import MovementItem from './MovementItem';
import './../city/RecruitmentTooltip.css'; // Reuse the CSS for the tooltip container

const TradesTooltip = ({ movements, combinedSlots, onCancel }) => {
    const tradeMovements = movements.filter(m => m.type === 'trade' || (m.status === 'returning' && m.resources && Object.values(m.resources).some(r => r > 0)));

    return (
        <div className="activity-tooltip">
            {tradeMovements.length > 0 ? (
                tradeMovements.map(movement => (
                    <MovementItem
                        key={movement.id}
                        movement={movement}
                        citySlots={combinedSlots}
                        onCancel={onCancel}
                    />
                ))
            ) : (
                <p className="p-4 text-center text-sm">No active trade movements.</p>
            )}
        </div>
    );
};

export default TradesTooltip;
