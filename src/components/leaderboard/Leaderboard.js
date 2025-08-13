import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../../firebase/config';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { useGame } from '../../contexts/GameContext';
import allianceResearch from '../../gameData/allianceResearch.json';
import './Leaderboard.css';

// #comment Cache for leaderboard data to avoid frequent fetches.
let leaderboardCache = {
    playerLeaderboard: null,
    allianceLeaderboard: null,
    lastFetchTimestamp: 0,
};

// #comment Function to clear the leaderboard cache, exported for admin use.
export const clearLeaderboardCache = () => {
    leaderboardCache = {
        playerLeaderboard: null,
        allianceLeaderboard: null,
        lastFetchTimestamp: 0,
    };
};

const Leaderboard = ({ onClose, onOpenProfile, onOpenAllianceProfile }) => {
    const { worldId } = useGame();
    const [playerLeaderboard, setPlayerLeaderboard] = useState([]);
    const [allianceLeaderboard, setAllianceLeaderboard] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('players');

    // #comment Fetches pre-calculated total points for each player, reducing database reads significantly.
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
                playersData.set(userDoc.id, {
                    id: userDoc.id,
                    username: userDoc.data().username,
                    alliance: gameData.alliance || 'No Alliance',
                    points: gameData.totalPoints || 0, // Read the pre-calculated points
                });
            }
        }
        return playersData;
    }, [worldId]);

    useEffect(() => {
        const fetchLeaderboards = async () => {
            setLoading(true);
            const allPlayerData = await fetchAllPlayerData();

            // Generate player leaderboard
            const playersList = Array.from(allPlayerData.values());
            playersList.sort((a, b) => b.points - a.points);
            
            // Generate alliance leaderboard
            const alliancesData = [];
            if (worldId) {
                const alliancesRef = collection(db, 'worlds', worldId, 'alliances');
                const alliancesSnapshot = await getDocs(alliancesRef);

                for (const allianceDoc of alliancesSnapshot.docs) {
                    const alliance = allianceDoc.data();
                    let totalPoints = 0;
                    alliance.members.forEach(member => {
                        if (allPlayerData.has(member.uid)) {
                            totalPoints += allPlayerData.get(member.uid).points;
                        }
                    });

                    const baseMax = 20;
                    const researchLevel = alliance.research?.expanded_charter?.level || 0;
                    const researchBonus = allianceResearch.expanded_charter.effect.value * researchLevel;
                    const maxMembers = baseMax + researchBonus;

                    alliancesData.push({
                        id: allianceDoc.id,
                        name: alliance.name,
                        tag: alliance.tag,
                        points: totalPoints,
                        memberCount: alliance.members.length,
                        maxMembers: maxMembers,
                    });
                }
                alliancesData.sort((a, b) => b.points - a.points);
            }
            
            // Update component state
            setPlayerLeaderboard(playersList);
            setAllianceLeaderboard(alliancesData);

            // Update cache
            leaderboardCache = {
                playerLeaderboard: playersList,
                allianceLeaderboard: alliancesData,
                lastFetchTimestamp: Date.now(),
            };
            
            setLoading(false);
        };

        const now = Date.now();
        const twentyMinutes = 20 * 60 * 1000;

        // #comment Check if cached data is recent enough.
        if (now - leaderboardCache.lastFetchTimestamp > twentyMinutes || !leaderboardCache.playerLeaderboard) {
            fetchLeaderboards();
        } else {
            // #comment Use cached data.
            setPlayerLeaderboard(leaderboardCache.playerLeaderboard);
            setAllianceLeaderboard(leaderboardCache.allianceLeaderboard);
            setLoading(false);
        }
    }, [worldId, fetchAllPlayerData]);

    const renderPlayerTable = () => (
        <table className="leaderboard-table">
            <thead>
                <tr>
                    <th className="text-center">Rank</th>
                    <th className="text-left">Player</th>
                    <th className="text-left">Alliance</th>
                    <th className="text-right">Points</th>
                </tr>
            </thead>
            <tbody>
                {playerLeaderboard.map((player, index) => (
                    <tr key={player.id}>
                        <td className="text-center">{index + 1}</td>
                        <td className="text-left">
                            <button onClick={() => onOpenProfile(player.id)} className="player-name-btn">
                                {player.username}
                            </button>
                        </td>
                        <td className="text-left">{player.alliance}</td>
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
                    <th className="text-center">Rank</th>
                    <th className="text-left">Alliance</th>
                    <th className="text-left">Tag</th>
                    <th className="text-center">Members</th>
                    <th className="text-right">Points</th>
                </tr>
            </thead>
            <tbody>
                {allianceLeaderboard.map((alliance, index) => (
                    <tr key={alliance.id}>
                        <td className="text-center">{index + 1}</td>
                        <td className="text-left">
                            <button onClick={() => onOpenAllianceProfile(alliance.id)} className="player-name-btn">
                                {alliance.name}
                            </button>
                        </td>
                        <td className="text-left">{alliance.tag}</td>
                        <td className="text-center">{alliance.memberCount}/{alliance.maxMembers}</td>
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
