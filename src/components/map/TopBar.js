// src/components/map/TopBar.js
import React from 'react';
import woodImage from '../../images/resources/wood.png';
import stoneImage from '../../images/resources/stone.png';
import silverImage from '../../images/resources/silver.png';
import populationImage from '../../images/resources/population.png';

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
        <div className="flex items-center bg-black bg-opacity-30 px-3 py-1 rounded-full" title={`${season}, ${weather}`}>
            <span className="text-xl mr-2">{weatherIcons[weather] || '❓'}</span>
            <span className={`font-bold ${seasonColors[season] || 'text-white'}`}>{season}</span>
            <span className="text-white mx-2">|</span>
            <span className="font-bold text-white">{weather}</span>
        </div>
    );
};

// TopBar component displays current city resources and name.
const TopBar = ({ gameState, availablePopulation, maxPopulation, happiness, worldState }) => {
    if (!gameState) return null; // Don't render if gameState is not available
    const { resources, cityName } = gameState; // Destructure resources and cityName from gameState

    const happinessIcon = happiness > 70 ? '😊' : (happiness > 40 ? '😐' : '😠');
    const happinessTooltip = happiness > 70 ? `Happy: +10% resource production!` : `Content: No production bonus.`;

    return (
        <div className="absolute top-0 left-0 right-0 z-20 p-2 flex justify-between items-center bg-gray-900 bg-opacity-70">
            <div>
                <h2 className="font-title text-xl text-white">{cityName}</h2>
            </div>

            <div className="absolute left-1/2 -translate-x-1/2">
                {worldState && <WeatherDisplay season={worldState.season} weather={worldState.weather} />}
            </div>

            <div className="flex items-center space-x-4">
                {/* Display wood resource with icon and amount */}
                <div className="flex items-center">
                    <img src={woodImage} alt="Wood" className="w-6 h-6 mr-2 text-yellow-700"/> 
                    <span className="text-yellow-300 font-bold">{Math.floor(resources.wood)}</span>
                </div>
                {/* Display stone resource with icon and amount */}
                <div className="flex items-center">
                    <img src={stoneImage} alt="Stone" className="w-6 h-6 mr-2 text-gray-500"/> 
                    <span className="text-gray-300 font-bold">{Math.floor(resources.stone)}</span>
                </div>
                {/* Display silver resource with icon and amount */}
                <div className="flex items-center">
                    <img src= {silverImage} alt="Silver" className="w-6 h-6 mr-2 text-gray-300"/> 
                    <span className="text-blue-300 font-bold">{Math.floor(resources.silver)}</span>
                </div>
                {/* Display Population */}
                <div className="flex items-center">
                    <img src={populationImage} alt="Population" className="w-6 h-6 mr-2"/>
                    <span className="font-bold text-red-400">{Math.floor(availablePopulation)}</span>
                </div>
                 {/* Display Happiness */}
                <div className="flex items-center" title={happinessTooltip}>
                    <span className="text-xl mr-2">{happinessIcon}</span>
                    <span className="font-bold text-green-400">{happiness}%</span>
                </div>
            </div>
        </div>
    );
};

export default TopBar;
