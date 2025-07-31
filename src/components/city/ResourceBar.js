import React from 'react';
import woodImage from '../../images/resources/wood.png';
import stoneImage from '../../images/resources/stone.png';
import silverImage from '../../images/resources/silver.png';
import populationImage from '../../images/resources/population.png';

const ResourceBar = ({ resources, productionRates, availablePopulation }) => {
    return (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 p-4 flex-shrink-0 z-10">
            <div className="bg-gray-800 p-3 rounded-lg flex items-center border border-gray-700">
                <img src={woodImage} alt="Wood" className="resource-icon rounded"/>
                <div><span className="font-bold text-lg text-yellow-300">{Math.floor(resources.wood).toLocaleString()}</span><span className="text-xs text-gray-400"> (+{productionRates.wood}/hr)</span></div>
            </div>
            <div className="bg-gray-800 p-3 rounded-lg flex items-center border border-gray-700">
                <img src={stoneImage} alt="Stone" className="resource-icon rounded"/>
                <div><span className="font-bold text-lg text-gray-300">{Math.floor(resources.stone).toLocaleString()}</span><span className="text-xs text-gray-400"> (+{productionRates.stone}/hr)</span></div>
            </div>
            <div className="bg-gray-800 p-3 rounded-lg flex items-center border border-gray-700">
                <img src={silverImage} alt="Silver" className="resource-icon rounded"/>
                <div><span className="font-bold text-lg text-blue-300">{Math.floor(resources.silver).toLocaleString()}</span><span className="text-xs text-gray-400"> (+{productionRates.silver}/hr)</span></div>
            </div>
            <div className="bg-gray-800 p-3 rounded-lg flex items-center border border-gray-700">
                <img src={populationImage} alt="Population" className="resource-icon rounded"/>
                <div><span className="font-bold text-lg text-red-400">{availablePopulation.toLocaleString()}</span><span className="text-xs text-gray-400"> Available Pop.</span></div>
            </div>
        </div>
    );
};

export default ResourceBar;