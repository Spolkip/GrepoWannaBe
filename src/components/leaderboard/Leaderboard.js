// src/components/leaderboard/Leaderboard.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '../../firebase/config';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { useGame } from '../../contexts/GameContext';
import { useCityState } from '../../hooks/useCityState';
import allianceResearch from '../../gameData/allianceResearch.json';
import './Leaderboard.css';

// #comment We'll cache the leaderboard data for 5 minutes to reduce reads.
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

const Leaderboard = ({ onClose, onOpenProfile, onOpenAllianceProfile }) => {
    const { worldId } = useGame();
    const [playerLeaderboard, setPlayerLeaderboard] = useState([]);
    const [allianceLeaderboard, setAllianceLeaderboard] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('players');
    const { calculateTotalPoints } = useCityState(worldId);

    // #comment Refs to store cached data and the last fetch time.
    const cacheRef = useRef({
        players: null,
        alliances: null,
        lastFetch: 0,
    });

    const fetchAllPlayerData = useCallback(async () => {
        if (!worldId) return new Map();

        const usersRef = collection(db, 'users');
        const usersSnapshot = await getDocs(usersRef);
        const playersData = new Map();

        for (const userDoc of usersSnapshot.docs) {
            const citiesColRef = collection(db, `users/${userDoc.id}/games`, worldId, 'cities');
            const citiesSnapshot = await getDocs(citiesColRef);

            if (!citiesSnapshot.empty) {
                let totalPoints = 0;
                let allianceInfo = null;
                for (const cityDoc of citiesSnapshot.docs) {
                    const cityData = cityDoc.data();
                    totalPoints += calculateTotalPoints(cityData);
                    if (!allianceInfo && cityData.alliance) {
                         allianceInfo = cityData.alliance;
                    }
                }
                
                if (!allianceInfo) {
                    const gameDocRef = doc(db, `users/${userDoc.id}/games`, worldId);
                    const gameSnap = await getDoc(gameDocRef);
                    if (gameSnap.exists()) {
                        allianceInfo = gameSnap.data().alliance;
                    }
                }

                playersData.set(userDoc.id, {
                    id: userDoc.id,
                    username: userDoc.data().username,
                    alliance: allianceInfo || 'No Alliance',
                    points: totalPoints,
                });
            }
        }
        return playersData;
    }, [worldId, calculateTotalPoints]);

    useEffect(() => {
        const fetchLeaderboards = async () => {
            setLoading(true);
            const now = Date.now();

            // #comment Check if the cache is still valid. If so, use cached data.
            if (cacheRef.current.lastFetch && (now - cacheRef.current.lastFetch < CACHE_DURATION)) {
                setPlayerLeaderboard(cacheRef.current.players || []);
                setAllianceLeaderboard(cacheRef.current.alliances || []);
                setLoading(false);
                return;
            }

            // #comment If cache is invalid, fetch new data.
            const allPlayerData = await fetchAllPlayerData();

            const playersList = Array.from(allPlayerData.values());
            playersList.sort((a, b) => b.points - a.points);
            setPlayerLeaderboard(playersList);

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
                setAllianceLeaderboard(alliancesData);

                // #comment Update the cache with the new data.
                cacheRef.current = {
                    players: playersList,
                    alliances: alliancesData,
                    lastFetch: now,
                };
            }
            
            setLoading(false);
        };

        fetchLeaderboards();
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
