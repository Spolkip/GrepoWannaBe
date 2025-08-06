// src/components/Game.js
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { useAlliance } from '../contexts/AllianceContext';
import { signOut } from "firebase/auth";
import { auth, db } from '../firebase/config';
import CityView from './CityView';
import MapView from './MapView';
import LoadingScreen from './shared/LoadingScreen';
import Chat from './chat/Chat';
import { useMovementProcessor } from '../hooks/useMovementProcessor';

import { useModalState } from '../hooks/useModalState';
import { useMapState } from '../hooks/useMapState';
import { useMapEvents } from '../hooks/useMapEvents';
import { useQuestTracker } from '../hooks/useQuestTracker';
import { useMapActions } from '../hooks/useMapActions';
import { useKeyboardControls } from '../hooks/useKeyboardControls'; // #comment Import the new hook

// Import all the modals
import ReportsView from './ReportsView';
import MessagesView from './messaging/MessagesView';
import AllianceModal from './map/AllianceModal';
import AllianceCreation from './alliance/AllianceCreation';
import AllianceForum from './alliance/AllianceForum'; 
import SettingsModal from './shared/SettingsModal';
import ProfileView from './profile/ProfileView';
import Leaderboard from './leaderboard/Leaderboard';
import AllianceProfile from './profile/AllianceProfile';
import QuestsModal from './quests/QuestsModal';
import MovementsPanel from './map/MovementsPanel';
import SharedReportView from './SharedReportView'; // #comment Import the new component
import { collection, onSnapshot, query, where, doc, updateDoc, runTransaction} from 'firebase/firestore';
import unitConfig from '../gameData/units.json'; // Import unitConfig for cancel logic

