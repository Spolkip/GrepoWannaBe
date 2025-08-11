// src/components/map/MapModals.js
import React from 'react';
import OtherCityModal from './OtherCityModal';
import OwnInactiveCityModal from './OwnInactiveCityModal';
import OwnActiveCityModal from './OwnActiveCityModal'; // Import new modal
import FarmingVillageModal from './FarmingVillageModal';
import MovementModal from './MovementModal';
import MovementsPanel from './MovementsPanel';

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
    onCastSpell,
    onActionClick,
    marketCapacity,
    onEnterCity,
    onSwitchCity
}) => {
    return (
        <>
            {modalState.selectedCity && !modalState.isOwnInactiveCityModalOpen && !modalState.isOwnActiveCityModalOpen && (
                <OtherCityModal
                    city={modalState.selectedCity}
                    playerCity={playerCity}
                    travelTimeInfo={travelTimeInfo}
                    onSendMovement={handleSendMovement}
                    onClose={() => closeModal('city')}
                    onAction={handleActionClick}
                    onGoTo={goToCoordinates}
                    gameState={gameState}
                    onCastSpell={onCastSpell}
                    isVillageTarget={modalState.selectedCity?.isVillageTarget}
                />
            )}
            {modalState.isOwnInactiveCityModalOpen && modalState.selectedCity && (
                <OwnInactiveCityModal
                    city={modalState.selectedCity}
                    onClose={() => closeModal('ownInactiveCity')}
                    onAction={handleActionClick}
                    onGoTo={goToCoordinates}
                    onEnterCity={onEnterCity}
                    onSelectCity={onSwitchCity}
                />
            )}
            {/* Add the new modal render logic */}
            {modalState.isOwnActiveCityModalOpen && modalState.selectedCity && (
                <OwnActiveCityModal
                    city={modalState.selectedCity}
                    onClose={() => closeModal('ownActiveCity')}
                    onGoTo={goToCoordinates}
                    onEnterCity={onEnterCity}
                />
            )}
            {modalState.selectedVillage && (
                <FarmingVillageModal
                    village={modalState.selectedVillage}
                    onClose={() => closeModal('village')}
                    onActionClick={handleActionClick}
                    playerCity={playerCity}
                    worldId={worldId}
                    marketCapacity={marketCapacity}
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
        </>
    );
};

export default MapModals;
