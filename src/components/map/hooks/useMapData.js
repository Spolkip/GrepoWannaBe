import { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { db } from '../../../firebase/config';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

export const useMapData = (worldId) => {
    const { currentUser } = useAuth();
    const [movements, setMovements] = useState([]);
    const [villages, setVillages] = useState({});

    useEffect(() => {
        if (!worldId || !currentUser?.uid) {
            setMovements([]);
            setVillages({});
            return;
        }

        // Listener for movements involving the current user
        const movementsQuery = query(
            collection(db, 'worlds', worldId, 'movements'),
            where('involvedParties', 'array-contains', currentUser.uid)
        );
        const unsubscribeMovements = onSnapshot(movementsQuery, (snapshot) => {
            const allMovements = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setMovements(allMovements.sort((a, b) => a.arrivalTime.toMillis() - b.arrivalTime.toMillis()));
        }, (error) => console.error("Error fetching movements:", error));

        // Listener for all villages in the world
        const villagesQuery = collection(db, 'worlds', worldId, 'villages');
        const unsubscribeVillages = onSnapshot(villagesQuery, (snapshot) => {
            const villagesData = {};
            snapshot.docs.forEach(doc => {
                villagesData[doc.id] = { id: doc.id, ...doc.data() };
            });
            setVillages(villagesData);
        }, (error) => console.error("Error fetching villages:", error));

        // Cleanup function
        return () => {
            unsubscribeMovements();
            unsubscribeVillages();
        };
    }, [worldId, currentUser?.uid]);

    return { movements, villages, setMovements };
};