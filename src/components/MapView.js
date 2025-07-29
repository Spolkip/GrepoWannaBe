import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { signOut } from "firebase/auth";
import { auth, db } from '../firebase/config';
import { collection, query, where, getDocs, writeBatch, doc, serverTimestamp, onSnapshot, updateDoc, getDoc } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';

// UI Components
import Modal from './shared/Modal';
import ReportsView from './ReportsView';
import SideInfoPanel from './SideInfoPanel';
import MovementModal from './map/MovementModal';
import MovementsPanel from './map/MovementsPanel';
import OtherCityModal from './map/OtherCityModal';
import FarmingVillageModal from './map/FarmingVillageModal';
import SidebarNav from './map/SidebarNav';
import TopBar from './map/TopBar';
import { WaterTile, LandTile, CitySlotTile, FarmingVillageTile } from './map/Tiles';
import MovementIndicator from './map/MovementIndicator';

// Utilities & Config
import { calculateDistance, calculateTravelTime } from '../utils/travel';
import unitConfig from '../gameData/units.json';
import buildingConfig from '../gameData/buildings.json';

// Constants
const TILE_SIZE = 32;
const OVERSCROLL_AMOUNT = 100;
const CHUNK_SIZE = 50;

const MapView = ({ showCity, onBackToWorlds }) => {
    const { currentUser, userProfile } = useAuth();
    const { worldState, gameState, worldId, playerCity, setGameState } = useGame();

    const [message, setMessage] = useState('');
    const [selectedCity, setSelectedCity] = useState(null);
    const [selectedVillage, setSelectedVillage] = useState(null);
    const [travelTimeInfo, setTravelTimeInfo] = useState(null);
    const [actionDetails, setActionDetails] = useState(null);
    const [isMovementsPanelOpen, setIsMovementsPanelOpen] = useState(false);
    const [isReportsPanelOpen, setIsReportsPanelOpen] = useState(false);
    const [movements, setMovements] = useState([]);
    const [cachedCitySlots, setCachedCitySlots] = useState({});
    const [visibleSlots, setVisibleSlots] = useState({});
    const [villages, setVillages] = useState({});
    const [isPlacingDummyCity, setIsPlacingDummyCity] = useState(false);

    const viewportRef = useRef(null);
    const mapContainerRef = useRef(null);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(0.5);
    const [minZoom, setMinZoom] = useState(0.5);
    const [isPanning, setIsPanning] = useState(false);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });
    const [borderOpacity, setBorderOpacity] = useState({ top: 0, bottom: 0, left: 0, right: 0 });
    const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });

    const invalidateChunkCache = useCallback((x, y) => {
        const chunkX = Math.floor(x / CHUNK_SIZE);
        const chunkY = Math.floor(y / CHUNK_SIZE);
        const chunkKey = `${chunkX},${chunkY}`;
        setCachedCitySlots(prevCache => {
            const newCache = { ...prevCache };
            delete newCache[chunkKey];
            return newCache;
        });
    }, []);

    useEffect(() => {
        if (!worldId || !currentUser) return;
        const movementsRef = collection(db, 'worlds', worldId, 'movements');
        const q = query(movementsRef, where('involvedParties', 'array-contains', currentUser.uid));
        const unsubscribeMovements = onSnapshot(q, (snapshot) => {
            const allMovements = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setMovements(allMovements.sort((a, b) => a.arrivalTime.toMillis() - b.arrivalTime.toMillis()));
        });

        const villagesColRef = collection(db, 'worlds', worldId, 'villages');
        const unsubscribeVillages = onSnapshot(villagesColRef, (snapshot) => {
            const villagesData = {};
            snapshot.docs.forEach(doc => {
                villagesData[doc.id] = { id: doc.id, ...doc.data() };
            });
            setVillages(villagesData);
        });

        return () => {
            unsubscribeMovements();
            unsubscribeVillages();
        };
    }, [worldId, currentUser]);

    // Effect to process completed movements
    useEffect(() => {
        const processCompletedMovements = async () => {
            if (!movements.length || !worldId || !currentUser || !db) return;

            const now = new Date();
            const completedMovements = movements.filter(m => m.arrivalTime && m.arrivalTime.toDate() <= now);

            if (completedMovements.length === 0) return;

            const batch = writeBatch(db);

            for (const movement of completedMovements) {
                try {
                    if (movement.type === 'scout') {
                        const targetGameDocRef = doc(db, 'users', movement.targetOwnerId, 'games', worldId);
                        const targetGameSnap = await getDoc(targetGameDocRef);

                        let reportContent = {};

                        if (targetGameSnap.exists()) {
                            const targetGameState = targetGameSnap.data();
                            const silverSent = movement.resources?.silver || 0;
                            const espionagePower = silverSent / 100; // 100 silver for full report

                            reportContent = {
                                scoutSucceeded: true,
                                message: 'Scouting successful!',
                                targetCityName: targetGameState.cityName || 'Unnamed City',
                                targetOwner: movement.ownerUsername || 'Unknown',
                                resources: espionagePower >= 0.25 ? targetGameState.resources : { note: 'More silver required to see resources.' },
                                units: espionagePower >= 0.5 ? targetGameState.units : { note: 'More silver required to see units.' },
                                buildings: espionagePower >= 1 ? targetGameState.buildings : { note: 'More silver required to see building levels.' },
                            };
                        } else {
                            reportContent = {
                                scoutSucceeded: false,
                                message: 'Could not retrieve information about the target city.',
                                targetCityName: movement.targetCityName || 'Unknown City',
                                targetOwner: movement.ownerUsername || 'Unknown',
                            };
                        }

                        const reportRef = doc(collection(db, 'users', currentUser.uid, 'reports'));
                        batch.set(reportRef, {
                            type: 'scout',
                            title: `Scout Report for ${reportContent.targetCityName}`,
                            originCityId: movement.originCityId,
                            targetCityId: movement.targetCityId,
                            read: false,
                            timestamp: serverTimestamp(),
                            ...reportContent
                        });
                    } else if (movement.type === 'reinforce') { // Added reinforcement logic
                        const targetCityRef = doc(db, 'users', movement.targetOwnerId, 'games', worldId);
                        const targetCitySnap = await getDoc(targetCityRef);

                        if (targetCitySnap.exists()) {
                            const targetCityData = targetCitySnap.data();
                            const updatedUnits = { ...targetCityData.units };

                            for (const unitId in movement.units) {
                                updatedUnits[unitId] = (updatedUnits[unitId] || 0) + movement.units[unitId];
                            }
                            batch.update(targetCityRef, { units: updatedUnits });

                            const reportRef = doc(collection(db, 'users', currentUser.uid, 'reports'));
                            batch.set(reportRef, {
                                type: 'reinforce',
                                title: `Reinforcement arrived at ${movement.targetCityName}`,
                                originCityId: movement.originCityId,
                                targetCityId: movement.targetCityId,
                                units: movement.units,
                                read: false,
                                timestamp: serverTimestamp(),
                                message: `Your reinforcements have arrived at ${movement.targetCityName}.`
                            });
                        } else {
                            console.warn(`Target city for reinforcement not found: ${movement.targetCityId}`);
                            const reportRef = doc(collection(db, 'users', currentUser.uid, 'reports'));
                            batch.set(reportRef, {
                                type: 'reinforce',
                                title: `Reinforcement failed for ${movement.targetCityName}`,
                                originCityId: movement.originCityId,
                                targetCityId: movement.targetCityId,
                                units: movement.units,
                                read: false,
                                timestamp: serverTimestamp(),
                                message: `Your reinforcements could not reach ${movement.targetCityName} as the city was not found.`
                            });
                        }
                    }
                    
                    const movementRef = doc(db, 'worlds', worldId, 'movements', movement.id);
                    batch.delete(movementRef);

                } catch (error) {
                    console.error('Error processing movement:', movement.id, error);
                }
            }

            try {
                await batch.commit();
                if (completedMovements.length > 0) {
                    setMessage(`${completedMovements.length} movement(s) have completed.`);
                }
            } catch (error) {
                console.error('Error committing movement processing batch:', error);
            }
        };

        const intervalId = setInterval(processCompletedMovements, 5000); 
        return () => clearInterval(intervalId);

    }, [movements, worldId, currentUser, setGameState, setMessage]);

    useEffect(() => {
        const fetchVisibleSlots = async () => {
            if (!worldState || !viewportRef.current || zoom <= 0 || !worldId) return;

            const scaledTileSize = TILE_SIZE * zoom;
            const viewStartCol = Math.floor(-pan.x / scaledTileSize);
            const viewEndCol = Math.ceil((-pan.x + viewportSize.width) / scaledTileSize);
            const viewStartRow = Math.floor(-pan.y / scaledTileSize);
            const viewEndRow = Math.ceil((-pan.y + viewportSize.height) / scaledTileSize);

            const newVisible = {};
            const chunksToFetch = new Set();
            let needsFetch = false;

            for (let y = viewStartRow; y <= viewEndRow; y++) {
                for (let x = viewStartCol; x <= viewEndCol; x++) {
                    const chunkKey = `${Math.floor(x / CHUNK_SIZE)},${Math.floor(y / CHUNK_SIZE)}`;
                    if (!cachedCitySlots[chunkKey]) {
                        needsFetch = true;
                        chunksToFetch.add(chunkKey);
                    } else {
                        Object.values(cachedCitySlots[chunkKey]).forEach(slot => {
                            if (slot.x >= viewStartCol && slot.x <= viewEndCol && slot.y >= viewStartRow && slot.y <= viewEndRow) {
                                newVisible[slot.id] = slot;
                            }
                        });
                    }
                }
            }

            if (needsFetch) {
                const newCache = { ...cachedCitySlots };
                await Promise.all(Array.from(chunksToFetch).map(async (key) => {
                    const [chunkX, chunkY] = key.split(',').map(Number);
                    const q = query(
                        collection(db, 'worlds', worldId, 'citySlots'),
                        where('x', '>=', chunkX * CHUNK_SIZE), where('x', '<', (chunkX + 1) * CHUNK_SIZE),
                        where('y', '>=', chunkY * CHUNK_SIZE), where('y', '<', (chunkY + 1) * CHUNK_SIZE)
                    );
                    try {
                        const snapshot = await getDocs(q);
                        const chunkData = {};
                        snapshot.forEach(doc => {
                            chunkData[doc.id] = { id: doc.id, ...doc.data() };
                            if (doc.data().x >= viewStartCol && doc.data().x <= viewEndCol && doc.data().y >= viewStartRow && doc.data().y <= viewEndRow) {
                                newVisible[doc.id] = { id: doc.id, ...doc.data() };
                            }
                        });
                        newCache[key] = chunkData;
                    } catch (error) {
                           console.error(`Error fetching city slots for chunk ${key}:`, error);
                           setMessage("Could not load city data. Check console for index link.");
                    }
                }));
                setCachedCitySlots(newCache);
            }
            setVisibleSlots(newVisible);
        };
        const timer = setTimeout(fetchVisibleSlots, 200);
        return () => clearTimeout(timer);
    }, [pan, zoom, viewportSize.width, viewportSize.height, worldState, worldId, cachedCitySlots]);

    const combinedSlots = useMemo(() => {
        const slots = { ...visibleSlots };
        if (playerCity) {
            slots[playerCity.id] = playerCity;
        }
        return slots;
    }, [visibleSlots, playerCity]);

    const mapGrid = useMemo(() => {
        if (!worldState?.islands) return null;
        const grid = Array(worldState.height).fill(null).map(() => Array(worldState.width).fill({ type: 'water' }));

        worldState.islands.forEach(island => {
            const centerX = Math.round(island.x);
            const centerY = Math.round(island.y);
            for (let i = -Math.floor(island.radius); i <= Math.ceil(island.radius); i++) {
                for (let j = -Math.floor(island.radius); j <= Math.ceil(island.radius); j++) {
                    if (i * i + j * j <= island.radius * island.radius) {
                        const x = centerX + j;
                        const y = centerY + i;
                        if (y >= 0 && y < worldState.height && x >= 0 && x < worldState.width) {
                            grid[y][x] = { type: 'land' };
                        }
                    }
                }
            }
        });
        
        Object.values(combinedSlots).forEach(slot => {
            if (slot.x !== undefined && slot.y !== undefined) {
                const x = Math.round(slot.x);
                const y = Math.round(slot.y);
                if (grid[y]?.[x]) {
                    grid[y][x] = { type: 'city_slot', data: slot };
                }
            }
        });

        Object.values(villages).forEach(village => {
            const x = Math.round(village.x);
            const y = Math.round(village.y);
            if (grid[y]?.[x]?.type === 'land') {
                grid[y][x] = { type: 'village', data: village };
            }
        });

        return grid;
    }, [worldState, combinedSlots, villages]);

    const clampPan = useCallback((newPan, currentZoom) => {
        if (!viewportRef.current || !worldState?.islands) return newPan;
        const mapWidth = worldState.width * TILE_SIZE;
        const mapHeight = worldState.height * TILE_SIZE;
        const { clientWidth: viewportWidth, clientHeight: viewportHeight } = viewportRef.current;
        const minX = viewportWidth - mapWidth * currentZoom;
        const minY = viewportHeight - mapHeight * currentZoom;
        
        setBorderOpacity({
            left: Math.max(0, Math.min(1, newPan.x / OVERSCROLL_AMOUNT)),
            right: Math.max(0, Math.min(1, (minX - newPan.x) / OVERSCROLL_AMOUNT)),
            top: Math.max(0, Math.min(1, newPan.y / OVERSCROLL_AMOUNT)),
            bottom: Math.max(0, Math.min(1, (minY - newPan.y) / OVERSCROLL_AMOUNT)),
        });

        return {
            x: Math.min(OVERSCROLL_AMOUNT, Math.max(minX - OVERSCROLL_AMOUNT, newPan.x)),
            y: Math.min(OVERSCROLL_AMOUNT, Math.max(minY - OVERSCROLL_AMOUNT, newPan.y)),
        };
    }, [worldState]);

    const goToCoordinates = useCallback((x, y) => {
        if (!viewportRef.current) return;
        const { clientWidth: viewportWidth, clientHeight: viewportHeight } = viewportRef.current;
        const targetX = -x * TILE_SIZE * zoom + (viewportWidth / 2) - (TILE_SIZE * zoom / 2);
        const targetY = -y * TILE_SIZE * zoom + (viewportHeight / 2) - (TILE_SIZE * zoom / 2);
        const newPan = clampPan({ x: targetX, y: targetY }, zoom);
        setPan(newPan);
    }, [zoom, clampPan]);

    const centerOnCity = useCallback(() => {
        if (playerCity) {
            goToCoordinates(playerCity.x, playerCity.y);
        }
    }, [playerCity, goToCoordinates]);

    useEffect(() => {
        const viewport = viewportRef.current;
        if (!viewport || !worldState?.islands) return;
        const handleResize = () => {
            setViewportSize({ width: viewport.clientWidth, height: viewport.clientHeight });
            const newMinZoom = Math.max(
                viewport.clientWidth / (worldState.width * TILE_SIZE),
                viewport.clientHeight / (worldState.height * TILE_SIZE),
                0.3
            );
            setMinZoom(newMinZoom);
            setZoom(prevZoom => Math.max(newMinZoom, prevZoom));
        };
        handleResize();
        centerOnCity();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [worldState, centerOnCity]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                centerOnCity();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [centerOnCity]);

    useEffect(() => {
        const container = mapContainerRef.current;
        if (container) {
            container.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;
        }
    }, [pan, zoom]);
    
    const handleWheel = useCallback((e) => {
        if (!viewportRef.current) return;
        e.preventDefault();
        const scaleAmount = -e.deltaY * 0.002;
        const newZoom = Math.max(minZoom, Math.min(3, zoom + scaleAmount));
        const rect = viewportRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const pointX = (mouseX - pan.x) / zoom;
        const pointY = (mouseY - pan.y) / zoom;
        const newPan = clampPan({ x: mouseX - pointX * newZoom, y: mouseY - pointY * newZoom }, newZoom);
        setZoom(newZoom);
        setPan(newPan);
    }, [zoom, pan, clampPan, minZoom]);

    useEffect(() => {
        const viewport = viewportRef.current;
        if (viewport) {
            viewport.addEventListener('wheel', handleWheel, { passive: false });
        }
        return () => {
            if (viewport) {
                viewport.removeEventListener('wheel', handleWheel);
            }
        };
    }, [handleWheel]);

    const handleMouseDown = useCallback((e) => {
        if (e.button !== 0) return;
        setStartPos({ x: e.clientX - pan.x, y: e.clientY - pan.y });
        setIsPanning(true);
    }, [pan]);

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isPanning) return;
            const newPan = clampPan({ x: e.clientX - startPos.x, y: e.clientY - startPos.y }, zoom);
            setPan(newPan);
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
    }, [isPanning, startPos, zoom, clampPan]);

    const onCitySlotClick = (e, slotData) => {
        setSelectedVillage(null);
        if (isPlacingDummyCity && !slotData.ownerId) {
            handleCreateDummyCity(slotData.id, slotData);
            return;
        }

        if (slotData.ownerId === currentUser.uid) {
            showCity();
        } else if (slotData.ownerId) {
            if (playerCity) {
                const distance = calculateDistance(playerCity, slotData);
                setTravelTimeInfo({ distance });
            }
            setSelectedCity(slotData);
        } else {
            setMessage('This plot is empty. Future updates will allow colonization!');
        }
    };

    // Helper function to generate troops for a farming village based on its level
    const getVillageTroopsOrDefault = useCallback((villageData) => {
        if (villageData.troops && Object.keys(villageData.troops).length > 0) {
            return villageData.troops;
        }

        const level = villageData.level || 1; // Default to level 1 if not specified
        let troops = {};
        switch (level) {
            case 1:
                troops = { swordsman: 15, archer: 10 };
                break;
            case 2:
                troops = { swordsman: 25, archer: 15, slinger: 5 };
                break;
            case 3:
                troops = { swordsman: 40, archer: 25, slinger: 10, hoplite: 5 };
                break;
            case 4:
                troops = { swordsman: 60, archer: 40, slinger: 15, hoplite: 10, cavalry: 5 };
                break;
            case 5:
                troops = { swordsman: 80, archer: 50, slinger: 20, hoplite: 15, cavalry: 10 };
                break;
            default:
                troops = { swordsman: 10, archer: 5 }; // Default for levels outside 1-5
                break;
        }
        return troops;
    }, []);
    
    const onVillageClick = (e, villageData) => {
        setSelectedCity(null);
        if (villageData.ownerId === currentUser.uid) {
            setSelectedVillage(villageData);
        } else {
            const distance = playerCity ? calculateDistance(playerCity, villageData) : Infinity;
            setTravelTimeInfo({ distance });
            const targetData = {
                id: villageData.id,
                name: villageData.name,
                cityName: villageData.name,
                ownerId: villageData.ownerId,
                ownerUsername: villageData.ownerUsername || 'Neutral',
                x: villageData.x,
                y: villageData.y,
                islandId: villageData.islandId,
                isVillageTarget: true,
                troops: getVillageTroopsOrDefault(villageData), // Use the helper function
                level: villageData.level || 1 // Ensure level is passed
            };
            setSelectedCity(targetData);
        }
    };

    // Function to handle various actions (attack, reinforce, scout, trade, information, rally)
    const handleActionClick = useCallback((mode, targetCity) => {
        if (['attack', 'reinforce', 'scout', 'trade'].includes(mode)) {
            setActionDetails({ mode, city: targetCity });
            setSelectedCity(null); // Close other city modal
            setSelectedVillage(null); // Close farming village modal
        } else if (['information', 'rally'].includes(mode)) {
            setMessage(`${mode.charAt(0).toUpperCase() + mode.slice(1)} is not yet implemented.`);
        }
    }, []);


    const handleSendMovement = async (movementDetails) => {
        const { mode, targetCity, units, resources, attackFormation } = movementDetails;
        const isCrossIsland = playerCity.islandId !== targetCity.islandId;
        let hasLandUnits = false, hasNavalUnits = false, totalTransportCapacity = 0, totalLandUnitsToSend = 0;

        for (const unitId in units) {
            if (units[unitId] > 0) {
                const config = unitConfig[unitId];
                if (config.type === 'land') { hasLandUnits = true; totalLandUnitsToSend += units[unitId]; }
                else if (config.type === 'naval') { hasNavalUnits = true; totalTransportCapacity += (config.capacity || 0) * units[unitId]; }
            }
        }
        if (isCrossIsland && hasLandUnits && !hasNavalUnits) { setMessage("Ground troops cannot travel across the sea without transport ships."); return; }
        if (isCrossIsland && hasLandUnits && totalTransportCapacity < totalLandUnitsToSend) { setMessage(`Not enough transport ship capacity. Need ${totalLandUnitsToSend - totalTransportCapacity} more capacity.`); return; }

        const batch = writeBatch(db);
        const newMovementRef = doc(collection(db, 'worlds', worldId, 'movements'));
        const distance = calculateDistance(playerCity, targetCity);
        const unitsBeingSent = Object.entries(units || {}).filter(([, count]) => count > 0);
        
        if (unitsBeingSent.length === 0 && !['trade', 'scout'].includes(mode)) {
            setMessage("No units selected for movement.");
            return;
        }

        const slowestSpeed = unitsBeingSent.length > 0
            ? Math.min(...unitsBeingSent.map(([unitId]) => unitConfig[unitId].speed))
            : 10; // Default speed for unit-less movements

        const travelSeconds = calculateTravelTime(distance, slowestSpeed);
        const arrivalTime = new Date(Date.now() + travelSeconds * 1000);

        batch.set(newMovementRef, {
            type: mode, 
            originCityId: playerCity.id, 
            originOwnerId: currentUser.uid, 
            targetCityId: targetCity.id, 
            targetOwnerId: targetCity.ownerId,
            ownerUsername: targetCity.ownerUsername,
            targetCityName: targetCity.cityName,
            units, 
            resources: resources || {}, 
            departureTime: serverTimestamp(), 
            arrivalTime, 
            status: 'moving', 
            attackFormation: attackFormation || {},
            involvedParties: [currentUser.uid, targetCity.ownerId].filter(id => id)
        });

        const newGameState = JSON.parse(JSON.stringify(gameState));
        for (const unitId in units) { newGameState.units[unitId] = (newGameState.units[unitId] || 0) - units[unitId]; }
        if (resources) { for (const resource in resources) { newGameState.resources[resource] -= resources[resource]; } }
        
        try {
            await batch.commit();
            setGameState(newGameState);
            setMessage(`Movement sent to ${targetCity.cityName || targetCity.name}!`);
        } catch (error) {
            console.error("Error sending movement:", error);
            setMessage(`Failed to send movement: ${error.message}`);
        }
    };
    
    const handleRushMovement = useCallback(async (movementId) => {
        if (!userProfile?.is_admin) return;
        const movementRef = doc(db, 'worlds', worldId, 'movements', movementId);
        await updateDoc(movementRef, { arrivalTime: new Date() });
    }, [userProfile, worldId]);

    const handleToggleDummyCityPlacement = () => {
        setIsPlacingDummyCity(prevMode => !prevMode);
        setMessage(isPlacingDummyCity ? 'Dummy city placement OFF.' : 'Dummy city placement ON. Click an empty slot.');
    };
    
    const handleCreateDummyCity = async (citySlotId, slotData) => {
        if (!userProfile?.is_admin) {
            setMessage("You are not authorized to perform this action.");
            return;
        }
        setIsPlacingDummyCity(false);
        setMessage("Creating dummy city...");

        const citySlotRef = doc(db, 'worlds', worldId, 'citySlots', citySlotId);
        const dummyUserId = `dummy_${uuidv4()}`;
        const dummyUsername = `DummyPlayer_${Math.floor(Math.random() * 10000)}`;
        const dummyGameDocRef = doc(db, `users/${dummyUserId}/games`, worldId);

        try {
            const slotSnap = await getDoc(citySlotRef);
            if (!slotSnap.exists() || slotSnap.data().ownerId !== null) {
                throw new Error("Slot is already taken.");
            }

            const batch = writeBatch(db);
            const dummyCityName = `${dummyUsername}'s Outpost`;

            batch.update(citySlotRef, {
                ownerId: dummyUserId,
                ownerUsername: dummyUsername,
                cityName: dummyCityName,
            });
            
            const initialBuildings = {};
            Object.keys(buildingConfig).forEach(key => {
                initialBuildings[key] = { level: 0 };
            });
            initialBuildings.senate = { level: 1 };

            batch.set(dummyGameDocRef, {
                id: citySlotId,
                cityName: dummyCityName,
                playerInfo: { religion: 'Dummy', nation: 'Dummy' },
                resources: { wood: 500, stone: 500, silver: 100 },
                buildings: initialBuildings,
                units: { swordsman: 5 },
                lastUpdated: Date.now(),
            });

            await batch.commit();
            setMessage(`Dummy city "${dummyCityName}" created successfully!`);
            
            invalidateChunkCache(slotData.x, slotData.y);

        } catch (error) {
            console.error("Error creating dummy city:", error);
            setMessage(`Failed to create dummy city: ${error.message}`);
        }
    };

    const renderVisibleTiles = () => {
        if (!mapGrid || !worldState?.islands || viewportSize.width === 0) return null;
        
        const visibleTiles = [];
        const scaledTileSize = TILE_SIZE * zoom;
        const startCol = Math.max(0, Math.floor(-pan.x / scaledTileSize));
        const endCol = Math.min(worldState.width, Math.ceil((-pan.x + viewportSize.width) / scaledTileSize));
        const startRow = Math.max(0, Math.floor(-pan.y / scaledTileSize));
        const endRow = Math.min(worldState.height, Math.ceil((-pan.y + viewportSize.height) / scaledTileSize));
        
        for (let y = startRow; y < endRow; y++) {
            for (let x = startCol; x < endCol; x++) {
                const tile = mapGrid[y][x];
                let tileContent;
                switch (tile.type) {
                    case 'city_slot':
                        tileContent = <CitySlotTile slotData={tile.data} onClick={onCitySlotClick} isPlacingDummyCity={isPlacingDummyCity} />;
                        break;
                    case 'village':
                        tileContent = <FarmingVillageTile villageData={tile.data} onClick={onVillageClick} />;
                        break;
                    case 'land':
                        tileContent = <LandTile />;
                        break;
                    default:
                        tileContent = <WaterTile />;
                        break;
                }
                visibleTiles.push(
                    <div 
                        key={`tile-${x}-${y}`} 
                        className="map-tile" 
                        style={{ position: 'absolute', left: x * TILE_SIZE, top: y * TILE_SIZE, width: TILE_SIZE, height: TILE_SIZE }}
                    >
                        {tileContent}
                    </div>
                );
            }
        }

        movements.forEach(movement => {
            visibleTiles.push(
                <MovementIndicator 
                    key={`movement-${movement.id}`}
                    movement={movement}
                    citySlots={{...combinedSlots, ...villages}}
                    allMovements={movements}
                />
            );
        });

        return visibleTiles;
    };

    return (
        <div className="w-full h-screen flex flex-col bg-gray-900">
            <Modal message={message} onClose={() => setMessage('')} />
            <header className="flex-shrink-0 flex justify-between items-center p-2 bg-gray-800 shadow-lg border-b border-gray-700 z-30">
                <h1 className="font-title text-2xl text-gray-300">World Map</h1>
                <div className="flex items-center space-x-4">
                    <p className="text-xs text-gray-400">Player: <span className="font-mono">{userProfile?.username || currentUser?.email}</span></p>
                    <button onClick={onBackToWorlds} className="text-xs text-blue-400 hover:text-blue-300">Back to Worlds</button>
                    <button onClick={() => signOut(auth)} className="text-xs text-red-400 hover:text-red-300">Logout</button>
                </div>
            </header>
            
            <div className="flex-grow flex flex-row p-4 gap-4 overflow-hidden">
                <SidebarNav 
                    onGoToCity={showCity} 
                    onOpenMovements={() => setIsMovementsPanelOpen(true)} 
                    onOpenReports={() => setIsReportsPanelOpen(true)} 
                    isAdmin={userProfile?.is_admin}
                    onToggleDummyCityPlacement={handleToggleDummyCityPlacement}
                />
                <div className="main-content flex-grow relative">
                    <div 
                        className="map-viewport" 
                        ref={viewportRef} 
                        onMouseDown={handleMouseDown}
                        style={{ cursor: isPanning ? 'grabbing' : (isPlacingDummyCity ? 'crosshair' : 'grab') }}
                    >
                        <TopBar gameState={gameState} />
                        <SideInfoPanel gameState={gameState} className="absolute top-16 right-4 z-20 flex flex-col gap-4" />
                        <div className="map-border top" style={{ opacity: borderOpacity.top }}></div>
                        <div className="map-border bottom" style={{ opacity: borderOpacity.bottom }}></div>
                        <div className="map-border left" style={{ opacity: borderOpacity.left }}></div>
                        <div className="map-border right" style={{ opacity: borderOpacity.right }}></div>

                        <div 
                            ref={mapContainerRef} 
                            style={{ 
                                width: worldState?.islands ? worldState.width * TILE_SIZE : 0, 
                                height: worldState?.islands ? worldState.height * TILE_SIZE : 0, 
                                transformOrigin: '0 0',
                            }} 
                        >
                            {renderVisibleTiles()}
                        </div>
                    </div>
                </div>
            </div>
            
            {selectedCity && (
                <OtherCityModal
                    city={selectedCity}
                    onClose={() => { setSelectedCity(null); setTravelTimeInfo(null); }}
                    onAction={handleActionClick}
                    onGoTo={goToCoordinates}
                    isVillageTarget={selectedCity.isVillageTarget}
                />
            )}
            {selectedVillage && (
                <FarmingVillageModal
                    village={selectedVillage}
                    onClose={() => setSelectedVillage(null)}
                    worldId={worldId}
                    cityId={playerCity.id}
                />
            )}
            {actionDetails && (
                <MovementModal
                    mode={actionDetails.mode}
                    targetCity={actionDetails.city}
                    playerCity={playerCity}
                    playerUnits={gameState?.units}
                    playerResources={gameState?.resources}
                    travelTimeInfo={travelTimeInfo}
                    onSend={handleSendMovement}
                    onClose={() => setActionDetails(null)}
                    setMessage={setMessage}
                />
            )}
            {isMovementsPanelOpen && (
                <MovementsPanel
                    movements={movements}
                    onClose={() => setIsMovementsPanelOpen(false)}
                    citySlots={{...combinedSlots, ...villages}}
                    onRush={handleRushMovement}
                    isAdmin={userProfile?.is_admin}
                />
            )}
            {isReportsPanelOpen && (
                <ReportsView onClose={() => setIsReportsPanelOpen(false)} />
            )}
        </div>
    );
};

export default MapView;
