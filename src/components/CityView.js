// spolkip/grepoliswannabe/GrepolisWannaBe-84ea944fec8305f67d645494c64605ee04b71622/src/components/CityView.js
import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '../firebase/config';
import Modal from './shared/Modal';
import buildingConfig from '../gameData/buildings.json';
import unitConfig from '../gameData/units.json';
import SideInfoPanel from './SideInfoPanel';
import AdminCheatMenu from './city/AdminCheatMenu';
import BarracksMenu from './city/BarracksMenu';
import ShipyardMenu from './city/ShipyardMenu';
import BuildingDetailsModal from './city/BuildingDetailsModal';
import SenateView from './city/SenateView';
import TempleMenu from './city/TempleMenu';
import CaveMenu from './city/CaveMenu'; // Import CaveMenu
import Cityscape from './city/Cityscape';

// Import resource images
import woodImage from '../images/resources/wood.png';
import stoneImage from '../images/resources/stone.png';
import silverImage from '../images/resources/silver.png';

const getGameDocRef = (userId, worldId) =>
  doc(db, `users/${userId}/games`, worldId);

const CITYSCAPE_SIZE = 2000;

const CityView = ({ showMap, worldId }) => {
  const { currentUser, userProfile } = useAuth();
  const [cityGameState, setCityGameState] = useState(null);
  const [message, setMessage] = useState('');
  const [selectedBuildingId, setSelectedBuildingId] = useState(null);
  const [isSenateViewOpen, setIsSenateViewOpen] = useState(false);
  const [isBarracksMenuOpen, setIsBarracksMenuOpen] = useState(false);
  const [isShipyardMenuOpen, setIsShipyardMenuOpen] = useState(false);
  const [isTempleMenuOpen, setIsTempleMenuOpen] = useState(false);
  const [isCaveMenuOpen, setIsCaveMenuOpen] = useState(false); // New state for CaveMenu
  const [isCheatMenuOpen, setIsCheatMenuOpen] = useState(false);

  // Draggable view states
  const viewportRef = useRef(null);
  const cityContainerRef = useRef(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  
  const gameStateRef = useRef(cityGameState);
  useEffect(() => {
    gameStateRef.current = cityGameState;
  }, [cityGameState]);

  const clampPan = useCallback((newPan) => {
    if (!viewportRef.current) return { x: 0, y: 0 };
    const { clientWidth, clientHeight } = viewportRef.current;
    
    const minX = clientWidth - CITYSCAPE_SIZE;
    const minY = clientHeight - CITYSCAPE_SIZE;
    const maxX = 0;
    const maxY = 0;

    return {
        x: Math.max(minX, Math.min(maxX, newPan.x)),
        y: Math.max(minY, Math.min(maxY, newPan.y)),
    };
  }, []);

  useLayoutEffect(() => {
    if (!viewportRef.current) return;
    const { clientWidth, clientHeight } = viewportRef.current;
    const initialPan = {
      x: (clientWidth - CITYSCAPE_SIZE) / 2,
      y: (clientHeight - CITYSCAPE_SIZE) / 2,
    };
    setPan(clampPan(initialPan));
  }, [clampPan]);

  useEffect(() => {
    const handleResize = () => {
        setPan(prevPan => clampPan(prevPan));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [clampPan]);

  const getProductionRates = useCallback((buildings) => {
    if (!buildings) return { wood: 0, stone: 0, silver: 0 };
    return {
      wood: Math.floor(
        30 * Math.pow(1.2, (buildings.timber_camp?.level || 1) - 1)
      ),
      stone: Math.floor(
        30 * Math.pow(1.2, (buildings.quarry?.level || 1) - 1)
      ),
      silver: Math.floor(
        15 * Math.pow(1.15, (buildings.silver_mine?.level || 1) - 1)
      ),
    };
  }, []);

  const getWarehouseCapacity = useCallback((level) => {
    if (!level) return 0;
    return Math.floor(1000 * Math.pow(1.5, level - 1));
  }, []);

  const getFarmCapacity = useCallback((level) => {
    if (!level) return 0;
    return Math.floor(100 * Math.pow(1.3, level - 1));
  }, []);

  const getUpgradeCost = useCallback((buildingId, level) => {
    const building = buildingConfig[buildingId];
    if (!building || level < 1)
      return { wood: 0, stone: 0, silver: 0, population: 0 };

    const cost = building.baseCost;
    let populationCost = Math.floor(cost.population * Math.pow(1.1, level - 1));
    const initialBuildings = ['senate', 'farm', 'warehouse', 'timber_camp', 'quarry', 'silver_mine', 'cave']; // Added cave here
    if (level === 1 && initialBuildings.includes(buildingId)) {
      populationCost = 0;
    }

    return {
      wood: Math.floor(cost.wood * Math.pow(1.6, level - 1)),
      stone: Math.floor(cost.stone * Math.pow(1.6, level - 1)),
      silver: Math.floor(cost.silver * Math.pow(1.8, level - 1)),
      population: populationCost,
    };
  }, []);

  const calculateUsedPopulation = useCallback((buildings, units) => {
    let used = 0;
    if (buildings) {
      for (const buildingId in buildings) {
        const buildingData = buildings[buildingId];
        // Ensure initial buildings don't consume population at level 1
        const startLevel = ['senate', 'farm', 'warehouse', 'timber_camp', 'quarry', 'silver_mine', 'cave'].includes(buildingId) ? 1 : 0;
        for (let i = startLevel; i <= buildingData.level; i++) {
          if (i > 0) {
            used += getUpgradeCost(buildingId, i).population;
          }
        }
      }
    }
    if (units) {
      for (const unitId in units) {
        used += (unitConfig[unitId]?.cost.population || 0) * units[unitId];
      }
    }
    return used;
  }, [getUpgradeCost]);

  const saveGameState = useCallback(async (stateToSave) => {
    if (!currentUser || !worldId || !stateToSave) return;
    try {
      const gameDocRef = getGameDocRef(currentUser.uid, worldId);
      await setDoc(gameDocRef, { ...stateToSave, lastUpdated: Date.now() }, { merge: true });
    } catch (error) {
      console.error('Failed to save game state:', error);
      setMessage('Error saving your progress.');
    }
  }, [currentUser, worldId]);

  useEffect(() => {
    if (!currentUser || !worldId) return;
    const gameDocRef = getGameDocRef(currentUser.uid, worldId);
    const unsubscribe = onSnapshot(gameDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        // Initialize units and cave if they don't exist
        if (!data.units) data.units = {};
        if (!data.worship) data.worship = {};
        if (!data.cave) data.cave = { silver: 0 }; 
        // Ensure cave building exists and has a level for new cities
        // This handles cases where cities were created before the fix in CityFounding.js
        if (!data.buildings.cave) {
            data.buildings.cave = { level: 1 };
        }

        const now = Date.now();
        const lastResourceUpdate = data.lastUpdated || now;
        const resourceElapsedSeconds = (now - lastResourceUpdate) / 1000;
        const lastFavorUpdate = data.worship.lastFavorUpdate || data.lastUpdated || now;
        const favorElapsedSeconds = (now - lastFavorUpdate) / 1000;

        if (resourceElapsedSeconds > 1) {
          const productionRates = getProductionRates(data.buildings);
          const capacity = getWarehouseCapacity(data.buildings?.warehouse?.level);
          data.resources.wood = Math.min(capacity, data.resources.wood + (productionRates.wood / 3600) * resourceElapsedSeconds);
          data.resources.stone = Math.min(capacity, data.resources.stone + (productionRates.stone / 3600) * resourceElapsedSeconds);
          data.resources.silver = Math.min(capacity, data.resources.silver + (productionRates.silver / 3600) * resourceElapsedSeconds);
        }

        const templeLevel = data.buildings.temple?.level || 0;
        if (data.god && templeLevel > 0 && favorElapsedSeconds > 1) {
          const favorProductionRate = templeLevel;
          const favorProduced = (favorProductionRate / 3600) * favorElapsedSeconds;
          const maxFavor = templeLevel > 0 ? 100 + (templeLevel * 20) : 0;
          data.worship[data.god] = Math.min(maxFavor, (data.worship[data.god] || 0) + favorProduced);
        }
        data.worship.lastFavorUpdate = now;
        setCityGameState(data);
      }
    });
    return () => unsubscribe();
  }, [currentUser, worldId, getProductionRates, getWarehouseCapacity]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCityGameState((prevState) => {
        if (!prevState) return null;
        const newState = JSON.parse(JSON.stringify(prevState));
        const productionRates = getProductionRates(newState.buildings);
        const capacity = getWarehouseCapacity(newState.buildings?.warehouse?.level);
        const perSecondProd = {
          wood: productionRates.wood / 3600,
          stone: productionRates.stone / 3600,
          silver: productionRates.silver / 3600,
        };
        newState.resources.wood = Math.min(capacity, newState.resources.wood + perSecondProd.wood);
        newState.resources.stone = Math.min(capacity, newState.resources.stone + perSecondProd.stone);
        newState.resources.silver = Math.min(capacity, newState.resources.silver + perSecondProd.silver);
        const templeLevel = newState.buildings.temple?.level || 0;
        if (newState.god && templeLevel > 0) {
            if(!newState.worship) {
                newState.worship = {};
            }
          const favorPerSecond = templeLevel / 3600;
          const maxFavor = templeLevel > 0 ? 100 + (templeLevel * 20) : 0;
          newState.worship[newState.god] = Math.min(maxFavor, (newState.worship[newState.god] || 0) + favorPerSecond);
        }
        return newState;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [getProductionRates, getWarehouseCapacity]);

  useEffect(() => {
    const saveInterval = setInterval(() => {
      if (gameStateRef.current) saveGameState(gameStateRef.current);
    }, 60000);
    return () => clearInterval(saveInterval);
  }, [saveGameState]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (gameStateRef.current) saveGameState(gameStateRef.current); // Corrected: Use gameStateRef.current
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveGameState]);

  const handleUpgrade = async (buildingId) => {
    if (!cityGameState || !worldId) return;
    const building = cityGameState.buildings[buildingId] || { level: 0 };
    const nextLevel = building.level + 1;
    const cost = getUpgradeCost(buildingId, nextLevel);
    const currentUsedPopulation = calculateUsedPopulation(cityGameState.buildings, cityGameState.units);
    const maxPopulation = getFarmCapacity(cityGameState.buildings.farm.level);
    const newTotalPopulation = currentUsedPopulation + cost.population;

    if (
      cityGameState.resources.wood >= cost.wood &&
      cityGameState.resources.stone >= cost.stone &&
      cityGameState.resources.silver >= cost.silver &&
      newTotalPopulation <= maxPopulation
    ) {
      const newGameState = { ...cityGameState };
      newGameState.resources.wood -= cost.wood;
      newGameState.resources.stone -= cost.stone;
      newGameState.resources.silver -= cost.silver;
      newGameState.buildings[buildingId].level = nextLevel;
      await saveGameState(newGameState);
      setCityGameState(newGameState);
      setMessage(`${buildingConfig[buildingId].name} ${building.level === 0 ? 'built' : 'upgraded'} to Level ${nextLevel}!`);
    } else {
      setMessage(newTotalPopulation > maxPopulation ? 'Not enough population capacity!' : 'Not enough resources to upgrade!');
    }
  };

  const handleTrainTroops = async (unitId, amount) => {
    if (!cityGameState || !worldId || amount <= 0) return;
    const unit = unitConfig[unitId];
    const totalCost = {
      wood: unit.cost.wood * amount,
      stone: unit.cost.stone * amount,
      silver: unit.cost.silver * amount,
      population: unit.cost.population * amount,
    };
    const currentUsedPopulation = calculateUsedPopulation(cityGameState.buildings, cityGameState.units);
    const maxPopulation = getFarmCapacity(cityGameState.buildings.farm.level);
    const availablePopulation = maxPopulation - currentUsedPopulation;

    if (unit.type === 'naval' && (!cityGameState.buildings.shipyard || cityGameState.buildings.shipyard.level === 0)) {
      setMessage("Naval units can only be built in the Shipyard.");
      return;
    }
    if (unit.type === 'land' && (!cityGameState.buildings.barracks || cityGameState.buildings.barracks.level === 0)) {
      setMessage("Land units can only be trained in the Barracks.");
      return;
    }

    if (
      cityGameState.resources.wood >= totalCost.wood &&
      cityGameState.resources.stone >= totalCost.stone &&
      cityGameState.resources.silver >= totalCost.silver &&
      availablePopulation >= totalCost.population
    ) {
      const newGameState = { ...cityGameState };
      newGameState.resources.wood -= totalCost.wood;
      newGameState.resources.stone -= totalCost.stone;
      newGameState.resources.silver -= totalCost.silver;
      if (!newGameState.units) newGameState.units = {};
      newGameState.units[unitId] = (newGameState.units[unitId] || 0) + amount;
      await saveGameState(newGameState);
      setCityGameState(newGameState);
      setMessage(`Trained ${amount} ${unit.name}(s)!`);
    } else {
      setMessage(availablePopulation < totalCost.population ? 'Not enough available population!' : 'Not enough resources to train troops!');
    }
  };

  const handleCheat = async (amounts, troop, warehouseLevels) => {
    if (!cityGameState || !userProfile?.is_admin) return;
    const newGameState = { ...cityGameState };
    newGameState.resources.wood += amounts.wood;
    newGameState.resources.stone += amounts.stone;
    newGameState.resources.silver += amounts.silver;
    if (amounts.population > 0) {
      const farmLevel = newGameState.buildings.farm.level;
      newGameState.buildings.farm.level = farmLevel + amounts.population;
    }
    if (troop.amount > 0) {
        newGameState.units[troop.unit] = (newGameState.units[troop.unit] || 0) + troop.amount;
    }
    if (warehouseLevels > 0) {
        newGameState.buildings.warehouse.level += warehouseLevels;
    }
    await saveGameState(newGameState);
    setMessage("Admin cheat applied!");
  };

  const handleWorshipGod = async (godName) => {
    if (!cityGameState || !worldId || !godName) return;
    const newWorshipData = { ...(cityGameState.worship || {}) };
    if (newWorshipData[godName] === undefined) {
      newWorshipData[godName] = 0;
    }
    newWorshipData.lastFavorUpdate = Date.now();

    const newGameState = { ...cityGameState, god: godName, worship: newWorshipData };
    await saveGameState(newGameState);
    setCityGameState(newGameState);
    setMessage(`You are now worshipping ${godName}.`);
    setIsTempleMenuOpen(false);
  };

  const handlePlotClick = (buildingId) => {
    console.log("handlePlotClick triggered for building:", buildingId); // Debugging
    const buildingData = cityGameState.buildings[buildingId];
    // If building doesn't exist or its level is 0, default to opening SenateView
    if (!buildingData || buildingData.level === 0) {
      setIsSenateViewOpen(true);
      console.log("Opening SenateView because building is not built or level 0."); // Debugging
      return;
    }
    switch (buildingId) {
      case 'senate': setIsSenateViewOpen(true); break;
      case 'barracks': setIsBarracksMenuOpen(true); break;
      case 'shipyard': setIsShipyardMenuOpen(true); break;
      case 'temple': setIsTempleMenuOpen(true); break;
      case 'cave':
        console.log("Attempting to open CaveMenu."); // Debugging
        setIsCaveMenuOpen(true);
        break; // Open CaveMenu
      default: setSelectedBuildingId(buildingId); break;
    }
  };

  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    setStartPos({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    setIsPanning(true);
  }, [pan]);

  useEffect(() => {
    const handleMouseMove = (e) => {
        if (!isPanning) return;
        const newPan = { x: e.clientX - startPos.x, y: e.clientY - startPos.y };
        setPan(clampPan(newPan));
    };
    const handleMouseUp = () => setIsPanning(false);

    if (isPanning) {
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isPanning, startPos, clampPan]);

  useEffect(() => {
    const container = cityContainerRef.current;
    if (container) {
      container.style.transform = `translate(${pan.x}px, ${pan.y}px)`;
    }
  }, [pan]);

  if (!cityGameState) {
    return <div className="text-white text-center p-10">Loading City...</div>;
  }
  
  const productionRates = getProductionRates(cityGameState.buildings);
  const maxPopulation = getFarmCapacity(cityGameState.buildings?.farm?.level);
  const usedPopulation = calculateUsedPopulation(cityGameState.buildings, cityGameState.units);
  const availablePopulation = maxPopulation - usedPopulation;

  return (
    <div className="w-full h-screen flex flex-col bg-gray-900">
      <Modal message={message} onClose={() => setMessage('')} />
      <header className="flex-shrink-0 flex flex-col sm:flex-row justify-between items-center p-4 bg-gray-800 shadow-lg border-b border-gray-700 z-10">
        <div>
          <h1 className="font-title text-3xl text-gray-300">{cityGameState.cityName}</h1>
          {cityGameState.god && <p className="text-lg text-yellow-400 font-semibold">Worshipping: {cityGameState.god}</p>}
          <p className="text-sm text-blue-300">{`${cityGameState.playerInfo.nation} (${cityGameState.playerInfo.religion})`}</p>
          <button onClick={showMap} className="text-sm text-blue-400 hover:text-blue-300 mt-1">← Return to Map</button>
        </div>
        <div className="text-center sm:text-right mt-2 sm:mt-0">
          <p className="text-xs text-gray-400">Player: <span className="font-mono">{userProfile?.username || currentUser?.email}</span></p>
          <div className="flex items-center justify-end space-x-4">
            {userProfile?.is_admin && (
              <button onClick={() => setIsCheatMenuOpen(true)} className="text-sm text-yellow-400 hover:text-yellow-300 mt-1">Admin Cheats</button>
            )}
            <button onClick={() => signOut(auth)} className="text-sm text-red-400 hover:text-red-300 mt-1">Logout</button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 p-4 flex-shrink-0 z-10">
        <div className="bg-gray-800 p-3 rounded-lg flex items-center border border-gray-700">
          <img src={woodImage} alt="Wood" className="resource-icon rounded"/>
          <div><span className="font-bold text-lg text-yellow-300">{Math.floor(cityGameState.resources.wood).toLocaleString()}</span><span className="text-xs text-gray-400"> (+{productionRates.wood}/hr)</span></div>
        </div>
        <div className="bg-gray-800 p-3 rounded-lg flex items-center border border-gray-700">
          <img src={stoneImage} alt="Stone" className="resource-icon rounded"/>
          <div><span className="font-bold text-lg text-gray-300">{Math.floor(cityGameState.resources.stone).toLocaleString()}</span><span className="text-xs text-gray-400"> (+{productionRates.stone}/hr)</span></div>
        </div>
        <div className="bg-gray-800 p-3 rounded-lg flex items-center border border-gray-700">
          <img src={silverImage} alt="Silver" className="resource-icon rounded"/>
          <div><span className="font-bold text-lg text-blue-300">{Math.floor(cityGameState.resources.silver).toLocaleString()}</span><span className="text-xs text-gray-400"> (+{productionRates.silver}/hr)</span></div>
        </div>
        <div className="bg-gray-800 p-3 rounded-lg flex items-center border border-gray-700">
          <img src="https://placehold.co/48x48/DC143C/FFFFFF?text=P" alt="Population" className="resource-icon rounded"/>
          <div><span className="font-bold text-lg text-red-400">{availablePopulation.toLocaleString()}</span><span className="text-xs text-gray-400"> Available Pop.</span></div>
        </div>
      </div>

      <main className="flex-grow w-full h-full relative overflow-hidden cursor-grab" ref={viewportRef} onMouseDown={handleMouseDown}>
        <div ref={cityContainerRef} style={{ transformOrigin: '0 0' }}>
          <Cityscape buildings={cityGameState.buildings} onBuildingClick={handlePlotClick} />
        </div>
      </main>

      <SideInfoPanel gameState={cityGameState} className="absolute top-1/2 right-4 transform -translate-y-1/2 z-20" />

      {selectedBuildingId && (
        <BuildingDetailsModal
          buildingId={selectedBuildingId}
          buildingData={cityGameState.buildings[selectedBuildingId]}
          onClose={() => setSelectedBuildingId(null)}
          getProductionRates={getProductionRates}
          getWarehouseCapacity={getWarehouseCapacity}
          getFarmCapacity={getFarmCapacity}
          onOpenBarracks={() => { setSelectedBuildingId(null); setIsBarracksMenuOpen(true); }}
          onOpenShipyard={() => { setSelectedBuildingId(null); setIsShipyardMenuOpen(true); }}
        />
      )}
      {isSenateViewOpen && (
        <SenateView
          buildings={cityGameState.buildings}
          resources={cityGameState.resources}
          onUpgrade={handleUpgrade}
          getUpgradeCost={getUpgradeCost}
          onClose={() => setIsSenateViewOpen(false)}
          usedPopulation={usedPopulation}
          maxPopulation={maxPopulation}
        />
      )}
      {isBarracksMenuOpen && (
        <BarracksMenu
          resources={cityGameState.resources}
          availablePopulation={availablePopulation}
          onTrain={handleTrainTroops}
          onClose={() => setIsBarracksMenuOpen(false)}
          buildings={cityGameState.buildings}
        />
      )}
      {isShipyardMenuOpen && (
        <ShipyardMenu
          resources={cityGameState.resources}
          availablePopulation={availablePopulation}
          onTrain={handleTrainTroops}
          onClose={() => setIsShipyardMenuOpen(false)}
          buildings={cityGameState.buildings}
        />
      )}
      {isTempleMenuOpen && (
        <TempleMenu
          city={cityGameState}
          onWorship={(godName) => handleWorshipGod(godName)}
          onClose={() => setIsTempleMenuOpen(false)}
          favorData={cityGameState.worship || {}}
        />
      )}
      {isCaveMenuOpen && ( // Render CaveMenu when isCaveMenuOpen is true
        <CaveMenu
          cityGameState={cityGameState}
          onClose={() => setIsCaveMenuOpen(false)}
          saveGameState={saveGameState} // Pass saveGameState for updates
          currentUser={currentUser}
          worldId={worldId}
        />
      )}
      {isCheatMenuOpen && userProfile?.is_admin && (
        <AdminCheatMenu
          onCheat={handleCheat}
          onClose={() => setIsCheatMenuOpen(false)}
        />
      )}
    </div>
  );
};

export default CityView;