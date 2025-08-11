import React, { useState, useEffect } from 'react';
import { doc, onSnapshot } from "firebase/firestore";
import { db } from '../firebase/config';
import { useAuth } from './AuthContext';
import { useGame } from './GameContext';
import AllianceContext from './AllianceContext';
import { useAllianceActions } from '../hooks/actions/useAllianceResearchs';
import { useAllianceBankActions } from '../hooks/actions/useAllianceBank';
import { useAllianceDiplomacyActions } from '../hooks/actions/useAllianceDiplomacy';
import { useAllianceManagementActions } from '../hooks/actions/useAllianceManagement';
import { useAllianceResearchActions } from '../hooks/actions/useAllianceActions';

export const AllianceProvider = ({ children }) => {
    const { currentUser } = useAuth();
    const { worldId, playerGameData } = useGame();
    const [playerAlliance, setPlayerAlliance] = useState(null);

    useEffect(() => {
        if (!worldId || !playerGameData || !playerGameData.alliance) {
            setPlayerAlliance(null);
            return;
        }

        const allianceDocRef = doc(db, 'worlds', worldId, 'alliances', playerGameData.alliance);
        const unsubscribe = onSnapshot(allianceDocRef, (allianceSnap) => {
            if (allianceSnap.exists()) {
                setPlayerAlliance({ id: allianceSnap.id, ...allianceSnap.data() });
            } else {
                setPlayerAlliance(null);
            }
        });

        return () => unsubscribe();
    }, [worldId, playerGameData]);

    const allianceActions = useAllianceActions(playerAlliance);
    const bankActions = useAllianceBankActions(playerAlliance);
    const diplomacyActions = useAllianceDiplomacyActions(playerAlliance);
    const managementActions = useAllianceManagementActions(playerAlliance);
    const researchActions = useAllianceResearchActions(playerAlliance);

    const value = {
        playerAlliance,
        ...allianceActions,
        ...bankActions,
        ...diplomacyActions,
        ...managementActions,
        ...researchActions,
    };

    return (
        <AllianceContext.Provider value={value}>
            {children}
        </AllianceContext.Provider>
    );
};
