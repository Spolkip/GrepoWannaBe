// src/components/MapView.js
import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { signOut } from "firebase/auth";
import { auth, db } from '../firebase/config';
import { doc, updateDoc, collection, onSnapshot, query, where, writeBatch, serverTimestamp } from 'firebase/firestore';

// UI Components
import Modal from './shared/Modal';
import SidebarNav from './map/SidebarNav';
import TopBar from './map/TopBar';
import MapGrid from './map/MapGrid';
import MapModals from './map/MapModals';
import SideInfoPanel from './SideInfoPanel';
import AllianceModal from './map/AllianceModal';
import SettingsModal from './shared/SettingsModal';
import DivinePowers from './city/DivinePowers';

// Custom Hooks
import { useMapInteraction } from '../hooks/useMapInteraction';
import { useMapData } from '../hooks/usemapdatapls';
import { useModalState } from '../hooks/useModalState';
import { useMapActions } from '../hooks/useMapActions';
import { useCityState } from '../hooks/useCityState';

// Utilities
import { calculateDistance } from '../utils/travel';
import { getVillageTroops } from '../utils/combat';

const MapView = ({ showCity, onBackToWorlds }) => {
    const { currentUser, userProfile } = useAuth();
    const { worldState, gameState, setGameState, worldId, playerCity, playerAlliance, conqueredVillages } = useGame();

    const [isPlacingDummyCity, setIsPlacingDummyCity] = useState(false);
    const [unreadReportsCount, setUnreadReportsCount] = useState(0);
    const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [gameSettings, setGameSettings] = useState({ animations: true, confirmActions: true });

    const viewportRef = useRef(null);
    const mapContainerRef = useRef(null);

    const {
        modalState,
        openModal,
        closeModal,
    } = useModalState();

    const {
        pan,
        zoom,
        viewportSize,
        borderOpacity,
        isPanning,
        handleMouseDown,
        goToCoordinates,
        centerOnCity
    } = useMapInteraction(viewportRef, mapContainerRef, worldState, playerCity);

    const {
        movements,
        visibleSlots,
        villages,
        invalidateChunkCache
    } = useMapData(currentUser, worldId, worldState, pan, zoom, viewportSize);

    const {
        message,
        setMessage,
        travelTimeInfo,
        setTravelTimeInfo,
        handleActionClick,
        handleSendMovement,
        handleCreateDummyCity
    } = useMapActions(openModal, closeModal, showCity, invalidateChunkCache);
    
    const { getFarmCapacity, calculateUsedPopulation, saveGameState } = useCityState(worldId);

    const maxPopulation = useMemo(() => {
        return gameState?.buildings ? getFarmCapacity(gameState.buildings.farm?.level) : 0;
    }, [gameState?.buildings, getFarmCapacity]);

    const usedPopulation = useMemo(() => {
        return gameState?.buildings && gameState?.units ? calculateUsedPopulation(gameState.buildings, gameState.units) : 0;
    }, [gameState?.buildings, gameState?.units, calculateUsedPopulation]);

    const availablePopulation = useMemo(() => {
        return maxPopulation - usedPopulation;
    }, [maxPopulation, usedPopulation]);

    useEffect(() => {
        if (!currentUser) return;
        const reportsQuery = query(collection(db, 'users', currentUser.uid, 'reports'), where('read', '==', false));
        const unsubscribeReports = onSnapshot(reportsQuery, (snapshot) => {
            setUnreadReportsCount(snapshot.size);
        });

        const conversationsQuery = query(
            collection(db, 'worlds', worldId, 'conversations'),
            where('participants', 'array-contains', currentUser.uid)
        );
        const unsubscribeMessages = onSnapshot(conversationsQuery, (snapshot) => {
            let unreadCount = 0;
            snapshot.forEach(doc => {
                const convo = doc.data();
                if (convo.lastMessage && convo.lastMessage.senderId !== currentUser.uid && !convo.readBy.includes(currentUser.uid)) {
                    unreadCount++;
                }
            });
            setUnreadMessagesCount(unreadCount);
        });

        return () => {
            unsubscribeReports();
            unsubscribeMessages();
        };
    }, [currentUser, worldId]);

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

    const combinedSlots = useMemo(() => {
        const slots = { ...visibleSlots };
        if (playerCity) {
            slots[playerCity.id] = playerCity;
        }
        return slots;
    }, [visibleSlots, playerCity]);
    
    const onCitySlotClick = (e, slotData) => {
        closeModal('village');
        if (isPlacingDummyCity && !slotData.ownerId) {
            handleCreateDummyCity(slotData.id, slotData).then(() => {
                setIsPlacingDummyCity(false);
            });
            return;
        }

        if (slotData.ownerId === currentUser.uid) {
            showCity();
        } else if (slotData.ownerId) {
            if (playerCity) {
                const distance = calculateDistance(playerCity, slotData);
                setTravelTimeInfo({ distance });
            }
            const cityDataWithAlliance = { ...slotData, playerAlliance };
            openModal('city', cityDataWithAlliance);
        } else {
            setMessage('This plot is empty. Future updates will allow colonization!');
        }
    };
    
    const onVillageClick = (e, villageData) => {
        closeModal('city');
        if (playerCity.islandId !== villageData.islandId) {
            setMessage("You can only interact with villages on islands where you have a city.");
            return;
        }

        const isConqueredByPlayer = conqueredVillages && conqueredVillages[villageData.id];

        if (isConqueredByPlayer) {
            openModal('village', { ...villageData, ...conqueredVillages[villageData.id] });
        } else {
            const distance = playerCity ? calculateDistance(playerCity, villageData) : Infinity;
            setTravelTimeInfo({ distance });
            const targetData = {
                id: villageData.id,
                name: villageData.name,
                cityName: villageData.name,
                ownerId: null,
                ownerUsername: 'Neutral',
                x: villageData.x,
                y: villageData.y,
                islandId: villageData.islandId,
                isVillageTarget: true,
                troops: getVillageTroops(villageData),
                level: villageData.level || 1
            };
            openModal('city', targetData);
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

    const handleSaveSettings = (newSettings) => {
        setGameSettings(newSettings);
        console.log("Settings saved:", newSettings);
    };

    const handleCastSpell = async (power) => {
        const currentState = gameState;
        if (!currentState || !currentState.god || (currentState.worship[currentState.god] || 0) < power.favorCost) {
            setMessage("Not enough favor to cast this spell.");
            return;
        }

        const newGameState = JSON.parse(JSON.stringify(currentState));
        newGameState.worship[currentState.god] -= power.favorCost;

        switch (power.effect.type) {
            case 'add_resources':
                newGameState.resources[power.effect.resource] = (newGameState.resources[power.effect.resource] || 0) + power.effect.amount;
                break;
            case 'add_multiple_resources':
                for (const resource in power.effect.resources) {
                    newGameState.resources[resource] = (newGameState.resources[resource] || 0) + power.effect.resources[resource];
                }
                break;
            // Add more spell effects here in the future
            default:
                setMessage("This spell's effect is not yet implemented.");
                return;
        }

        try {
            await saveGameState(newGameState);
            setGameState(newGameState);
            setMessage(`${power.name} has been cast!`);
            closeModal('divinePowers');
        } catch (error) {
            console.error("Error casting spell:", error);
            setMessage("Failed to cast the spell. Please try again.");
        }
    };
    
    const handleTargetedCastSpell = async (power) => {
        const targetCity = modalState.divinePowersTarget;
        if (!targetCity) return;

        const currentState = gameState;
        if (!currentState || !currentState.god || (currentState.worship[currentState.god] || 0) < power.favorCost) {
            setMessage("Not enough favor to cast this spell.");
            return;
        }

        const batch = writeBatch(db);
        const newMovementRef = doc(collection(db, 'worlds', worldId, 'movements'));
        const arrivalTime = new Date(Date.now()); // Spells are instant

        const movementData = {
            type: 'spell_cast',
            power: power,
            originCityId: playerCity.id,
            originOwnerId: currentUser.uid,
            originOwnerUsername: userProfile.username,
            targetCityId: targetCity.id,
            targetOwnerId: targetCity.ownerId,
            targetCityName: targetCity.cityName,
            departureTime: serverTimestamp(),
            arrivalTime: arrivalTime,
            status: 'moving',
            involvedParties: [currentUser.uid, targetCity.ownerId].filter(id => id),
        };
        batch.set(newMovementRef, movementData);

        const newFavor = (currentState.worship[currentState.god] || 0) - power.favorCost;
        const gameDocRef = doc(db, `users/${currentUser.uid}/games`, worldId);
        batch.update(gameDocRef, {
            [`worship.${currentState.god}`]: newFavor
        });

        try {
            await batch.commit();
            const newGameState = JSON.parse(JSON.stringify(currentState));
            newGameState.worship[currentState.god] = newFavor;
            setGameState(newGameState);

            setMessage(`${power.name} has been cast on ${targetCity.cityName}!`);
            closeModal('divinePowers');
        } catch (error) {
            console.error("Error casting targeted spell:", error);
            setMessage("Failed to cast the spell.");
        }
    };
    
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
                    onOpenMovements={() => openModal('movements')}
                    onOpenReports={() => openModal('reports')}
                    onOpenAlliance={() => openModal('alliance')}
                    onOpenMessages={() => openModal('messages')}
                    onOpenSettings={() => setIsSettingsModalOpen(true)}
                    unreadReportsCount={unreadReportsCount}
                    unreadMessagesCount={unreadMessagesCount}
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
                        <TopBar 
                            gameState={gameState} 
                            availablePopulation={availablePopulation} 
                            maxPopulation={maxPopulation} 
                        />
                        <SideInfoPanel 
                            gameState={gameState} 
                            className="absolute top-16 right-4 z-20 flex flex-col gap-4"
                            onOpenPowers={() => openModal('divinePowers')}
                        />
                        <div className="map-border top" style={{ opacity: borderOpacity.top }}></div>
                        <div className="map-border bottom" style={{ opacity: borderOpacity.bottom }}></div>
                        <div className="map-border left" style={{ opacity: borderOpacity.left }}></div>
                        <div className="map-border right" style={{ opacity: borderOpacity.right }}></div>

                        <div
                            ref={mapContainerRef}
                            style={{
                                width: worldState?.islands ? worldState.width * 32 : 0,
                                height: worldState?.islands ? worldState.height * 32 : 0,
                                transformOrigin: '0 0',
                            }}
                        >
                            <MapGrid
                                mapGrid={mapGrid}
                                worldState={worldState}
                                pan={pan}
                                zoom={zoom}
                                viewportSize={viewportSize}
                                onCitySlotClick={onCitySlotClick}
                                onVillageClick={onVillageClick}
                                isPlacingDummyCity={isPlacingDummyCity}
                                movements={movements}
                                combinedSlots={combinedSlots}
                                villages={villages}
                                playerAlliance={playerAlliance}
                                conqueredVillages={conqueredVillages}
                            />
                        </div>
                    </div>
                </div>
            </div>
            
            <MapModals
                modalState={modalState}
                closeModal={closeModal}
                gameState={gameState}
                playerCity={playerCity}
                travelTimeInfo={travelTimeInfo}
                handleSendMovement={handleSendMovement}
                setMessage={setMessage}
                goToCoordinates={goToCoordinates}
                handleActionClick={handleActionClick}
                worldId={worldId}
                movements={movements}
                combinedSlots={combinedSlots}
                villages={villages}
                handleRushMovement={handleRushMovement}
                userProfile={userProfile}
            />
            
            {modalState.isAllianceModalOpen && (
                <AllianceModal onClose={() => closeModal('alliance')} />
            )}

            {isSettingsModalOpen && (
                <SettingsModal
                    onClose={() => setIsSettingsModalOpen(false)}
                    onSaveSettings={handleSaveSettings}
                    initialSettings={gameSettings}
                />
            )}

            {modalState.isDivinePowersOpen && (
                <DivinePowers
                    godName={gameState.god}
                    playerReligion={gameState.playerInfo.religion}
                    favor={gameState.worship[gameState.god] || 0}
                    onCastSpell={modalState.divinePowersTarget ? handleTargetedCastSpell : handleCastSpell}
                    onClose={() => closeModal('divinePowers')}
                    targetType={modalState.divinePowersTarget ? 'other' : 'self'}
                />
            )}
        </div>
    );
};

export default MapView;