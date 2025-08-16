// src/components/map/OwnInactiveCityModal.js
import React from 'react';
import TroopDisplay from '../TroopDisplay';
import unitsData from '../../gameData/units.json';
import './OtherCityModal.css'; // Reuse styles

const OwnInactiveCityModal = ({ city, onClose, onAction, onGoTo, onEnterCity, onSelectCity, onWithdraw }) => {
    console.log("OwnInactiveCityModal rendered for city:", city?.cityName, "ID:", city?.id); // User requested log
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

    const handleEnter = () => {
        console.log("Attempting to enter city from OwnInactiveCityModal. ID:", city.id); // User requested log
        onEnterCity(city.id);
    };

    const hasReinforcements = city.reinforcements && Object.keys(city.reinforcements).length > 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div className="other-city-modal-container" onClick={e => e.stopPropagation()}>
                <div className="other-city-modal-header">
                    <h3 className="font-title text-2xl">Your City: {city.cityName}</h3>
                    <button onClick={onClose} className="close-btn">&times;</button>
                </div>
                <div className="other-city-modal-content">
                    <div className="info-box">
                        <TroopDisplay 
                            units={city.units} 
                            unitsData={unitsData} 
                            title="Garrison"
                            reinforcements={city.reinforcements}
                        />
                    </div>
                    <div className="action-buttons-grid">
                        <button onClick={handleEnter} className="action-btn">
                            Enter City
                        </button>
                        <button onClick={handleSelect} className="action-btn">
                            Select City
                        </button>
                        <button 
                            onClick={() => onAction('reinforce', city)}
                            className="action-btn reinforce-btn"
                        >
                            Reinforce
                        </button>
                        <button 
                            onClick={() => onAction('trade', city)}
                            className="action-btn"
                        >
                            Trade
                        </button>
                        {hasReinforcements && (
                            <button onClick={() => onWithdraw(city)} className="action-btn">
                                Withdraw Troops
                            </button>
                        )}
                        <button onClick={handleGoTo} className="action-btn">
                            Center on Map
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OwnInactiveCityModal;
