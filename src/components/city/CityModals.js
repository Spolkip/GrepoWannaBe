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
  handleStartResearch,
  handleCancelResearch,
  handleWorshipGod,
  handleCheat,
  handleHealTroops,
  modalState,
  openModal,
  closeModal
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

  const maxPopulation = getFarmCapacity(cityGameState.buildings?.farm?.level);
  const usedPopulation = calculateUsedPopulation(cityGameState.buildings, cityGameState.units);
  const availablePopulation = maxPopulation - usedPopulation;

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
        />
      )}
      {isSenateViewOpen && (
        <SenateView
          buildings={cityGameState.buildings}
          resources={cityGameState.resources}
          onUpgrade={handleUpgrade}
          getUpgradeCost={getUpgradeCost}
          onClose={() => closeModal('isSenateViewOpen')}
          usedPopulation={usedPopulation}
          maxPopulation={maxPopulation}
          buildQueue={cityGameState.buildQueue}
          onCancelBuild={handleCancelBuild}
        />
      )}
      {isBarracksMenuOpen && (
        <BarracksMenu
          resources={cityGameState.resources}
          availablePopulation={availablePopulation}
          onTrain={handleTrainTroops}
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
              getHospitalCapacity={getHospitalCapacity}
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
