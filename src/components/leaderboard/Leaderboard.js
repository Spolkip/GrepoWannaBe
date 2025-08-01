import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../../firebase/config';
import { collection, query, getDocs, doc, getDoc } from 'firebase/firestore';
import { useGame } from '../../contexts/GameContext';
import { useCityState } from '../../hooks/useCityState';
import './Leaderboard.css';

const Leaderboard = ({ onClose, onOpenProfile }) => {
    const { worldId } = useGame();
    const [playerLeaderboard, setPlayerLeaderboard] = useState([]);
    const [allianceLeaderboard, setAllianceLeaderboard] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('players');
    const { calculateTotalPoints } = useCityState(worldId);

    const fetchAllPlayerData = useCallback(async () => {
        if (!worldId) return new Map();

        const usersRef = collection(db, 'users');
        const usersSnapshot = await getDocs(usersRef);
        const playersData = new Map();

        for (const userDoc of usersSnapshot.docs) {
            const gameDocRef = doc(db, `users/${userDoc.id}/games`, worldId);
            const gameSnap = await getDoc(gameDocRef);

            if (gameSnap.exists()) {
                const gameData = gameSnap.data();
                const totalPoints = calculateTotalPoints(gameData);
                playersData.set(userDoc.id, {
                    id: userDoc.id,
                    username: userDoc.data().username,
                    alliance: gameData.alliance || 'No Alliance',
                    points: totalPoints,
                });
            }
        }
        return playersData;
    }, [worldId, calculateTotalPoints]);

    useEffect(() => {
        const fetchLeaderboards = async () => {
            setLoading(true);
            const allPlayerData = await fetchAllPlayerData();

            // #comment Generate player leaderboard
            const playersList = Array.from(allPlayerData.values());
            playersList.sort((a, b) => b.points - a.points);
            setPlayerLeaderboard(playersList);

            // #comment Generate alliance leaderboard
            if (worldId) {
                const alliancesRef = collection(db, 'worlds', worldId, 'alliances');
                const alliancesSnapshot = await getDocs(alliancesRef);
                const alliancesData = [];

                for (const allianceDoc of alliancesSnapshot.docs) {
                    const alliance = allianceDoc.data();
                    let totalPoints = 0;
                    alliance.members.forEach(member => {
                        if (allPlayerData.has(member.uid)) {
                            totalPoints += allPlayerData.get(member.uid).points;
                        }
                    });
                    alliancesData.push({
                        id: allianceDoc.id,
                        name: alliance.name,
                        tag: alliance.tag,
                        points: totalPoints,
                        memberCount: alliance.members.length,
                    });
                }
                alliancesData.sort((a, b) => b.points - a.points);
                setAllianceLeaderboard(alliancesData);
            }
            
            setLoading(false);
        };

        fetchLeaderboards();
    }, [worldId, fetchAllPlayerData]);

    const renderPlayerTable = () => (
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
                {playerLeaderboard.map((player, index) => (
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
    );

    const renderAllianceTable = () => (
        <table className="leaderboard-table">
            <thead>
                <tr>
                    <th>Rank</th>
                    <th>Alliance</th>
                    <th>Tag</th>
                    <th>Members</th>
                    <th>Points</th>
                </tr>
            </thead>
            <tbody>
                {allianceLeaderboard.map((alliance, index) => (
                    <tr key={alliance.id}>
                        <td className="text-center">{index + 1}</td>
                        <td>{alliance.name}</td>
                        <td>{alliance.tag}</td>
                        <td className="text-center">{alliance.memberCount}</td>
                        <td className="text-right">{alliance.points.toLocaleString()}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div className="leaderboard-container w-full max-w-4xl h-5/6 flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-4 flex justify-between items-center">
                    <h2 className="font-title text-3xl">Leaderboard</h2>
                    <button onClick={onClose} className="text-3xl leading-none hover:text-red-700">&times;</button>
                </div>
                <div className="flex border-b-2 border-yellow-800/50 px-4">
                    <button onClick={() => setActiveTab('players')} className={`py-2 px-4 font-bold ${activeTab === 'players' ? 'text-yellow-700 border-b-2 border-yellow-700' : 'text-yellow-800/70'}`}>Players</button>
                    <button onClick={() => setActiveTab('alliances')} className={`py-2 px-4 font-bold ${activeTab === 'alliances' ? 'text-yellow-700 border-b-2 border-yellow-700' : 'text-yellow-800/70'}`}>Alliances</button>
                </div>
                <div className="overflow-y-auto flex-grow p-4">
                    {loading ? (
                        <p>Loading leaderboard...</p>
                    ) : (
                        activeTab === 'players' ? renderPlayerTable() : renderAllianceTable()
                    )}
                </div>
            </div>
        </div>
    );
};

export default Leaderboard;
