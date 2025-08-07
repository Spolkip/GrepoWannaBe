// src/components/map/GodTownModal.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useGame } from '../../contexts/GameContext';
import { db } from '../../firebase/config';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import PuzzleRenderer from '../puzzles/PuzzleRenderer';

const GodTownModal = ({ townId, onClose }) => {
    const { currentUser } = useAuth();
    const { worldId } = useGame();
    const [townData, setTownData] = useState(null);
    const [playerProgress, setPlayerProgress] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTownData = async () => {
            if (!worldId || !townId || !currentUser) return;
            setLoading(true);
            try {
                const townRef = doc(db, 'worlds', worldId, 'godTowns', townId);
                const townSnap = await getDoc(townRef);
                if (townSnap.exists()) {
                    setTownData(townSnap.data());
                }

                const playerProgressRef = doc(db, 'worlds', worldId, 'godTowns', townId, 'playerProgress', currentUser.uid);
                const playerProgressSnap = await getDoc(playerProgressRef);
                if (playerProgressSnap.exists()) {
                    setPlayerProgress(playerProgressSnap.data());
                } else {
                    // Initialize player progress if it doesn't exist
                    const newProgress = { puzzleSolved: false, damageDealt: 0 };
                    await setDoc(playerProgressRef, newProgress);
                    setPlayerProgress(newProgress);
                }
            } catch (error) {
                console.error("Error fetching God Town data:", error);
            }
            setLoading(false);
        };
        fetchTownData();
    }, [worldId, townId, currentUser]);

    const handlePuzzleSuccess = async () => {
        if (!worldId || !townId || !currentUser) return;
        const playerProgressRef = doc(db, 'worlds', worldId, 'godTowns', townId, 'playerProgress', currentUser.uid);
        await updateDoc(playerProgressRef, { puzzleSolved: true });
        setPlayerProgress(prev => ({ ...prev, puzzleSolved: true }));
    };

    if (loading) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
                <div className="bg-gray-800 p-6 rounded-lg text-white">Loading...</div>
            </div>
        );
    }

    if (!townData) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
                <div className="bg-gray-800 p-6 rounded-lg text-white" onClick={e => e.stopPropagation()}>
                    <p>Could not load God Town information.</p>
                    <button onClick={onClose} className="btn btn-primary mt-4">Close</button>
                </div>
            </div>
        );
    }

    const renderContent = () => {
        if (townData.stage === 'ruins') {
            return (
                <div>
                    <h3 className="font-title text-2xl">Strange Ruins</h3>
                    <p>These ancient ruins hum with a mysterious power. It seems they are slowly reforming into something grander.</p>
                    <p>Time until transformation: {/* Countdown timer here */}</p>
                </div>
            );
        }

        if (townData.stage === 'city') {
            if (!playerProgress?.puzzleSolved) {
                return (
                    <div>
                        <h3 className="font-title text-2xl">The God Town's Challenge</h3>
                        <p>To prove your worthiness to attack, you must first solve a riddle posed by the town's ancient guardians.</p>
                        <PuzzleRenderer puzzleId={townData.puzzleId} onSolve={handlePuzzleSuccess} />
                    </div>
                );
            }
            return (
                <div>
                    <h3 className="font-title text-2xl">{townData.name}</h3>
                    <p>The city is vulnerable. Attack to earn war points and resources!</p>
                    <p>Health: {townData.health} / {townData.maxHealth}</p>
                    {/* Attack button and logic would go here */}
                    <button className="btn btn-danger mt-4">Attack</button>
                </div>
            );
        }

        return <p>The God Town has been conquered and has settled on a new island!</p>;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div className="other-city-modal-container" onClick={e => e.stopPropagation()}>
                <div className="other-city-modal-header">
                    <button onClick={onClose} className="close-btn">&times;</button>
                </div>
                <div className="other-city-modal-content">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
};

export default GodTownModal;
