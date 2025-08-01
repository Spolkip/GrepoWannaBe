// src/components/map/MapModals.js
import React from 'react';
import OtherCityModal from './OtherCityModal';
import FarmingVillageModal from './FarmingVillageModal';
import MovementModal from './MovementModal';
import MovementsPanel from './MovementsPanel';
import ReportsView from '../ReportsView';
import MessagesView from '../messaging/MessagesView';
import AllianceCreation from '../alliance/AllianceCreation';
import AllianceForum from '../alliance/AllianceForum'; // #comment Import AllianceForum

const MapModals = ({
    modalState,
    closeModal,
    gameState,
    playerCity,
    travelTimeInfo,
    handleSendMovement,
    handleCancelMovement,
    setMessage,
    goToCoordinates,
    handleActionClick,
    worldId,
    movements,
    combinedSlots,
    villages,
    handleRushMovement,
    userProfile,
    onCastSpell
}) => {
    return (
        <>
            {modalState.selectedCity && (
                <OtherCityModal
                    city={modalState.selectedCity}
                    playerCity={playerCity}
                    travelTimeInfo={travelTimeInfo}
                    onSendMovement={handleSendMovement}
                    onClose={() => closeModal('city')}
                    onAction={handleActionClick}
                    gameState={gameState}
                    onCastSpell={onCastSpell}
                    isVillageTarget={modalState.selectedCity?.isVillageTarget}
                />
            )}
            {modalState.selectedVillage && (
                <FarmingVillageModal
                    village={modalState.selectedVillage}
                    onClose={() => closeModal('village')}
                    onActionClick={handleActionClick}
                    playerCity={playerCity}
                    worldId={worldId}
                />
            )}
            {modalState.actionDetails && (
                <MovementModal
                    mode={modalState.actionDetails.mode}
                    targetCity={modalState.actionDetails.city}
                    onClose={() => closeModal('action')}
                    onSend={handleSendMovement}
                    playerCity={playerCity}
                    gameState={gameState}
                    travelTimeInfo={travelTimeInfo}
                    setMessage={setMessage}
                />
            )}
            {modalState.isMovementsPanelOpen && (
                <MovementsPanel
                    movements={movements}
                    onClose={() => closeModal('movements')}
                    combinedSlots={combinedSlots}
                    villages={villages}
                    goToCoordinates={goToCoordinates}
                    onCancel={handleCancelMovement}
                    onRush={handleRushMovement}
                    isAdmin={userProfile?.is_admin}
                />
            )}
            {modalState.isReportsPanelOpen && (
                <ReportsView onClose={() => closeModal('reports')} />
            )}
            {modalState.isMessagesPanelOpen && (
                <MessagesView 
                    onClose={() => closeModal('messages')} 
                    initialRecipientId={modalState.actionDetails?.city?.ownerId}
                    initialRecipientUsername={modalState.actionDetails?.city?.ownerUsername}
                />
            )}
            {modalState.isAllianceCreationOpen && (
                <AllianceCreation onClose={() => closeModal('allianceCreation')} />
            )}
            {/* #comment Render AllianceForum modal */}
            {modalState.isAllianceForumOpen && (
                <AllianceForum onClose={() => closeModal('allianceForum')} />
            )}
        </>
    );
};

export default MapModals;
