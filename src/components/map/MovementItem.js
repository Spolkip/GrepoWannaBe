// src/components/map/MovementItem.js
import React, { useState, useEffect } from 'react';
import Countdown from './Countdown';
import unitConfig from '../../gameData/units.json';

// Dynamically import all unit images
const unitImages = {};
const imageContext = require.context('../../images', false, /\.(png|jpe?g|svg)$/);
imageContext.keys().forEach((item) => {
    const key = item.replace('./', '');
    unitImages[key] = imageContext(item);
});

const MovementItem = ({ movement, citySlots, onCancel, onRush, isAdmin }) => {
    const [isCancellable, setIsCancellable] = useState(false);

    const originCity = citySlots[movement.originCityId];
    const targetId = movement.targetCityId || movement.targetVillageId || movement.targetRuinId;
    const targetCity = citySlots[targetId];

    const movementTypes = {
        attack: { icon: '⚔️' },
        attack_village: { icon: '⚔️' },
        attack_ruin: { icon: '⚔️' },
        reinforce: { icon: '🛡️' },
        scout: { icon: '👁️' },
        trade: { icon: '💰' },
        return: { icon: '↩️' },
        default: { icon: '➡️' }
    };
    const config = movementTypes[movement.type] || movementTypes.default;

    useEffect(() => {
        const checkCancellable = () => {
            if (movement.cancellableUntil?.toDate) {
                const cancellableTime = movement.cancellableUntil.toDate();
                setIsCancellable(new Date() < cancellableTime);
            } else {
                setIsCancellable(false);
            }
        };

        checkCancellable();
        const interval = setInterval(checkCancellable, 1000);
        return () => clearInterval(interval);
    }, [movement.cancellableUntil]);

    const toCity = movement.status === 'returning' ? originCity : targetCity;
    const actionText = movement.status === 'returning' ? 'Returning' : movement.type.replace('_', ' ');

    const cancellableDate = movement.cancellableUntil?.toDate();
    const arrivalDate = movement.arrivalTime?.toDate();

    return (
        <div className="movement-item-row">
            <span className="movement-type-icon">{config.icon}</span>
            <div className="movement-details">
                <p className="title capitalize">
                    {actionText} to {toCity?.cityName || toCity?.name || 'Unknown'}
                </p>
                <p className="timing">
                    <Countdown arrivalTime={movement.arrivalTime} />
                    (Arrival: {arrivalDate ? arrivalDate.toLocaleTimeString() : 'N/A'})
                    {cancellableDate && ` (Cancellable until: ${cancellableDate.toLocaleTimeString()})`}
                </p>
            </div>
            <button
                onClick={() => onCancel(movement.id)}
                disabled={!isCancellable}
                className="cancel-button"
                title={isCancellable ? "Cancel Movement" : "Cannot be cancelled"}
            >
                &times;
            </button>
            <div className="unit-icons-container">
                {movement.units && Object.entries(movement.units).map(([unitId, count]) => {
                    if (count > 0) {
                        const unit = unitConfig[unitId];
                        return (
                            <img
                                key={unitId}
                                src={unitImages[unit.image]}
                                alt={unit.name}
                                className="unit-icon"
                                title={`${count}x ${unit.name}`}
                            />
                        );
                    }
                    return null;
                })}
            </div>
            {isAdmin && (
                <button onClick={() => onRush(movement.id)} className="btn btn-primary text-xs px-2 py-1">Rush</button>
            )}
        </div>
    );
};

export default MovementItem;
