// src/components/map/MapModals.js
import React from 'react';
import OtherCityModal from './OtherCityModal';
import FarmingVillageModal from './FarmingVillageModal';
import MovementModal from './MovementModal';
import MovementsPanel from './MovementsPanel';
import ReportsView from '../ReportsView';
import MessagesView from '../messaging/MessagesView';

const MapModals = ({
    modalState,
    closeModal,
    gameState,
    playerCity,
    travelTimeInfo,
    handleSendMovement,
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
                    onActionClick={handleActionClick}
                    gameState={gameState}
                    onCastSpell={onCastSpell}
                />
            )}
            {modalState.selectedVillage && (
                <FarmingVillageModal
                    village={modalState.selectedVillage}
                    onClose={() => closeModal('village')}
                    onActionClick={handleActionClick}
                    playerCity={playerCity}
                />
            )}
            {modalState.actionDetails && (
                <MovementModal
                    details={modalState.actionDetails}
                    onClose={() => closeModal('action')}
                    onSendMovement={handleSendMovement}
                    playerCity={playerCity}
                    gameState={gameState}
                />
            )}
            {modalState.isMovementsPanelOpen && (
                <MovementsPanel
                    movements={movements}
                    onClose={() => closeModal('movements')}
                    combinedSlots={combinedSlots}
                    villages={villages}
                    goToCoordinates={goToCoordinates}
                    handleRushMovement={handleRushMovement}
                    isAdmin={userProfile?.is_admin}
                />
            )}
            {modalState.isReportsPanelOpen && (
                <ReportsView onClose={() => closeModal('reports')} />
            )}
            {modalState.isMessagesPanelOpen && (
                <MessagesView onClose={() => closeModal('messages')} />
            )}
        </>
    );
};

export default MapModals;
