import React, { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, query, getDocs } from 'firebase/firestore';
import { useGame } from '../../contexts/GameContext';
import { useCityState } from '../../hooks/useCityState';
import './Leaderboard.css';

const Leaderboard = ({ onClose, onOpenProfile }) => {
    const { worldId } = useGame();
    const [leaderboardData, setLeaderboardData] = useState([]);
    const [loading, setLoading] = useState(true);
    const { calculateTotalPoints } = useCityState(worldId);

    useEffect(() => {
        const fetchLeaderboard = async () => {
            if (!worldId) return;
            setLoading(true);

            const usersRef = collection(db, 'users');
            const usersSnapshot = await getDocs(usersRef);
            const playersData = [];

            for (const userDoc of usersSnapshot.docs) {
                const gamesRef = collection(userDoc.ref, 'games');
                const gameDocRef = doc(gamesRef, worldId);
                const gameSnap = await getDoc(gameDocRef);

                if (gameSnap.exists()) {
                    const gameData = gameSnap.data();
                    const totalPoints = calculateTotalPoints(gameData);
                    playersData.push({
                        id: userDoc.id,
                        username: userDoc.data().username,
                        alliance: gameData.alliance || 'No Alliance',
                        points: totalPoints,
                    });
                }
            }

            playersData.sort((a, b) => b.points - a.points);
            setLeaderboardData(playersData);
            setLoading(false);
        };

        fetchLeaderboard();
    }, [worldId, calculateTotalPoints]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div className="leaderboard-container w-full max-w-4xl h-5/6 flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-4 flex justify-between items-center">
                    <h2 className="font-title text-3xl">Leaderboard</h2>
                    <button onClick={onClose} className="text-3xl leading-none hover:text-red-700">&times;</button>
                </div>
                <div className="overflow-y-auto flex-grow p-4">
                    {loading ? (
                        <p>Loading leaderboard...</p>
                    ) : (
                        <table className="leaderboard-table">
                            <thead>
                                <tr>
                                    <th>Rank</th>
                                    <th>Player</th>
                                    <th>Alliance</th>
                                    <th>Points</th>
                                </tr>
                            </thead>
                            <tbody>
                                {leaderboardData.map((player, index) => (
                                    <tr key={player.id}>
                                        <td className="text-center">{index + 1}</td>
                                        <td>
                                            <button onClick={() => onOpenProfile(player.id)} className="player-name-btn">
                                                {player.username}
                                            </button>
                                        </td>
                                        <td>{player.alliance}</td>
                                        <td className="text-right">{player.points.toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Leaderboard;
