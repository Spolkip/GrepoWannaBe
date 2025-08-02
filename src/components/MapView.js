// src/components/MapView.js

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { signOut } from "firebase/auth";
import { auth, db } from '../firebase/config';
import { doc, updateDoc, collection, onSnapshot, query, where, writeBatch, serverTimestamp, getDoc } from 'firebase/firestore';


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
import ProfileView from './profile/ProfileView';
import AllianceCreation from './alliance/AllianceCreation';
import Leaderboard from './leaderboard/Leaderboard';

// Custom Hooks
import { useMapInteraction } from '../hooks/useMapInteraction';
import { useMapData } from '../hooks/usemapdatapls';
import { useModalState } from '../hooks/useModalState';
import { useMapActions } from '../hooks/useMapActions';
import { useCityState } from '../hooks/useCityState';

// Utilities
import { calculateDistance } from '../utils/travel';
import { getVillageTroops } from '../utils/combat';
import buildingConfig from '../gameData/buildings.json';


const MapView = ({ showCity, onBackToWorlds }) => {
    const { currentUser, userProfile } = useAuth();
    const { worldState, gameState, setGameState, worldId, playerCity, playerAlliance, conqueredVillages, conqueredRuins, gameSettings, sendAllianceInvitation, acceptAllianceInvitation } = useGame();

    const [isPlacingDummyCity, setIsPlacingDummyCity] = useState(false);
    const [unreadReportsCount, setUnreadReportsCount] = useState(0);
    const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

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
        ruins,
        invalidateChunkCache
    } = useMapData(currentUser, worldId, worldState, pan, zoom, viewportSize);

    const {
        message,
        setMessage,
        travelTimeInfo,
        setTravelTimeInfo,
        handleActionClick,
        handleSendMovement,
        handleCancelMovement,
        handleCreateDummyCity
    } = useMapActions(openModal, closeModal, showCity, invalidateChunkCache);
    
    const { getFarmCapacity, calculateUsedPopulation, calculateHappiness } = useCityState(worldId);

    const maxPopulation = useMemo(() => {
        return gameState?.buildings ? getFarmCapacity(gameState.buildings.farm?.level) : 0;
    }, [gameState?.buildings, getFarmCapacity]);

    const usedPopulation = useMemo(() => {
        return gameState?.buildings && gameState?.units ? calculateUsedPopulation(gameState.buildings, gameState.units) : 0;
    }, [gameState?.buildings, gameState?.units, calculateUsedPopulation]);

    const availablePopulation = useMemo(() => {
        return maxPopulation - usedPopulation;
    }, [maxPopulation, usedPopulation]);

    const happiness = useMemo(() => {
        return gameState?.buildings ? calculateHappiness(gameState.buildings) : 0;
    }, [gameState?.buildings, calculateHappiness]);

    const handleOpenAlliance = () => {
        if (playerAlliance) {
            openModal('alliance');
        } else {
            openModal('allianceCreation');
        }
    };

    const handleMessageAction = async (type, id) => {
        if (type === 'accept_invite') {
            await acceptAllianceInvitation(id);
        } else if (type === 'decline_invite') {
            alert("Invitation declined. (This will be fully implemented later)");
            // #comment In the future, this would update the message or delete the invitation.
        }
    };

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
        if (!playerCity) {
            setMessage("Your city data is still loading. Please wait a moment.");
            return;
        }
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
            const distance = calculateDistance(playerCity, slotData);
            setTravelTimeInfo({ distance });
            const cityDataWithAlliance = { ...slotData, playerAlliance };
            openModal('city', cityDataWithAlliance);
        } else {
            setMessage('This plot is empty. Future updates will allow colonization!');
        }
    };
    
    const onVillageClick = (e, villageData) => {
        if (!playerCity) {
            setMessage("Your city data is still loading. Please wait a moment.");
            return;
        }
        closeModal('city');
        if (playerCity.islandId !== villageData.islandId) {
            setMessage("You can only interact with villages on islands where you have a city.");
            return;
        }

        const isConqueredByPlayer = conqueredVillages && conqueredVillages[villageData.id];

        if (isConqueredByPlayer) {
            openModal('village', { ...villageData, ...conqueredVillages[villageData.id] });
        } else {
            const distance = calculateDistance(playerCity, villageData);
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
                level: villageData.level || 1,
                demands: villageData.demands,
                supplies: villageData.supplies,
                tradeRatio: villageData.tradeRatio
            };
            openModal('city', targetData);
        }
    };

    const onRuinClick = (e, ruinData) => {
        if (!playerCity) {
            setMessage("Your city data is still loading. Please wait a moment.");
            return;
        }
        closeModal('city');
        closeModal('village');
        const distance = calculateDistance(playerCity, ruinData);
        setTravelTimeInfo({ distance });

        const isConqueredByYou = conqueredRuins && conqueredRuins[ruinData.id];

        const targetData = {
            id: ruinData.id,
            name: ruinData.name,
            cityName: ruinData.name,
            ownerId: ruinData.ownerId || 'ruins',
            ownerUsername: ruinData.ownerUsername || 'Ancient Guardians',
            x: ruinData.x,
            y: ruinData.y,
            isRuinTarget: true,
            troops: ruinData.troops,
            researchReward: ruinData.researchReward,
            isConqueredByYou: !!isConqueredByYou
        };
        openModal('city', targetData);
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

    const handleCastSpell = async (power, targetCity) => {
        const currentState = gameState;
        if (!currentState || !currentState.god || (currentState.worship[currentState.god] || 0) < power.favorCost) {
            setMessage("Not enough favor to cast this spell.");
            return;
        }
    
        const batch = writeBatch(db);
    
        // 1. Deduct favor from the caster
        const casterGameDocRef = doc(db, `users/${currentUser.uid}/games`, worldId);
        const newWorship = { ...currentState.worship };
        newWorship[currentState.god] -= power.favorCost;
        batch.update(casterGameDocRef, { worship: newWorship });
    
        // 2. Determine target
        const isSelfCast = !targetCity;
        const targetOwnerId = isSelfCast ? currentUser.uid : targetCity.ownerId;
        const targetGameDocRef = doc(db, `users/${targetOwnerId}/games`, worldId);
        const targetGameSnap = await getDoc(targetGameDocRef);
    
        if (!targetGameSnap.exists()) {
            setMessage("Target city's game data not found.");
            await batch.commit(); // Still commit the favor cost deduction
            setGameState({ ...gameState, worship: newWorship });
            return;
        }
    
        const targetGameState = targetGameSnap.data();
        let spellEffectMessage = '';
        let casterMessage = '';
    
        // 3. Apply spell effect
        switch (power.effect.type) {
            case 'add_resources':
            case 'add_multiple_resources': {
                const resourcesToAdd = power.effect.type === 'add_resources'
                    ? { [power.effect.resource]: power.effect.amount }
                    : power.effect.resources;
                
                const newResources = { ...targetGameState.resources };
                let resourcesReceivedMessage = [];
                for (const resource in resourcesToAdd) {
                    newResources[resource] = (newResources[resource] || 0) + resourcesToAdd[resource];
                    resourcesReceivedMessage.push(`${resourcesToAdd[resource]} ${resource}`);
                }
                batch.update(targetGameDocRef, { resources: newResources });
    
                if (isSelfCast) {
                    casterMessage = `You have blessed yourself with ${resourcesReceivedMessage.join(' and ')}!`;
                } else {
                    spellEffectMessage = `Your city ${targetGameState.cityName} has been blessed with ${resourcesReceivedMessage.join(' and ')} by ${userProfile.username}!`;
                    casterMessage = `You have blessed ${targetGameState.cityName} with ${resourcesReceivedMessage.join(' and ')}.`;
                }
                break;
            }
            case 'damage_building': {
                if (isSelfCast) break; // This spell should not be self-cast
                const buildings = { ...targetGameState.buildings };
                const buildingKeys = Object.keys(buildings).filter(b => buildings[b].level > 0);
                if (buildingKeys.length > 0) {
                    const randomBuildingKey = buildingKeys[Math.floor(Math.random() * buildingKeys.length)];
                    buildings[randomBuildingKey].level = Math.max(0, buildings[randomBuildingKey].level - power.effect.amount);
                    spellEffectMessage = `Your ${buildingConfig[randomBuildingKey]?.name || 'building'} in ${targetGameState.cityName} was damaged by a divine power from ${userProfile.username}!`;
                    casterMessage = `You damaged a building in ${targetGameState.cityName}.`;
                    batch.update(targetGameDocRef, { buildings });
                } else {
                    casterMessage = `You attempted to damage a building in ${targetGameState.cityName}, but there were none.`;
                }
                break;
            }
            default:
                setMessage("This spell's effect is not yet implemented for instant casting.");
                return; // Don't commit batch if not implemented
        }
    
        // 4. Create reports
        const casterReport = {
            type: 'spell_cast',
            title: `Spell cast: ${power.name}`,
            timestamp: serverTimestamp(),
            outcome: { message: casterMessage },
            read: false,
        };
        batch.set(doc(collection(db, `users/${currentUser.uid}/reports`)), casterReport);
    
        if (!isSelfCast) {
            const targetReport = {
                type: 'spell_received',
                title: `Divine Intervention!`,
                timestamp: serverTimestamp(),
                outcome: { message: spellEffectMessage, from: playerCity.cityName },
                read: false,
            };
            batch.set(doc(collection(db, `users/${targetOwnerId}/reports`)), targetReport);
        }
    
        // 5. Commit batch and update local state
        try {
            await batch.commit();
            setMessage(`${power.name} has been cast!`);
            closeModal('divinePowers');
            
            // Optimistically update local state for caster
            if (isSelfCast) {
                const updatedSelfSnap = await getDoc(casterGameDocRef);
                if (updatedSelfSnap.exists()) {
                    setGameState(updatedSelfSnap.data());
                }
            } else {
                setGameState({ ...gameState, worship: newWorship });
            }
        } catch (error) {
            console.error("Error casting spell:", error);
            setMessage("Failed to cast the spell. Please try again.");
        }
    };

    const handleGoToCityFromProfile = (x, y) => {
        goToCoordinates(x, y);
        closeModal('profile');
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

        Object.values(ruins).forEach(ruin => {
            const x = Math.round(ruin.x);
            const y = Math.round(ruin.y);
            if (grid[y]?.[x]?.type === 'water') {
                grid[y][x] = { type: 'ruin', data: ruin };
            }
        });

        return grid;
    }, [worldState, combinedSlots, villages, ruins]);

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
                    onOpenAlliance={handleOpenAlliance}
                    onOpenForum={() => openModal('allianceForum')}
                    onOpenMessages={() => openModal('messages')}
                    onOpenSettings={() => setIsSettingsModalOpen(true)}
                    onOpenProfile={() => openModal('profile')}
                    onOpenLeaderboard={() => openModal('leaderboard')}
                    unreadReportsCount={unreadReportsCount}
                    unreadMessagesCount={unreadMessagesCount}
                    isAdmin={userProfile?.is_admin}
                    onToggleDummyCityPlacement={handleToggleDummyCityPlacement}
                />
                <div className="main-content flex-grow relative map-background">
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
                            happiness={happiness}
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
                                width: worldState?.width ? worldState.width * 32 : 0,
                                height: worldState?.height ? worldState.height * 32 : 0,
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
                                onRuinClick={onRuinClick}
                                isPlacingDummyCity={isPlacingDummyCity}
                                movements={movements}
                                combinedSlots={combinedSlots}
                                villages={villages}
                                playerAlliance={playerAlliance}
                                conqueredVillages={conqueredVillages}
                                gameSettings={gameSettings}
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
                handleCancelMovement={handleCancelMovement}
                setMessage={setMessage}
                goToCoordinates={goToCoordinates}
                handleActionClick={handleActionClick}
                worldId={worldId}
                movements={movements}
                combinedSlots={combinedSlots}
                villages={villages}
                handleRushMovement={handleRushMovement}
                userProfile={userProfile}
                onActionClick={handleMessageAction}
            />
            
            {modalState.isAllianceModalOpen && (
                <AllianceModal onClose={() => closeModal('alliance')} />
            )}

            {modalState.isAllianceCreationOpen && (
                <AllianceCreation onClose={() => closeModal('allianceCreation')} />
            )}

            {isSettingsModalOpen && (
                <SettingsModal
                    onClose={() => setIsSettingsModalOpen(false)}
                />
            )}

            {modalState.isDivinePowersOpen && (
                <DivinePowers
                    godName={gameState.god}
                    playerReligion={gameState.playerInfo.religion}
                    favor={gameState.worship[gameState.god] || 0}
                    onCastSpell={(power) => handleCastSpell(power, modalState.divinePowersTarget)}
                    onClose={() => closeModal('divinePowers')}
                    targetType={modalState.divinePowersTarget ? 'other' : 'self'}
                />
            )}
            
            {modalState.isProfileModalOpen && (
                <ProfileView 
                    onClose={() => closeModal('profile')} 
                    viewUserId={modalState.viewingProfileId} 
                    onGoToCity={handleGoToCityFromProfile}
                    onInviteToAlliance={sendAllianceInvitation}
                />
            )}
             {modalState.isLeaderboardOpen && (
                <Leaderboard 
                    onClose={() => closeModal('leaderboard')} 
                    onOpenProfile={(userId) => openModal('profile', { userId })}
                />
            )}
        </div>
    );
};

export default MapView;