const Game = ({ onBackToWorlds }) => {
    const { activeCityId, setActiveCityId, worldId, loading, gameState, playerCities, conqueredVillages, renameCity, playerCity } = useGame();
    const { currentUser, userProfile } = useAuth();
    const { playerAlliance, acceptAllianceInvitation, sendAllianceInvitation } = useAlliance();
    const [view, setView] = useState('city');
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [panToCoords, setPanToCoords] = useState(null);
    const [viewingReportId, setViewingReportId] = useState(null); // #comment State for shared report modal

    // #comment State for globally available map data
    const [movements, setMovements] = useState([]);
    const [villages, setVillages] = useState({});
    const [ruins, setRuins] = useState({});

    useMovementProcessor(worldId);

    const { modalState, openModal, closeModal } = useModalState();
    const { unreadReportsCount, setUnreadReportsCount, unreadMessagesCount, setUnreadMessagesCount } = useMapState();
    
    const showMap = () => setView('map');
    
    // #comment Memoize showCity to prevent unnecessary re-renders of child components
    const showCity = useCallback((cityId) => {
        if (cityId) setActiveCityId(cityId);
        setView('city');
    }, [setActiveCityId]); // setView from useState is stable and doesn't need to be a dependency

    const toggleView = () => {
        setView(prevView => prevView === 'city' ? 'map' : 'city');
    };

    const centerOnCity = useCallback(() => {
        if (view === 'map' && playerCity) {
            setPanToCoords({ x: playerCity.x, y: playerCity.y });
        }
    }, [view, playerCity]);

    // #comment This function now correctly pans on the map view without switching to city view.
    const cycleCity = (direction, currentView) => {
        const sortedCities = Object.values(playerCities).sort((a, b) => a.cityName.localeCompare(b.cityName));
        const cityIds = sortedCities.map(c => c.id);
        if (cityIds.length <= 1) return;
    
        const currentIndex = cityIds.indexOf(activeCityId);
        let nextIndex;
    
        if (direction === 'right') {
            nextIndex = (currentIndex + 1) % cityIds.length;
        } else {
            nextIndex = (currentIndex - 1 + cityIds.length) % cityIds.length;
        }
        
        const nextCityId = cityIds[nextIndex];
        setActiveCityId(nextCityId);
    
        if (currentView === 'map') {
            const nextCity = playerCities[nextCityId];
            if (nextCity) {
                setPanToCoords({ x: nextCity.x, y: nextCity.y });
            }
        }
    };

    // #comment Setup keyboard controls
    useKeyboardControls({
        toggleView,
        openAlliance: () => playerAlliance ? openModal('alliance') : openModal('allianceCreation'),
        openQuests: () => openModal('quests'),
        centerOnCity,
        openForum: () => openModal('allianceForum'),
        openMessages: () => openModal('messages'),
        openLeaderboard: () => openModal('leaderboard'),
        openProfile: () => openModal('profile'),
        openSettings: () => openModal('settings'),
        cycleCityLeft: () => cycleCity('left', view),
        cycleCityRight: () => cycleCity('right', view),
    });


    // #comment Fetch data that needs to be available in both City and Map views
    useEffect(() => {
        if (!worldId || !currentUser) return;

        // Movements listener
        const movementsRef = collection(db, 'worlds', worldId, 'movements');
        const q = query(movementsRef, where('involvedParties', 'array-contains', currentUser.uid));
        const unsubscribeMovements = onSnapshot(q, (snapshot) => {
            const allMovements = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setMovements(allMovements.sort((a, b) => a.arrivalTime.toMillis() - b.arrivalTime.toMillis()));
        });

        // Villages listener
        const villagesColRef = collection(db, 'worlds', worldId, 'villages');
        const unsubscribeVillages = onSnapshot(villagesColRef, (snapshot) => {
            const villagesData = {};
            snapshot.docs.forEach(doc => {
                villagesData[doc.id] = { id: doc.id, ...doc.data() };
            });
            setVillages(villagesData);
        });

        // Ruins listener
        const ruinsColRef = collection(db, 'worlds', worldId, 'ruins');
        const unsubscribeRuins = onSnapshot(ruinsColRef, (snapshot) => {
            const ruinsData = {};
            snapshot.docs.forEach(doc => {
                ruinsData[doc.id] = { id: doc.id, ...doc.data() };
            });
            setRuins(ruinsData);
        });

        return () => {
            unsubscribeMovements();
            unsubscribeVillages();
            unsubscribeRuins();
        };
    }, [worldId, currentUser]);
    
    const { handleCancelMovement } = useMapActions(openModal, closeModal, showCity, () => {});

    // #comment This function now handles cancelling a recruitment/healing item from any city's queue.
    const handleCancelTrain = useCallback(async (cityId, itemIndex, isHealing) => {
        const cityState = playerCities[cityId];
        const queueName = isHealing ? 'healQueue' : 'unitQueue';
        const costField = isHealing ? 'heal_cost' : 'cost';
        const refundField = isHealing ? 'wounded' : 'units';

        if (!cityState || !cityState[queueName] || itemIndex < 0 || itemIndex >= cityState[queueName].length) {
            return;
        }

        const cityDocRef = doc(db, 'users', currentUser.uid, 'games', worldId, 'cities', cityId);

        try {
            await runTransaction(db, async (transaction) => {
                const cityDoc = await transaction.get(cityDocRef);
                if (!cityDoc.exists()) throw new Error("City data not found.");
                
                const currentState = cityDoc.data();
                const newQueue = [...currentState[queueName]];
                const canceledTask = newQueue.splice(itemIndex, 1)[0];
                const unit = unitConfig[canceledTask.unitId];

                const newResources = { ...currentState.resources };
                newResources.wood += (unit[costField].wood || 0) * canceledTask.amount;
                newResources.stone += (unit[costField].stone || 0) * canceledTask.amount;
                newResources.silver += (unit[costField].silver || 0) * canceledTask.amount;

                const newRefundUnits = { ...currentState[refundField] };
                if (isHealing) {
                    newRefundUnits[canceledTask.unitId] = (newRefundUnits[canceledTask.unitId] || 0) + canceledTask.amount;
                }

                for (let i = itemIndex; i < newQueue.length; i++) {
                    const prevEndTime = (i === 0) ? Date.now() : (newQueue[i - 1].endTime.toDate ? newQueue[i - 1].endTime.toDate().getTime() : new Date(newQueue[i - 1].endTime).getTime());
                    const task = newQueue[i];
                    const taskUnit = unitConfig[task.unitId];
                    const taskTime = (isHealing ? taskUnit.heal_time : taskUnit.cost.time) * task.amount;
                    newQueue[i].endTime = new Date(prevEndTime + taskTime * 1000);
                }

                const updates = {
                    resources: newResources,
                    [queueName]: newQueue,
                };
                if (isHealing) {
                    updates.wounded = newRefundUnits;
                }

                transaction.update(cityDocRef, updates);
            });
        } catch (error) {
            console.error("Error cancelling training:", error);
        }
    }, [worldId, currentUser, playerCities]);


    const handleRushMovement = useCallback(async (movementId) => {
        if (userProfile?.is_admin) {
            await updateDoc(doc(db, 'worlds', worldId, 'movements', movementId), { arrivalTime: new Date() });
        }
    }, [userProfile, worldId]);

    useMapEvents(currentUser, worldId, setUnreadReportsCount, setUnreadMessagesCount);
    const { quests, claimReward: claimQuestReward } = useQuestTracker(gameState);

    const { incomingAttackCount, isUnderAttack } = useMemo(() => {
        if (!movements || !playerCities) return { incomingAttackCount: 0, isUnderAttack: false };
        const cityIds = Object.keys(playerCities);
        const count = movements.filter(m =>
            (m.type === 'attack' && cityIds.includes(m.targetCityId) && m.status === 'moving') ||
            (m.type === 'attack_village' && m.targetVillageId && conqueredVillages[m.targetVillageId] && m.status === 'moving')
        ).length;
        return { incomingAttackCount: count, isUnderAttack: count > 0 };
    }, [movements, playerCities, conqueredVillages]);

    const combinedSlots = useMemo(() => ({ ...playerCities, ...villages, ...ruins }), [playerCities, villages, ruins]);
    
    const handleOpenAlliance = () => playerAlliance ? openModal('alliance') : openModal('allianceCreation');
    const handleMessageAction = async (type, id) => {
        if (type === 'accept_invite') {
            await acceptAllianceInvitation(id);
        } else if (type === 'decline_invite') {
            alert("Invitation declined.");
        } else if (type === 'view_report') {
            setViewingReportId(id);
        }
    };
    const handleOpenProfile = (userId) => openModal('profile', { userId });
    const handleOpenAllianceProfile = (allianceId) => openModal('allianceProfile', { allianceId });
    
    const handleGoToCityFromProfile = useCallback((x, y) => {
        setView('map');
        setPanToCoords({x, y});
        closeModal('profile');
    }, [closeModal]);

    if (loading) {
        return <LoadingScreen message="Loading Game..." />;
    }

    return (
        <div className="w-full h-screen bg-gray-900 text-white relative">
            {view === 'city' && (
                <CityView 
                    showMap={showMap} 
                    worldId={worldId} 
                    openModal={openModal}
                    unreadReportsCount={unreadReportsCount}
                    unreadMessagesCount={unreadMessagesCount}
                    isUnderAttack={isUnderAttack}
                    incomingAttackCount={incomingAttackCount}
                    handleOpenAlliance={handleOpenAlliance}
                    handleOpenProfile={handleOpenProfile}
                    // Pass global data down to CityView
                    movements={movements}
                    onCancelTrain={handleCancelTrain}
                    onCancelMovement={handleCancelMovement}
                    combinedSlots={combinedSlots}
                    onRenameCity={renameCity}
                    quests={quests}
                />
            )}
            {view === 'map' && (
                <MapView 
                    showCity={showCity} 
                    openModal={openModal}
                    closeModal={closeModal}
                    modalState={modalState}
                    unreadReportsCount={unreadReportsCount}
                    unreadMessagesCount={unreadMessagesCount}
                    quests={quests}
                    claimReward={claimQuestReward}
                    handleMessageAction={handleMessageAction}
                    panToCoords={panToCoords}
                    setPanToCoords={setPanToCoords}
                    handleGoToCityFromProfile={handleGoToCityFromProfile}
                    // #comment Pass global data down to MapView
                    movements={movements}
                    villages={villages}
                    ruins={ruins}
                    onCancelTrain={handleCancelTrain}
                    onCancelMovement={handleCancelMovement}
                    combinedSlots={combinedSlots}
                    isUnderAttack={isUnderAttack}
                    incomingAttackCount={incomingAttackCount}
                    onRenameCity={renameCity}
                    centerOnCity={centerOnCity}
                />
            )}
            
            {/* Render shared modals here */}
            {modalState.isReportsPanelOpen && <ReportsView onClose={() => closeModal('reports')} />}
            {modalState.isMessagesPanelOpen && <MessagesView onClose={() => closeModal('messages')} onActionClick={handleMessageAction} initialRecipientId={modalState.actionDetails?.city?.ownerId} initialRecipientUsername={modalState.actionDetails?.city?.ownerUsername} />}
            {modalState.isAllianceModalOpen && <AllianceModal onClose={() => closeModal('alliance')} />}
            {modalState.isAllianceCreationOpen && <AllianceCreation onClose={() => closeModal('allianceCreation')} />}
            {modalState.isAllianceForumOpen && <AllianceForum onClose={() => closeModal('allianceForum')} onActionClick={handleMessageAction} />}
            {modalState.isQuestsModalOpen && <QuestsModal quests={quests} claimReward={claimQuestReward} onClose={() => closeModal('quests')} />}
            {modalState.isProfileModalOpen && <ProfileView onClose={() => closeModal('profile')} viewUserId={modalState.viewingProfileId} onGoToCity={handleGoToCityFromProfile} onInviteToAlliance={sendAllianceInvitation} onOpenAllianceProfile={handleOpenAllianceProfile} />}
            {modalState.isLeaderboardOpen && <Leaderboard onClose={() => closeModal('leaderboard')} onOpenProfile={handleOpenProfile} onOpenAllianceProfile={handleOpenAllianceProfile} />}
            {modalState.isAllianceProfileOpen && <AllianceProfile allianceId={modalState.viewingAllianceId} onClose={() => closeModal('allianceProfile')} onOpenProfile={handleOpenProfile} />}
            {modalState.isSettingsModalOpen && <SettingsModal onClose={() => closeModal('settings')} />}
            
            {viewingReportId && <SharedReportView reportId={viewingReportId} onClose={() => setViewingReportId(null)} />}

            {/* #comment Render MovementsPanel globally so it works in both views */}
            {modalState.isMovementsPanelOpen && <MovementsPanel
                movements={movements}
                onClose={() => closeModal('movements')}
                combinedSlots={combinedSlots}
                villages={villages} // Keep for now, might be redundant
                onCancel={handleCancelMovement}
                onRush={handleRushMovement}
                isAdmin={userProfile?.is_admin}
            />}


            <div className="chat-container">
                <button onClick={() => setIsChatOpen(prev => !prev)} className="chat-toggle-button">
                    💬
                </button>
                <Chat isVisible={isChatOpen} onClose={() => setIsChatOpen(false)} />
            </div>

            <div className="absolute bottom-4 left-4 z-30 flex flex-col space-y-2">
                {view === 'map' && <button onClick={onBackToWorlds} className="text-sm text-blue-400 hover:text-blue-300 bg-gray-800 px-3 py-1 rounded shadow-lg">Back to World Selection</button>}
                <button onClick={() => signOut(auth)} className="text-sm text-red-400 hover:text-red-300 bg-gray-800 px-3 py-1 rounded shadow-lg">Logout</button>
            </div>
        </div>
    );
};

export default Game;
