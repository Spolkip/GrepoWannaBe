// src/components/city/RecruitmentTooltip.js
import React from 'react';
import Countdown from '../map/Countdown';
import unitConfig from '../../gameData/units.json';
import './RecruitmentTooltip.css';

const images = {};
const imageContext = require.context('../../images', false, /\.(png|jpe?g|svg)$/);
imageContext.keys().forEach((item) => {
    const key = item.replace('./', '');
    images[key] = imageContext(item);
});

const RecruitmentTooltip = ({ playerCities, onCancelTrain }) => {
    const allQueues = Object.values(playerCities).flatMap(city => 
        (city.unitQueue || []).map((item, index) => ({ ...item, cityId: city.id, cityName: city.cityName, isHealing: false, index }))
        .concat((city.healQueue || []).map((item, index) => ({ ...item, cityId: city.id, cityName: city.cityName, isHealing: true, index })))
    ).sort((a, b) => (a.endTime?.toDate() || new Date()) - (b.endTime?.toDate() || new Date()));

    if (allQueues.length === 0) {
        return (
            <div className="activity-tooltip">
                <p className="p-4 text-center text-sm">No active recruitments.</p>
            </div>
        );
    }

    return (
        <div className="activity-tooltip">
            {allQueues.map((item, globalIndex) => {
                const unit = unitConfig[item.unitId];
                return (
                    <div key={`${item.cityId}-${item.index}-${item.isHealing}`} className="tooltip-item">
                        <img src={images[unit.image]} alt={unit.name} className="tooltip-item-image" />
                        <div className="tooltip-item-details">
                            <p className="font-bold">{item.amount}x {unit.name} <span className="text-xs text-gray-400">({item.cityName})</span></p>
                            <div className="tooltip-timer">
                                <Countdown arrivalTime={item.endTime} />
                            </div>
                        </div>
                        <button onClick={() => onCancelTrain(item.cityId, item.index, item.isHealing)} className="tooltip-cancel-btn">&times;</button>
                    </div>
                );
            })}
        </div>
    );
};

export default RecruitmentTooltip;
