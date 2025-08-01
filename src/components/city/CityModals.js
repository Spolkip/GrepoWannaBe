// src/components/city/CityModals.js
import React from 'react';
import AdminCheatMenu from './AdminCheatMenu';
import BarracksMenu from './BarracksMenu';
import ShipyardMenu from './ShipyardMenu';
import BuildingDetailsModal from './BuildingDetailsModal';
import SenateView from './SenateView';
import TempleMenu from './TempleMenu';
import CaveMenu from './CaveMenu';
import HospitalMenu from './HospitalMenu';
import { AcademyMenu } from './AcademyMenu'; // Changed to named import

const CityModals = ({
  cityGameState,
  worldId,
  currentUser,
  userProfile,
  isInstantBuild,
  getUpgradeCost,
  getFarmCapacity,
  getWarehouseCapacity,
  getHospitalCapacity,
  getProductionRates,
  calculateUsedPopulation,
  saveGameState,
  handleUpgrade,
  handleCancelBuild,
  handleTrainTroops,
  handleCancelTrain,
  handleFireTroops,
  handleStartResearch,
  handleCancelResearch,
  handleWorshipGod,
  handleCheat,
  handleHealTroops,
  handleCancelHeal,
  availablePopulation,
  modalState,
  openModal,
  closeModal,
  setMessage,
  onAddWorker,
  onRemoveWorker
}) => {
  const {
    selectedBuildingId,
    isSenateViewOpen,
    isBarracksMenuOpen,
    isShipyardMenuOpen,
    isTempleMenuOpen,
    isCaveMenuOpen,
    isAcademyMenuOpen,
    isHospitalMenuOpen,
    isCheatMenuOpen
  } = modalState;

  if (!cityGameState) return null;

  return (
    <>
      {selectedBuildingId && (
        <BuildingDetailsModal
          buildingId={selectedBuildingId}
          buildingData={cityGameState.buildings[selectedBuildingId]}
          onClose={() => closeModal('selectedBuildingId')}
          getProductionRates={getProductionRates}
          getWarehouseCapacity={getWarehouseCapacity}
          getFarmCapacity={getFarmCapacity}
          onOpenBarracks={() => { closeModal('selectedBuildingId'); openModal('isBarracksMenuOpen'); }}
          onOpenShipyard={() => { closeModal('selectedBuildingId'); openModal('isShipyardMenuOpen'); }}
          onAddWorker={onAddWorker}
          onRemoveWorker={onRemoveWorker}
          availablePopulation={availablePopulation}
        />
      )}
      {isSenateViewOpen && (
        <SenateView
          buildings={cityGameState.buildings}
          resources={cityGameState.resources}
          onUpgrade={handleUpgrade}
          getUpgradeCost={getUpgradeCost}
          onClose={() => closeModal('isSenateViewOpen')}
          usedPopulation={calculateUsedPopulation(cityGameState.buildings, cityGameState.units)}
          maxPopulation={getFarmCapacity(cityGameState.buildings?.farm?.level)}
          buildQueue={cityGameState.buildQueue}
          onCancelBuild={handleCancelBuild}
        />
      )}
      {isBarracksMenuOpen && (
        <BarracksMenu
          resources={cityGameState.resources}
          availablePopulation={availablePopulation}
          onTrain={handleTrainTroops}
          onFire={handleFireTroops}
          onClose={() => closeModal('isBarracksMenuOpen')}
          buildings={cityGameState.buildings}
          unitQueue={cityGameState.unitQueue}
          onCancelTrain={handleCancelTrain}
          cityGameState={cityGameState}
        />
      )}
      {isShipyardMenuOpen && (
        <ShipyardMenu
          resources={cityGameState.resources}
          availablePopulation={availablePopulation}
          onTrain={handleTrainTroops}
          onClose={() => closeModal('isShipyardMenuOpen')}
          buildings={cityGameState.buildings}
          unitQueue={cityGameState.unitQueue}
          onCancelTrain={handleCancelTrain}
          cityGameState={cityGameState}
        />
      )}
      {isTempleMenuOpen && (
        <TempleMenu
          city={cityGameState}
          onWorship={handleWorshipGod}
          onClose={() => closeModal('isTempleMenuOpen')}
          favorData={cityGameState.worship || {}}
        />
      )}
      {isAcademyMenuOpen && (
        <AcademyMenu
          cityGameState={cityGameState}
          onResearch={handleStartResearch}
          onClose={() => closeModal('isAcademyMenuOpen')}
          researchQueue={cityGameState.researchQueue}
          onCancelResearch={handleCancelResearch}
        />
      )}
      {isCaveMenuOpen && (
        <CaveMenu
          cityGameState={cityGameState}
          onClose={() => closeModal('isCaveMenuOpen')}
          saveGameState={saveGameState}
          currentUser={currentUser}
          worldId={worldId}
        />
      )}
      {isHospitalMenuOpen && (
          <HospitalMenu
              cityGameState={cityGameState}
              onClose={() => closeModal('isHospitalMenuOpen')}
              onHeal={handleHealTroops}
              onCancelHeal={handleCancelHeal}
              getHospitalCapacity={getHospitalCapacity}
              availablePopulation={availablePopulation}
          />
      )}
      {isCheatMenuOpen && userProfile?.is_admin && (
        <AdminCheatMenu
          onCheat={handleCheat}
          onClose={() => closeModal('isCheatMenuOpen')}
          isInstantBuildActive={isInstantBuild}
        />
      )}
    </>
  );
};

export default CityModals;
