import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../../firebase/config';
import { collection, getDocs, collectionGroup, query, where } from 'firebase/firestore';
import { useGame } from '../../contexts/GameContext';
import allianceResearch from '../../gameData/allianceResearch.json';
import './Leaderboard.css';

// #comment Cache for leaderboard data to avoid frequent fetches.
let leaderboardCache = {
    playerLeaderboard: null,
    allianceLeaderboard: null,
    fightersLeaderboard: null,
    lastFetchTimestamp: 0,
};

// #comment Function to clear the leaderboard cache, exported for admin use.
export const clearLeaderboardCache = () => {
    leaderboardCache = {
        playerLeaderboard: null,
        allianceLeaderboard: null,
        fightersLeaderboard: null,
        lastFetchTimestamp: 0,
    };
};

const Leaderboard = ({ onClose, onOpenProfile, onOpenAllianceProfile }) => {
    const { worldId, worldState } = useGame();
    const [playerLeaderboard, setPlayerLeaderboard] = useState([]);
    const [allianceLeaderboard, setAllianceLeaderboard] = useState([]);
    const [fightersLeaderboard, setFightersLeaderboard] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('players');

    // #comment Fetches all player data for the current world using an efficient collection group query.
    const fetchAllPlayerData = useCallback(async () => {
        if (!worldId || !worldState) return new Map();

        // Step 1: Use a collection group query to get all players' game data for this world.
        const gamesGroupRef = collectionGroup(db, 'games');
        const q = query(gamesGroupRef, where('worldName', '==', worldState.name));
        const gamesSnapshot = await getDocs(q);

        const userIds = [];
        const gameDataMap = new Map();
        gamesSnapshot.forEach(gameDoc => {
            const userId = gameDoc.ref.parent.parent.id;
            userIds.push(userId);
            gameDataMap.set(userId, gameDoc.data());
        });

        if (userIds.length === 0) return new Map();

        // Step 2: Batch fetch user profiles for players found in this world.
        // Firestore 'in' query is limited to 30 items per query.
        const usersMap = new Map();
        const userDocsPromises = [];
        for (let i = 0; i < userIds.length; i += 30) {
            const chunk = userIds.slice(i, i + 30);
            const usersQuery = query(collection(db, 'users'), where('__name__', 'in', chunk));
            userDocsPromises.push(getDocs(usersQuery));
        }
        const userDocsSnapshots = await Promise.all(userDocsPromises);
        userDocsSnapshots.forEach(snapshot => {
            snapshot.forEach(userDoc => {
                usersMap.set(userDoc.id, userDoc.data());
            });
        });

        // Step 3: Combine game data and user data.
        const playersData = new Map();
        for (const [userId, gameData] of gameDataMap.entries()) {
            const userData = usersMap.get(userId);
            if (userData) {
                playersData.set(userId, {
                    id: userId,
                    username: userData.username,
                    alliance: gameData.alliance || 'No Alliance',
                    points: gameData.totalPoints || 0,
                    battlePoints: gameData.battlePoints || 0,
                });
            }
        }

        return playersData;
    }, [worldId, worldState]);

    useEffect(() => {
        const fetchLeaderboards = async () => {
            setLoading(true);
            const allPlayerData = await fetchAllPlayerData();

            // Generate player leaderboard
            const playersList = Array.from(allPlayerData.values());
            playersList.sort((a, b) => b.points - a.points);
            
            // Generate fighters leaderboard
            const fightersList = Array.from(allPlayerData.values());
            fightersList.sort((a, b) => b.battlePoints - a.battlePoints);

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
            setFightersLeaderboard(fightersList);
            setAllianceLeaderboard(alliancesData);

            // Update cache
            leaderboardCache = {
                playerLeaderboard: playersList,
                allianceLeaderboard: alliancesData,
                fightersLeaderboard: fightersList,
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
            setFightersLeaderboard(leaderboardCache.fightersLeaderboard);
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

    const renderFightersTable = () => (
        <table className="leaderboard-table">
            <thead>
                <tr>
                    <th className="text-center">Rank</th>
                    <th className="text-left">Player</th>
                    <th className="text-left">Alliance</th>
                    <th className="text-right">Battle Points</th>
                </tr>
            </thead>
            <tbody>
                {fightersLeaderboard.map((player, index) => (
                    <tr key={player.id}>
                        <td className="text-center">{index + 1}</td>
                        <td className="text-left">
                            <button onClick={() => onOpenProfile(player.id)} className="player-name-btn">
                                {player.username}
                            </button>
                        </td>
                        <td className="text-left">{player.alliance}</td>
                        <td className="text-right">{player.battlePoints.toLocaleString()}</td>
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

    const renderContent = () => {
        if (loading) {
            return <p>Loading leaderboard...</p>;
        }
        switch (activeTab) {
            case 'players':
                return renderPlayerTable();
            case 'alliances':
                return renderAllianceTable();
            case 'fighters':
                return renderFightersTable();
            default:
                return renderPlayerTable();
        }
    };

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
                    <button onClick={() => setActiveTab('fighters')} className={`py-2 px-4 font-bold ${activeTab === 'fighters' ? 'text-yellow-700 border-b-2 border-yellow-700' : 'text-yellow-800/70'}`}>Fighters</button>
                </div>
                <div className="overflow-y-auto flex-grow p-4">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
};

export default Leaderboard;
