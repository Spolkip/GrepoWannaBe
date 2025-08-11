import React from 'react';
import './OtherCityModal.css'; // Reusing styles
import TroopDisplay from '../TroopDisplay';
import unitsData from '../../gameData/units.json';

const OwnActiveCityModal = ({ city, onClose, onEnterCity, onGoTo, onWithdraw }) => {
    if (!city) return null;

    const handleGoTo = () => {
        if (onGoTo) {
            onGoTo(city.x, city.y);
        }
        onClose();
    };

    const hasReinforcements = city.reinforcements && Object.keys(city.reinforcements).length > 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div className="other-city-modal-container" onClick={e => e.stopPropagation()}>
                <div className="other-city-modal-header">
                    <h3 className="font-title text-2xl">Active City: {city.cityName}</h3>
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
                    <p className="text-center mb-4">This is your currently selected city.</p>
                    <div className="action-buttons-grid">
                        <button onClick={() => onEnterCity(city.id)} className="action-btn">
                            Enter City
                        </button>
                        <button onClick={handleGoTo} className="action-btn">
                            Center on Map
                        </button>
                        {hasReinforcements && (
                             <button onClick={() => onWithdraw(city)} className="action-btn">
                                Withdraw Troops
                            </button>
                        )}
                        <button disabled className={`action-btn ${hasReinforcements ? '' : 'col-span-2'}`}>
                            City Selected
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OwnActiveCityModal;
