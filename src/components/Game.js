// src/components/Game.js
import React, { useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { useAlliance } from '../contexts/AllianceContext';
import { signOut } from "firebase/auth";
import { auth } from '../firebase/config';
import CityView from './CityView';
import MapView from './MapView';
import LoadingScreen from './shared/LoadingScreen';
import Chat from './chat/Chat';
import { useMovementProcessor } from '../hooks/useMovementProcessor';

import { useModalState } from '../hooks/useModalState';
import { useMapState } from '../hooks/useMapState';
import { useMapEvents } from '../hooks/useMapEvents';
import { useQuestTracker } from '../hooks/useQuestTracker';

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

const Game = ({ onBackToWorlds }) => {
    const { activeCityId, setActiveCityId, worldId, loading, gameState } = useGame();
    const { currentUser } = useAuth();
    const { playerAlliance, acceptAllianceInvitation, sendAllianceInvitation } = useAlliance();
    const [view, setView] = useState('city');
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [panToCoords, setPanToCoords] = useState(null);

    useMovementProcessor(worldId);

    const { modalState, openModal, closeModal } = useModalState();
    const { unreadReportsCount, setUnreadReportsCount, unreadMessagesCount, setUnreadMessagesCount } = useMapState();
    
    useMapEvents(currentUser, worldId, setUnreadReportsCount, setUnreadMessagesCount, () => {});
    const { quests, claimReward: claimQuestReward } = useQuestTracker(gameState);

    const showMap = () => setView('map');
    const showCity = (cityId) => {
        if (cityId) setActiveCityId(cityId);
        setView('city');
    };
    
    const handleOpenAlliance = () => playerAlliance ? openModal('alliance') : openModal('allianceCreation');
    const handleMessageAction = async (type, id) => {
        if (type === 'accept_invite') await acceptAllianceInvitation(id);
        else if (type === 'decline_invite') alert("Invitation declined.");
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
                    isUnderAttack={false}
                    incomingAttackCount={0}
                    handleOpenAlliance={handleOpenAlliance}
                    handleOpenProfile={handleOpenProfile}
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
                    claimQuestReward={claimQuestReward}
                    handleMessageAction={handleMessageAction}
                    panToCoords={panToCoords}
                    setPanToCoords={setPanToCoords}
                    handleGoToCityFromProfile={handleGoToCityFromProfile}
                />
            )}
            
            {/* Render shared modals here */}
            {modalState.isReportsPanelOpen && <ReportsView onClose={() => closeModal('reports')} />}
            {modalState.isMessagesPanelOpen && <MessagesView onClose={() => closeModal('messages')} onActionClick={handleMessageAction} initialRecipientId={modalState.actionDetails?.city?.ownerId} initialRecipientUsername={modalState.actionDetails?.city?.ownerUsername} />}
            {modalState.isAllianceModalOpen && <AllianceModal onClose={() => closeModal('alliance')} />}
            {modalState.isAllianceCreationOpen && <AllianceCreation onClose={() => closeModal('allianceCreation')} />}
            {modalState.isAllianceForumOpen && <AllianceForum onClose={() => closeModal('allianceForum')} />}
            {modalState.isQuestsModalOpen && <QuestsModal quests={quests} claimReward={claimQuestReward} onClose={() => closeModal('quests')} />}
            {modalState.isProfileModalOpen && <ProfileView onClose={() => closeModal('profile')} viewUserId={modalState.viewingProfileId} onGoToCity={handleGoToCityFromProfile} onInviteToAlliance={sendAllianceInvitation} onOpenAllianceProfile={handleOpenAllianceProfile} />}
            {modalState.isLeaderboardOpen && <Leaderboard onClose={() => closeModal('leaderboard')} onOpenProfile={handleOpenProfile} onOpenAllianceProfile={handleOpenAllianceProfile} />}
            {modalState.isAllianceProfileOpen && <AllianceProfile allianceId={modalState.viewingAllianceId} onClose={() => closeModal('allianceProfile')} onOpenProfile={handleOpenProfile} />}
            {modalState.isSettingsModalOpen && <SettingsModal onClose={() => closeModal('settings')} />}

            <div className="chat-container">
                <button onClick={() => setIsChatOpen(prev => !prev)} className="chat-toggle-button">
                    💬
                </button>
                <Chat isVisible={isChatOpen} onClose={() => setIsChatOpen(false)} />
            </div>

            <div className="absolute bottom-4 left-4 z-30 flex flex-col space-y-2">
                {view === 'map' && <button onClick={onBackToWorlds} className="text-sm text-blue-400 hover:text-blue-300 bg-gray-800 px-3 py-1 rounded shadow-lg">Back to Worlds</button>}
                <button onClick={() => signOut(auth)} className="text-sm text-red-400 hover:text-red-300 bg-gray-800 px-3 py-1 rounded shadow-lg">Logout</button>
            </div>
        </div>
    );
};

export default Game;