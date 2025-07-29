import React from 'react';

// UI Components
import OtherCityModal from './OtherCityModal';
import FarmingVillageModal from './FarmingVillageModal';
import MovementModal from './MovementModal';
import MovementsPanel from './MovementsPanel';
import ReportsView from '../ReportsView';
import Modal from '../shared/Modal';

export const MapOverlays = ({
    // General State
    message, setMessage,
    // Interaction State & Handlers
    selectedCity, selectedVillage, actionDetails, travelTimeInfo, closeAllModals, handleActionClick, goToCoordinates,
    // Movement State & Handlers
    isMovementsPanelOpen, setIsMovementsPanelOpen, movements,
    // Reports State & Handlers
    isReportsPanelOpen, setIsReportsPanelOpen,
    // Game/Player State
    playerCity, gameState,
    // Actions
    handleSendMovement, handleRushMovement,
    // Data
    visibleSlots, villages,
    // Auth
    isAdmin
}) => {
    return (
        <>
            <Modal message={message} onClose={() => setMessage('')} />

            {selectedCity && (
                <OtherCityModal
                    city={selectedCity}
                    playerCity={playerCity}
                    onClose={closeAllModals}
                    onAction={handleActionClick}
                    onGoTo={goToCoordinates}
                />
            )}
            {selectedVillage && (
                <FarmingVillageModal
                    village={selectedVillage}
                    onClose={closeAllModals}
                    worldId={playerCity.worldId}
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
                    onSend={async (details) => {
                        const success = await handleSendMovement(details);
                        if (success) {
                            closeAllModals();
                        }
                    }}
                    onClose={closeAllModals}
                    setMessage={setMessage}
                />
            )}
            {isMovementsPanelOpen && (
                <MovementsPanel
                    movements={movements}
                    onClose={() => setIsMovementsPanelOpen(false)}
                    citySlots={{...visibleSlots, ...villages}}
                    onRush={handleRushMovement}
                    isAdmin={isAdmin}
                />
            )}
            {isReportsPanelOpen && (
                <ReportsView onClose={() => setIsReportsPanelOpen(false)} />
            )}
        </>
    );
};