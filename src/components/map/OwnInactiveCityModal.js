// src/components/map/OwnInactiveCityModal.js
import React from 'react';
import TroopDisplay from '../TroopDisplay';
import unitsData from '../../gameData/units.json';
import './OtherCityModal.css'; // Reuse styles

const OwnInactiveCityModal = ({ city, onClose, onAction, onGoTo, onEnterCity, onSelectCity }) => {
    if (!city) return null;

    const handleGoTo = () => {
        if (onGoTo) {
            onGoTo(city.x, city.y);
        }
        onClose();
    };

    const handleSelect = () => {
        if (onSelectCity) {
            onSelectCity(city.id);
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div className="other-city-modal-container" onClick={e => e.stopPropagation()}>
                <div className="other-city-modal-header">
                    <h3 className="font-title text-2xl">Your City: {city.cityName}</h3>
                    <button onClick={onClose} className="close-btn">&times;</button>
                </div>
                <div className="other-city-modal-content">
                    <div className="info-box">
                        <TroopDisplay units={city.units} unitsData={unitsData} title="Garrison" />
                    </div>
                    <div className="action-buttons-grid">
                        <button onClick={() => onEnterCity(city.id)} className="action-btn">
                            Enter City
                        </button>
                        <button onClick={handleSelect} className="action-btn">
                            Select City
                        </button>
                        <button onClick={() => onAction('reinforce', city)} className="action-btn reinforce-btn">
                            Reinforce
                        </button>
                        <button onClick={() => onAction('trade', city)} className="action-btn">
                            Trade
                        </button>
                        <button onClick={handleGoTo} className="action-btn col-span-2">
                            Center on Map
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OwnInactiveCityModal;
