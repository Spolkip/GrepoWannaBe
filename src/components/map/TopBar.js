import React, { useState, useEffect, useRef, useMemo, Suspense, lazy } from 'react';
import { useGame } from '../../contexts/GameContext';
import woodImage from '../../images/resources/wood.png';
import stoneImage from '../../images/resources/stone.png';
import silverImage from '../../images/resources/silver.png';
import populationImage from '../../images/resources/population.png';
import recruitmenticon from '../../images/helmet.png';
import tradeicon from '../../images/trade.png';
import movementicon from '../../images/movement.png'
import './TopBar.css';

// Lazy load the tooltip components to prevent circular dependencies
const RecruitmentTooltip = lazy(() => import('../city/RecruitmentToolTip'));
const TradesTooltip = lazy(() => import('./TradesToolTip'));
const MovementsTooltip = lazy(() => import('./MovementsToolTip'));


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

// Component to display resource details on hover
const ResourceTooltip = ({ resource, production, capacity }) => {
    if (!resource) return null;
    return (
        <div className="resource-tooltip">
            <h4 className="font-bold capitalize text-lg">{resource}</h4>
            <p className="text-sm">Production: <span className="font-semibold">+{production}/hr</span></p>
            <p className="text-sm">Capacity: <span className="font-semibold">{capacity.toLocaleString()}</span></p>
        </div>
    );
};


