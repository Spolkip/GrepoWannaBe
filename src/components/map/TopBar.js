// src/components/map/TopBar.js
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useGame } from '../../contexts/GameContext';
import woodImage from '../../images/resources/wood.png';
import stoneImage from '../../images/resources/stone.png';
import silverImage from '../../images/resources/silver.png';
import populationImage from '../../images/resources/population.png';
import recruitmenticon from '../../images/helmet.png';
import tradeicon from '../../images/trade.png';
import movementicon from '../../images/movement.png'
import './TopBar.css';

// #comment Import tooltips directly to place them inside relative containers
import RecruitmentTooltip from '../city/RecruitmentToolTip';
import TradesTooltip from './TradesToolTip';
import MovementsTooltip from './MovementsToolTip';


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
        <div ref={dropdownRef} className="city-list-dropdown absolute top-full mt-2 w-64 rounded-lg shadow-lg z-50">
            <ul>
                {Object.values(cities).map(city => (
                    <li key={city.id}>
                        <button
                            onClick={() => onSelect(city.id)}
                            className={`city-list-item ${city.id === activeCityId ? 'active' : ''}`}
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
        Spring: 'text-pink-600',
        Summer: 'text-yellow-600',
        Autumn: 'text-orange-600',
        Winter: 'text-blue-600',
    };

    return (
        <div className="weather-display">
            <span className="text-xl mr-2">{weatherIcons[weather] || '❓'}</span>
            <span className={`font-bold ${seasonColors[season] || 'text-inherit'}`}>{season}</span>
            <span className="mx-2">|</span>
            <span className="font-bold">{weather}</span>
        </div>
    );
};

// Component to display resource details on hover
const ResourceTooltip = ({ resource, production, capacity, isLocked, countdown }) => {
    if (!resource) return null;
    return (
        <div className="resource-tooltip">
            <h4 className="font-bold capitalize text-lg">{resource}</h4>
            <p className="text-sm">Production: <span className="font-semibold">+{production}/hr</span></p>
            <p className="text-sm">Capacity: <span className="font-semibold">{capacity.toLocaleString()}</span></p>
            <div className="tooltip-lock-timer">
                {isLocked ? '🔒' : countdown}
            </div>
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
    getWarehouseCapacity,
    onSwitchCity
}) => {
    const { playerCities, activeCityId } = useGame();
    const [isCityListOpen, setIsCityListOpen] = useState(false);
    const [activeTooltip, setActiveTooltip] = useState(null);
    const [isTooltipLocked, setIsTooltipLocked] = useState(false);
    const tooltipTimeoutRef = useRef(null);
    const lockTooltipTimeoutRef = useRef(null); // #comment Ref for the auto-lock timer
    const activityTrackerRef = useRef(null);
    const [isEditingCityName, setIsEditingCityName] = useState(false);
    const [newCityName, setNewCityName] = useState('');
    const [lockCountdown, setLockCountdown] = useState(5);
    const countdownIntervalRef = useRef(null);

    // #comment This hook handles clicks outside the activity tracker to close a locked tooltip.
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (isTooltipLocked && activityTrackerRef.current && !activityTrackerRef.current.contains(event.target)) {
                setIsTooltipLocked(false);
                setActiveTooltip(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isTooltipLocked]);

    // #comment This effect automatically locks the tooltip after a delay if the user hovers over it.
    useEffect(() => {
        clearTimeout(lockTooltipTimeoutRef.current);
        clearInterval(countdownIntervalRef.current);
        setLockCountdown(5);

        if (activeTooltip && !isTooltipLocked) {
            countdownIntervalRef.current = setInterval(() => {
                setLockCountdown(prev => {
                    if (prev <= 1) {
                        clearInterval(countdownIntervalRef.current);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);

            lockTooltipTimeoutRef.current = setTimeout(() => {
                setIsTooltipLocked(true);
                clearInterval(countdownIntervalRef.current);
            }, 5000);
        }

        return () => {
            clearTimeout(lockTooltipTimeoutRef.current);
            clearInterval(countdownIntervalRef.current);
        };
    }, [activeTooltip, isTooltipLocked]);

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
        if (!m) return false;
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
            const activeUnitQueue = (city.barracksQueue || []).concat(city.shipyardQueue || []).concat(city.divineTempleQueue || []).filter(item => {
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
    
    // #comment Memoized calculation for the happiness tooltip
    const happinessTooltip = useMemo(() => {
        if (!gameState?.buildings) return `Happiness: ${happiness}%`;

        const baseHappiness = (gameState.buildings.senate?.level || 0) * 5;
        let workerCount = 0;
        const productionBuildings = ['timber_camp', 'quarry', 'silver_mine'];
        productionBuildings.forEach(buildingId => {
            if (gameState.buildings[buildingId]?.workers) {
                workerCount += gameState.buildings[buildingId].workers;
            }
        });
        const happinessPenalty = workerCount * 3;

        return `Happiness: ${happiness}%\nBase: ${baseHappiness}%\nWorker Penalty: -${happinessPenalty}%`;
    }, [gameState, happiness]);


    if (!gameState) return null;
    const { resources, cityName } = gameState;

    const happinessIcon = happiness > 70 ? '😊' : (happiness > 40 ? '😐' : '😠');

    const handleCitySelect = (cityId) => {
        if (onSwitchCity) {
            onSwitchCity(cityId);
        }
        setIsCityListOpen(false);
    };

    // #comment Handlers to show/hide tooltips with a small delay
    const handleMouseEnter = (tooltip) => {
        // If a different tooltip is locked, unlock it and show the new one.
        if (isTooltipLocked && activeTooltip !== tooltip) {
            setIsTooltipLocked(false);
        }
        clearTimeout(tooltipTimeoutRef.current); // Clear any pending hide timer
        setActiveTooltip(tooltip);
    };

    const handleMouseLeave = () => {
        if (isTooltipLocked) return; // Don't hide if locked
        tooltipTimeoutRef.current = setTimeout(() => {
            setActiveTooltip(null);
        }, 300);
    };
    
    const handleTooltipClick = (e, tooltip) => {
        e.stopPropagation();
        // Toggle lock state on click
        if (isTooltipLocked && activeTooltip === tooltip) {
            setIsTooltipLocked(false);
            setActiveTooltip(null); // Hide immediately on unlock-click
        } else {
            setIsTooltipLocked(true);
            setActiveTooltip(tooltip); // Ensure it's active and locked
        }
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

    return (
        <div className={`p-2 flex items-center justify-between top-bar-container z-30 ${view === 'map' ? 'absolute top-0 left-0 right-0' : 'relative flex-shrink-0'}`}>
            {/* Left Section */}
            <div className="flex-1 flex justify-start items-center space-x-4">
                {worldState && (
                    <div 
                        className="relative" 
                        onMouseEnter={() => handleMouseEnter('weather')} 
                        onMouseLeave={handleMouseLeave}
                        onClick={(e) => handleTooltipClick(e, 'weather')}
                    >
                        <WeatherDisplay season={worldState.season} weather={worldState.weather} />
                        {activeTooltip === 'weather' && (
                            <div className="resource-tooltip">
                                <h4 className="font-bold capitalize text-lg">Weather</h4>
                                <p className="text-sm">Current conditions affect travel times.</p>
                                <div className="tooltip-lock-timer">
                                    {isTooltipLocked ? '🔒' : lockCountdown}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Center Section */}
            <div className="flex-none flex justify-center items-center space-x-8">
                <div
                    ref={activityTrackerRef}
                    className="activity-tracker-container"
                    onMouseLeave={handleMouseLeave}
                >
                    <div className="relative" onMouseEnter={() => handleMouseEnter('recruitment')} onClick={(e) => handleTooltipClick(e, 'recruitment')}>
                        <button className="activity-icon-image-container">
                            <img src={recruitmenticon} alt="Recruitment" className="activity-icon-image" />
                        </button>
                        {recruitmentCount > 0 && <span className="activity-badge">{recruitmentCount}</span>}
                        {activeTooltip === 'recruitment' && (
                            <RecruitmentTooltip 
                                playerCities={playerCities} 
                                onCancelTrain={onCancelTrain} 
                                isLocked={isTooltipLocked} 
                                countdown={lockCountdown} 
                            />
                        )}
                    </div>
                    <div className="relative" onMouseEnter={() => handleMouseEnter('trades')} onClick={(e) => handleTooltipClick(e, 'trades')}>
                         <button className="activity-icon-image-container">
                            <img src={tradeicon} alt="Trade" className="activity-icon-image" />
                        </button>
                        {tradeCount > 0 && <span className="activity-badge">{tradeCount}</span>}
                        {activeTooltip === 'trades' && (
                            <TradesTooltip 
                                movements={movements} 
                                combinedSlots={combinedSlots} 
                                onCancel={onCancelMovement} 
                                isLocked={isTooltipLocked} 
                                countdown={lockCountdown} 
                            />
                        )}
                    </div>
                     <div className="relative" onMouseEnter={() => handleMouseEnter('movements')} onClick={(e) => handleTooltipClick(e, 'movements')}>
                        <button onClick={(e) => { e.stopPropagation(); onOpenMovements(); }} className={`activity-icon-image-container ${isUnderAttack ? 'glowing-attack-icon' : ''}`}>
                            <img src={movementicon} alt="Movement" className="activity-icon-image" />
                        </button>
                        {movementCount > 0 && <span className="activity-badge">{movementCount}</span>}
                        {activeTooltip === 'movements' && (
                            <MovementsTooltip 
                                movements={movements} 
                                combinedSlots={combinedSlots} 
                                onCancel={onCancelMovement} 
                                isLocked={isTooltipLocked} 
                                countdown={lockCountdown} 
                            />
                        )}
                    </div>
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
                            className="font-title text-xl city-name-dropdown-btn"
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
            <div className="flex-1 flex justify-end items-center space-x-2" onMouseLeave={handleMouseLeave}>
                <div 
                    className="resource-display relative"
                    onMouseEnter={() => handleMouseEnter('wood')}
                    onClick={(e) => handleTooltipClick(e, 'wood')}
                >
                    <img src={woodImage} alt="Wood" className="w-6 h-6 mr-2"/> 
                    <span className="text-yellow-800 font-bold">{Math.floor(resources.wood)}</span>
                    {productionRates && productionRates.wood !== undefined && <span className="text-xs text-gray-500 ml-1">(+{productionRates.wood}/hr)</span>}
                    {activeTooltip === 'wood' && productionRates && getWarehouseCapacity && (
                        <ResourceTooltip
                            resource="wood"
                            production={productionRates.wood}
                            capacity={getWarehouseCapacity(gameState.buildings.warehouse.level)}
                            isLocked={isTooltipLocked}
                            countdown={lockCountdown}
                        />
                    )}
                </div>
                <div 
                    className="resource-display relative"
                    onMouseEnter={() => handleMouseEnter('stone')}
                    onClick={(e) => handleTooltipClick(e, 'stone')}
                >
                    <img src={stoneImage} alt="Stone" className="w-6 h-6 mr-2"/> 
                    <span className="text-gray-600 font-bold">{Math.floor(resources.stone)}</span>
                     {productionRates && productionRates.stone !== undefined && <span className="text-xs text-gray-500 ml-1">(+{productionRates.stone}/hr)</span>}
                     {activeTooltip === 'stone' && productionRates && getWarehouseCapacity && (
                        <ResourceTooltip
                            resource="stone"
                            production={productionRates.stone}
                            capacity={getWarehouseCapacity(gameState.buildings.warehouse.level)}
                            isLocked={isTooltipLocked}
                            countdown={lockCountdown}
                        />
                    )}
                </div>
                <div 
                    className="resource-display relative"
                    onMouseEnter={() => handleMouseEnter('silver')}
                    onClick={(e) => handleTooltipClick(e, 'silver')}
                >
                    <img src={silverImage} alt="Silver" className="w-6 h-6 mr-2"/> 
                    <span className="text-blue-800 font-bold">{Math.floor(resources.silver)}</span>
                     {productionRates && productionRates.silver !== undefined && <span className="text-xs text-gray-500 ml-1">(+{productionRates.silver}/hr)</span>}
                     {activeTooltip === 'silver' && productionRates && getWarehouseCapacity && (
                        <ResourceTooltip
                            resource="silver"
                            production={productionRates.silver}
                            capacity={getWarehouseCapacity(gameState.buildings.warehouse.level)}
                            isLocked={isTooltipLocked}
                            countdown={lockCountdown}
                        />
                    )}
                </div>
                <div className="resource-display">
                    <img src={populationImage} alt="Population" className="w-6 h-6 mr-2"/>
                    <span className="font-bold text-red-800">{Math.floor(availablePopulation)}</span>
                </div>
                <div 
                    className="resource-display relative" 
                    onMouseEnter={() => handleMouseEnter('happiness')}
                    onClick={(e) => handleTooltipClick(e, 'happiness')}
                >
                    <span className="text-xl mr-2">{happinessIcon}</span>
                    <span className="font-bold text-green-800">{happiness}%</span>
                    {activeTooltip === 'happiness' && (
                        <div className="resource-tooltip happiness-tooltip">
                            <pre>{happinessTooltip}</pre>
                            <div className="tooltip-lock-timer">
                                {isTooltipLocked ? '🔒' : lockCountdown}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TopBar;
