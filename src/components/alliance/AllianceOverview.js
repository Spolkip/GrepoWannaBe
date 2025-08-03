import React, { useState, useEffect } from 'react';
import { useGame } from '../../contexts/GameContext';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';

const AllianceOverview = () => {
    const { worldId, playerAlliance } = useGame();
    const [events, setEvents] = useState([]);

    // #comment Fetch alliance events in real-time
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <h3 className="text-xl font-bold mb-2">Alliance Description</h3>
                <p className="text-gray-400 bg-gray-700/50 p-3 rounded-lg min-h-[100px]">
                    {playerAlliance.description || 'No description provided.'}
                </p>
            </div>
            <div>
                <h3 className="text-xl font-bold mb-2">Recent Events</h3>
                <ul className="space-y-2 max-h-64 overflow-y-auto bg-gray-700/50 p-3 rounded-lg">
                    {events.length > 0 ? events.map(event => (
                        <li key={event.id} className="p-2 bg-gray-800/60 rounded">
                            <p className="text-sm">{event.text}</p>
                            <p className="text-xs text-gray-400 text-right">{event.timestamp?.toDate().toLocaleString()}</p>
                        </li>
                    )) : (
                        <li className="text-gray-500 italic text-center p-4">No recent events.</li>
                    )}
                </ul>
            </div>
        </div>
    );
};

export default AllianceOverview;
