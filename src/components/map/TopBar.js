// src/components/map/TopBar.js
import React, { useState, useEffect, useRef } from 'react';
import { useGame } from '../../contexts/GameContext';
import woodImage from '../../images/resources/wood.png';
import stoneImage from '../../images/resources/stone.png';
import silverImage from '../../images/resources/silver.png';
import populationImage from '../../images/resources/population.png';
import './TopBar.css';

// A dropdown to show all player cities and allow switching between them
const CityListDropdown = ({ cities, onSelect, onClose, activeCityId }) => {
    const dropdownRef = useRef(null);

    // Close dropdown if clicked outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                onClose();
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [onClose]);

    return (
        <div ref={dropdownRef} className="absolute top-full mt-2 w-64 bg-gray-800 border border-gray-600 rounded-lg shadow-lg z-50">
            <ul>
                {Object.values(cities).map(city => (
                    <li key={city.id}>
                        <button
                            onClick={() => onSelect(city.id)}
                            className={`w-full text-left px-4 py-2 hover:bg-gray-700 ${city.id === activeCityId ? 'bg-blue-600' : ''}`}
                        >
                            {city.cityName}
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
};

// displays season and weather icons and text
const WeatherDisplay = ({ season, weather }) => {
    const weatherIcons = {
        Clear: '☀️',
        Rainy: '🌧️',
        Windy: '💨',
        Foggy: '🌫️',
        Stormy: '⛈️',
    };
    const seasonColors = {
        Spring: 'text-pink-400',
        Summer: 'text-yellow-400',
        Autumn: 'text-orange-400',
        Winter: 'text-blue-400',
    };

    return (
        <div className="weather-display" title={`${season}, ${weather}`}>
            <span className="text-xl mr-2">{weatherIcons[weather] || '❓'}</span>
            <span className={`font-bold ${seasonColors[season] || 'text-white'}`}>{season}</span>
            <span className="text-white mx-2">|</span>
            <span className="font-bold text-white">{weather}</span>
        </div>
    );
};

// TopBar component displays current city resources and name.
const TopBar = ({ view, gameState, availablePopulation, happiness, worldState, productionRates }) => {
    const { playerCities, setActiveCityId, activeCityId } = useGame();
    const [isCityListOpen, setIsCityListOpen] = useState(false);

    if (!gameState) return null;
    const { resources, cityName } = gameState;

    const happinessIcon = happiness > 70 ? '😊' : (happiness > 40 ? '😐' : '😠');
    const happinessTooltip = `Happiness: ${happiness}%. ${happiness > 70 ? 'Happy: +10% resource production!' : 'Content: No production bonus.'}`;
    
    const handleCitySelect = (cityId) => {
        setActiveCityId(cityId);
        setIsCityListOpen(false);
    };

    return (
        <div className={`p-2 flex justify-between items-center top-bar-container ${view === 'map' ? 'absolute top-0 left-0 right-0 z-50' : 'flex-shrink-0'}`}>
            {/* Left Section */}
            <div>
                {worldState && <WeatherDisplay season={worldState.season} weather={worldState.weather} />}
            </div>

            {/* Center Section */}
            <div className="absolute left-1/2 -translate-x-1/2">
                 <div className="relative">
                    <button
                        className="font-title text-xl text-white city-name-dropdown-btn"
                        onClick={() => setIsCityListOpen(prev => !prev)}
                        title="Click to switch city"
                    >
                        {cityName}
                    </button>
                    {isCityListOpen && (
                        <CityListDropdown
                            cities={playerCities}
                            onSelect={handleCitySelect}
                            onClose={() => setIsCityListOpen(false)}
                            activeCityId={activeCityId}
                        />
                    )}
                </div>
            </div>

            {/* Right Section */}
            <div className="flex items-center space-x-2">
                <div className="resource-display">
                    <img src={woodImage} alt="Wood" className="w-6 h-6 mr-2"/> 
                    <span className="text-yellow-300 font-bold">{Math.floor(resources.wood)}</span>
                    {productionRates && <span className="text-xs text-gray-400 ml-1">(+{productionRates.wood}/hr)</span>}
                </div>
                <div className="resource-display">
                    <img src={stoneImage} alt="Stone" className="w-6 h-6 mr-2"/> 
                    <span className="text-gray-300 font-bold">{Math.floor(resources.stone)}</span>
                     {productionRates && <span className="text-xs text-gray-400 ml-1">(+{productionRates.stone}/hr)</span>}
                </div>
                <div className="resource-display">
                    <img src={silverImage} alt="Silver" className="w-6 h-6 mr-2"/> 
                    <span className="text-blue-300 font-bold">{Math.floor(resources.silver)}</span>
                     {productionRates && <span className="text-xs text-gray-400 ml-1">(+{productionRates.silver}/hr)</span>}
                </div>
                <div className="resource-display">
                    <img src={populationImage} alt="Population" className="w-6 h-6 mr-2"/>
                    <span className="font-bold text-red-400">{Math.floor(availablePopulation)}</span>
                </div>
                <div className="resource-display" title={happinessTooltip}>
                    <span className="text-xl mr-2">{happinessIcon}</span>
                    <span className="font-bold text-green-400">{happiness}%</span>
                </div>
            </div>
        </div>
    );
};

export default TopBar;
