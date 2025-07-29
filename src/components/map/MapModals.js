import React from 'react';
import ReportsView from '../ReportsView';
import MovementModal from './MovementModal';
import MovementsPanel from './MovementsPanel';
import OtherCityModal from './OtherCityModal';
import FarmingVillageModal from './FarmingVillageModal';

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
    userProfile
}) => {
    return (
        <>
            {modalState.selectedCity && (
                <OtherCityModal
                    city={modalState.selectedCity}
                    onClose={() => closeModal('city')}
                    onAction={handleActionClick}
                    onGoTo={goToCoordinates}
                    isVillageTarget={modalState.selectedCity.isVillageTarget}
                />
            )}
            {modalState.selectedVillage && (
                <FarmingVillageModal
                    village={modalState.selectedVillage}
                    onClose={() => closeModal('village')}
                    worldId={worldId}
                    cityId={playerCity.id}
                />
            )}
            {modalState.actionDetails && (
                <MovementModal
                    mode={modalState.actionDetails.mode}
                    targetCity={modalState.actionDetails.city}
                    playerCity={playerCity}
                    playerUnits={gameState?.units}
                    playerResources={gameState?.resources}
                    travelTimeInfo={travelTimeInfo}
                    onSend={handleSendMovement}
                    onClose={() => closeModal('action')}
                    setMessage={setMessage}
                />
            )}
            {modalState.isMovementsPanelOpen && (
                <MovementsPanel
                    movements={movements}
                    onClose={() => closeModal('movements')}
                    citySlots={{...combinedSlots, ...villages}}
                    onRush={handleRushMovement}
                    isAdmin={userProfile?.is_admin}
                />
            )}
            {modalState.isReportsPanelOpen && (
                <ReportsView onClose={() => closeModal('reports')} />
            )}
        </>
    );
};

export default MapModals;