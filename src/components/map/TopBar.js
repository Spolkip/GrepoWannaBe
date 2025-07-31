import React from 'react';
import woodImage from '../../images/resources/wood.png';
import stoneImage from '../../images/resources/stone.png';
import silverImage from '../../images/resources/silver.png';
import populationImage from '../../images/resources/population.png';

// TopBar component displays current city resources and name.
const TopBar = ({ gameState, availablePopulation, maxPopulation }) => {
    if (!gameState) return null; // Don't render if gameState is not available
    const { resources, cityName } = gameState; // Destructure resources and cityName from gameState

    return (
        <div className="absolute top-0 left-0 right-0 z-20 p-2 flex justify-between items-center bg-gray-900 bg-opacity-70">
            <h2 className="font-title text-xl text-white">{cityName}</h2>
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
            </div>
        </div>
    );
};

export default TopBar;