// TopBar component displays current city resources and name.
const TopBar = ({
    view,
    gameState,
    availablePopulation,
    happiness,
    worldState,
    productionRates,
    // #comment Props for the activity tracker
    movements,
    onCancelTrain,
    onCancelMovement,
    combinedSlots,
    onOpenMovements,
    isUnderAttack,
    incomingAttackCount,
    // #comment Prop for renaming city
    onRenameCity,
    // #comment New props for quests
    onOpenQuests,
    hasUnclaimedQuests,
    getWarehouseCapacity
}) => {
    const { playerCities, setActiveCityId, activeCityId } = useGame();
    const [isCityListOpen, setIsCityListOpen] = useState(false);
    const [activeTooltip, setActiveTooltip] = useState(null);
    const [hoveredResource, setHoveredResource] = useState(null);
    const tooltipTimeoutRef = useRef(null);
    const [isEditingCityName, setIsEditingCityName] = useState(false);
    const [newCityName, setNewCityName] = useState('');

    // #comment Safely converts Firestore Timestamps or JS Dates into a JS Date object
    const getSafeDate = (timestamp) => {
        if (!timestamp) return null;
        if (typeof timestamp.toDate === 'function') {
            return timestamp.toDate();
        }
        return new Date(timestamp);
    };

    // #comment Helper to identify if a movement is trade-related
    const isTradeMovement = (m) => {
        if (m.type === 'trade') return true;
        // It's also a trade if it's a returning trip carrying only resources
        if (m.status === 'returning' && m.resources && Object.values(m.resources).some(r => r > 0)) {
            if (!m.units || Object.values(m.units).every(count => count === 0)) {
                return true;
            }
        }
        return false;
    };

    // #comment Memoized calculation for recruitment queue count, filtering out completed items
    const recruitmentCount = useMemo(() => {
        if (!playerCities) return 0;
        return Object.values(playerCities).reduce((acc, city) => {
            const activeUnitQueue = (city.unitQueue || []).filter(item => {
                const endDate = getSafeDate(item.endTime);
                return endDate && endDate > new Date();
            });
            const activeHealQueue = (city.healQueue || []).filter(item => {
                const endDate = getSafeDate(item.endTime);
                return endDate && endDate > new Date();
            });
            return acc + activeUnitQueue.length + activeHealQueue.length;
        }, 0);
    }, [playerCities]);


    // #comment Memoized calculation for trade movement count
    const tradeCount = useMemo(() => {
        if (!movements) return 0;
        return movements.filter(isTradeMovement).length;
    }, [movements]);

    // #comment Memoized calculation for non-trade movements
    const movementCount = useMemo(() => {
        if (!movements) return 0;
        return movements.filter(m => !isTradeMovement(m)).length;
    }, [movements]);

    if (!gameState) return null;
    const { resources, cityName } = gameState;

    const happinessIcon = happiness > 70 ? '😊' : (happiness > 40 ? '😐' : '😠');
    const happinessTooltip = `Happiness: ${happiness}%. ${happiness > 70 ? 'Happy: +10% resource production!' : 'Content: No production bonus.'}`;

    const handleCitySelect = (cityId) => {
        setActiveCityId(cityId);
        setIsCityListOpen(false);
    };

    // #comment Handlers to show/hide tooltips with a small delay
    const handleMouseEnter = (tooltip) => {
        clearTimeout(tooltipTimeoutRef.current);
        setActiveTooltip(tooltip);
    };

    const handleMouseLeave = () => {
        tooltipTimeoutRef.current = setTimeout(() => {
            setActiveTooltip(null);
        }, 300);
    };

    // #comment Handlers for city name editing
    const handleDoubleClick = () => {
        setNewCityName(gameState.cityName);
        setIsEditingCityName(true);
    };

    const handleNameChange = (e) => {
        setNewCityName(e.target.value);
    };

    const handleNameSubmit = async () => {
        if (newCityName.trim() && newCityName.trim() !== gameState.cityName) {
            try {
                await onRenameCity(activeCityId, newCityName.trim());
            } catch (error) {
                console.error("Failed to rename city:", error);
                // Optionally, show a message to the user
            }
        }
        setIsEditingCityName(false);
    };

    const handleInputKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleNameSubmit();
        } else if (e.key === 'Escape') {
            setIsEditingCityName(false);
        }
    };
    
    // #comment Handlers for resource hover
    const handleResourceMouseEnter = (resourceName) => {
        setHoveredResource(resourceName);
    };

    const handleResourceMouseLeave = () => {
        setHoveredResource(null);
    };

    return (
        <div className={`p-2 flex items-center justify-between top-bar-container relative z-30 ${view === 'map' ? 'absolute top-0 left-0 right-0' : 'flex-shrink-0'}`}>
            {/* Left Section */}
            <div className="flex-1 flex justify-start items-center space-x-4">
                {worldState && <WeatherDisplay season={worldState.season} weather={worldState.weather} />}
            </div>

            {/* Center Section */}
            <div className="flex-none flex justify-center items-center space-x-8">
                <div
                    className="activity-tracker-container"
                    onMouseLeave={handleMouseLeave}
                >
                    <div className="relative" onMouseEnter={() => handleMouseEnter('recruitment')}>
                        <button className="activity-icon-image-container">
                            <img src={recruitmenticon} alt="Recruitment" className="activity-icon-image" />
                        </button>
                        {recruitmentCount > 0 && <span className="activity-badge">{recruitmentCount}</span>}
                    </div>
                    <div className="relative" onMouseEnter={() => handleMouseEnter('trades')}>
                        <img src={tradeicon} alt="Trade" className="activity-icon-image" />
                        {tradeCount > 0 && <span className="activity-badge">{tradeCount}</span>}
                    </div>
                     <div className="relative" onMouseEnter={() => handleMouseEnter('movements')}>
                        <button onClick={onOpenMovements} className={`activity-icon ${isUnderAttack ? 'glowing-attack-icon' : ''}`}>
                            <img src={movementicon} alt="Movement" className="activity-icon-image" />
                        </button>
                        {movementCount > 0 && <span className="activity-badge">{movementCount}</span>}
                    </div>
                    
                    <Suspense fallback={null}>
                        {activeTooltip === 'recruitment' && (
                            <RecruitmentTooltip playerCities={playerCities} onCancelTrain={onCancelTrain} />
                        )}
                        {activeTooltip === 'trades' && (
                            <TradesTooltip movements={movements} combinedSlots={combinedSlots} onCancel={onCancelMovement} />
                        )}
                        {activeTooltip === 'movements' && (
                            <MovementsTooltip movements={movements} combinedSlots={combinedSlots} onCancel={onCancelMovement} />
                        )}
                    </Suspense>
                </div>
                {isEditingCityName ? (
                    <input
                        type="text"
                        value={newCityName}
                        onChange={handleNameChange}
                        onBlur={handleNameSubmit}
                        onKeyDown={handleInputKeyDown}
                        autoFocus
                        className="font-title text-xl text-center bg-gray-900 text-white border border-yellow-400 rounded px-2"
                    />
                ) : (
                    <div className="relative" onDoubleClick={handleDoubleClick}>
                        <button
                            className="font-title text-xl text-white city-name-dropdown-btn"
                            onClick={() => setIsCityListOpen(prev => !prev)}
                            title="Click to switch city | Double-click to rename"
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
                )}
            </div>

            {/* Right Section */}
            <div className="flex-1 flex justify-end items-center space-x-2">
                <div 
                    className="resource-display relative"
                    onMouseEnter={() => handleResourceMouseEnter('wood')}
                    onMouseLeave={handleResourceMouseLeave}
                >
                    <img src={woodImage} alt="Wood" className="w-6 h-6 mr-2"/> 
                    <span className="text-yellow-300 font-bold">{Math.floor(resources.wood)}</span>
                    {productionRates && <span className="text-xs text-gray-400 ml-1">(+{productionRates.wood}/hr)</span>}
                    {hoveredResource === 'wood' && (
                        <ResourceTooltip
                            resource="wood"
                            production={productionRates.wood}
                            capacity={getWarehouseCapacity(gameState.buildings.warehouse.level)}
                        />
                    )}
                </div>
                <div 
                    className="resource-display relative"
                    onMouseEnter={() => handleResourceMouseEnter('stone')}
                    onMouseLeave={handleResourceMouseLeave}
                >
                    <img src={stoneImage} alt="Stone" className="w-6 h-6 mr-2"/> 
                    <span className="text-gray-300 font-bold">{Math.floor(resources.stone)}</span>
                     {productionRates && <span className="text-xs text-gray-400 ml-1">(+{productionRates.stone}/hr)</span>}
                     {hoveredResource === 'stone' && (
                        <ResourceTooltip
                            resource="stone"
                            production={productionRates.stone}
                            capacity={getWarehouseCapacity(gameState.buildings.warehouse.level)}
                        />
                    )}
                </div>
                <div 
                    className="resource-display relative"
                    onMouseEnter={() => handleResourceMouseEnter('silver')}
                    onMouseLeave={handleResourceMouseLeave}
                >
                    <img src={silverImage} alt="Silver" className="w-6 h-6 mr-2"/> 
                    <span className="text-blue-300 font-bold">{Math.floor(resources.silver)}</span>
                     {productionRates && <span className="text-xs text-gray-400 ml-1">(+{productionRates.silver}/hr)</span>}
                     {hoveredResource === 'silver' && (
                        <ResourceTooltip
                            resource="silver"
                            production={productionRates.silver}
                            capacity={getWarehouseCapacity(gameState.buildings.warehouse.level)}
                        />
                    )}
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
