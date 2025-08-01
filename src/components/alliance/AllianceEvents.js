import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useGame } from '../../contexts/GameContext';

const AllianceEvents = () => {
    const { worldId, playerAlliance } = useGame();
    const [events, setEvents] = useState([]);

    useEffect(() => {
        if (!worldId || !playerAlliance) return;
        const eventsRef = collection(db, 'worlds', worldId, 'alliances', playerAlliance.id, 'events');
        const q = query(eventsRef, orderBy('timestamp', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setEvents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        return () => unsubscribe();
    }, [worldId, playerAlliance]);

    return (
        <div>
            <h3 className="text-xl font-bold mb-4">Alliance Events</h3>
            <ul className="space-y-2">
                {events.map(event => (
                    <li key={event.id} className="p-2 bg-gray-700 rounded">
                        <p className="text-sm">{event.text}</p>
                        <p className="text-xs text-gray-400 text-right">{event.timestamp?.toDate().toLocaleString()}</p>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default AllianceEvents;
