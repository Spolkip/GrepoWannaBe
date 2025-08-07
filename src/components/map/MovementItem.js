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
    
    // #comment Determine the correct target ID from the movement object, with fallbacks
    const targetId = movement.targetCityId || movement.targetSlotId || movement.targetVillageId || movement.targetRuinId || movement.targetTownId;
    const targetLocation = citySlots[targetId];

    const movementTypes = {
        attack: { icon: '⚔️' },
        attack_village: { icon: '⚔️' },
        attack_ruin: { icon: '⚔️' },
        attack_god_town: { icon: '⚔️' },
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
    
    const destinationName = targetLocation?.cityName || targetLocation?.name || movement.targetCityName || movement.targetVillageName || movement.targetRuinName || movement.targetTownName || 'Unknown';
    const originName = originCity?.cityName || movement.originCityName || 'Unknown';
    
    const actionText = movement.type.replace(/_/g, ' ');
    const titleText = movement.status === 'returning' 
        ? `Returning from ${destinationName}`
        : `${actionText} from ${originName} to ${destinationName}`;

    const cancellableDate = movement.cancellableUntil?.toDate();
    const arrivalDate = movement.arrivalTime?.toDate();

    return (
        <div className="movement-item-row">
            <span className="movement-type-icon">{config.icon}</span>
            <div className="movement-details">
                <p className="title capitalize">
                    {titleText}
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
