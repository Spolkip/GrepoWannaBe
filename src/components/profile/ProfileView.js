import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useGame } from '../../contexts/GameContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useCityState } from '../../hooks/useCityState';
import unitConfig from '../../gameData/units.json';
import './ProfileView.css';

const ProfileView = ({ onClose, viewUserId, onGoToCity, onInviteToAlliance, onOpenAllianceProfile }) => {
    const { currentUser, userProfile: ownUserProfile, updateUserProfile } = useAuth();
    const { worldId, gameState: ownGameState, playerAlliance } = useGame();
    const { calculateTotalPoints } = useCityState(worldId);

    const [profileData, setProfileData] = useState(null);
    const [gameData, setGameData] = useState(null);
    const [points, setPoints] = useState(0);
    const [loading, setLoading] = useState(true);

    const [newDescription, setNewDescription] = useState('');
    const [newImageUrl, setNewImageUrl] = useState('');
    const [isEditing, setIsEditing] = useState(false);

    const isOwnProfile = !viewUserId || viewUserId === currentUser.uid;

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const userId = viewUserId || currentUser.uid;

            try {
                const userDocRef = doc(db, "users", userId);
                const userDocSnap = await getDoc(userDocRef);
                if (userDocSnap.exists()) {
                    const userData = userDocSnap.data();
                    setProfileData(userData);
                    setNewDescription(userData.description || '');
                    setNewImageUrl(userData.imageUrl || '');
                }

                const gameDocRef = doc(db, `users/${userId}/games`, worldId);
                const gameDocSnap = await getDoc(gameDocRef);
                if (gameDocSnap.exists()) {
                    const fetchedGameData = gameDocSnap.data();
                    setGameData(fetchedGameData);
                    setPoints(calculateTotalPoints(fetchedGameData));
                }
            } catch (error) {
                console.error("Error fetching user data:", error);
            }
            setLoading(false);
        };

        fetchData();
    }, [viewUserId, currentUser, worldId, calculateTotalPoints]);

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        if (!isOwnProfile) return;

        const profileUpdateData = {
            description: newDescription,
            imageUrl: newImageUrl,
        };
        try {
            await updateUserProfile(profileUpdateData);
            console.log('Profile updated successfully!');
            setIsEditing(false);
        } catch (error) {
            console.error("Failed to update profile.", error);
        }
    };

    if (loading) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
                <div className="text-white">Loading Profile...</div>
            </div>
        );
    }

    const displayProfile = isOwnProfile ? ownUserProfile : profileData;
    const displayGame = isOwnProfile ? ownGameState : gameData;
    const totalPoints = isOwnProfile ? calculateTotalPoints(ownGameState) : points;
    
    let totalAttack = 0;
    let totalDefense = 0;
    if (displayGame?.units) {
        for (const [unitId, count] of Object.entries(displayGame.units)) {
            const unit = unitConfig[unitId];
            if (unit) {
                totalAttack += (unit.attack || 0) * count;
                totalDefense += (unit.defense || 0) * count;
            }
        }
    }

    const getOcean = (x, y) => {
        if (x === undefined || y === undefined) return '?';
        return `${Math.floor(y / 10)}${Math.floor(x / 10)}`;
    };

    const isLeader = playerAlliance && playerAlliance.leader.uid === currentUser.uid;
    const canInvite = isLeader && !isOwnProfile;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div className="profile-papyrus" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="profile-close-button">&times;</button>
                <div className="profile-grid">
                    <div className="profile-left-column">
                        <div className="profile-box flex-grow">
                            <div className="profile-box-header">{displayProfile?.username}</div>
                            <div className="player-info-content">
                                {displayGame?.alliance ? (
                                    <button 
                                        onClick={() => onOpenAllianceProfile(displayGame.alliance)}
                                        className="text-blue-400 hover:underline font-bold"
                                    >
                                        [{displayGame.alliance}]
                                    </button>
                                ) : 'No Alliance'}
                            </div>
                            <div className="player-stats">
                                <div className="stat-item"><span>⚔️ Attack Points</span> <span>{totalAttack.toLocaleString()}</span></div>
                                <div className="stat-item"><span>🛡️ Defense Points</span> <span>{totalDefense.toLocaleString()}</span></div>
                                <div className="stat-item"><span>🏆 Total Points</span> <span>{totalPoints.toLocaleString()}</span></div>
                            </div>
                        </div>
                        <div className="profile-box">
                            <div className="profile-box-header flex justify-between items-center">
                                <span>Cities ({displayGame ? 1 : 0})</span>
                                <button className="text-xs bg-gray-500/50 px-2 py-0.5 rounded">BBCode</button>
                            </div>
                            <div className="cities-list">
                                {displayGame ? (
                                    <div className="city-item">
                                        <button onClick={() => onGoToCity(displayGame.x, displayGame.y)} className="city-name-btn">
                                            {displayGame.cityName}
                                        </button>
                                        <span>{totalPoints.toLocaleString()} points | Ocean {getOcean(displayGame.x, displayGame.y)}</span>
                                    </div>
                                ) : (
                                    <p className="text-sm text-center p-4">No cities in this world.</p>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="profile-right-column">
                        <div className="profile-box">
                            <div className="profile-box-header">Profile</div>
                            <div className="profile-description-box">
                                <img src={displayProfile?.imageUrl || 'https://i.imgur.com/7D72tLz.png'} alt="Profile Avatar" className="profile-avatar-large" />
                                <div className="profile-description-text">
                                    {isEditing ? (
                                        <form onSubmit={handleUpdateProfile} className="h-full flex flex-col">
                                            <textarea value={newDescription} onChange={(e) => setNewDescription(e.target.value)} className="w-full flex-grow bg-white/50 border border-yellow-800/50 p-1" />
                                            <input type="text" value={newImageUrl} onChange={(e) => setNewImageUrl(e.target.value)} placeholder="Image URL" className="w-full mt-2 bg-white/50 border border-yellow-800/50 p-1" />
                                            <div className="flex justify-end gap-2 mt-2">
                                                <button type="button" onClick={() => setIsEditing(false)} className="btn-cancel">Cancel</button>
                                                <button type="submit" className="btn-save">Save</button>
                                            </div>
                                        </form>
                                    ) : (
                                        <p>{displayProfile?.description || 'This player has not written a profile text.'}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                 {isOwnProfile && !isEditing && (
                    <button onClick={() => setIsEditing(true)} className="profile-edit-button">Edit Profile</button>
                )}
                {canInvite && (
                    <button onClick={() => onInviteToAlliance(viewUserId)} className="profile-edit-button">
                        Invite to Alliance
                    </button>
                )}
            </div>
        </div>
    );
};

export default ProfileView;