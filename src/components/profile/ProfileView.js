import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useGame } from '../../contexts/GameContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import './ProfileView.css';

const ProfileView = ({ onClose, viewUserId, onGoToCity }) => {
    const { currentUser, userProfile: ownUserProfile, updateUserProfile } = useAuth();
    const { worldId, gameState: ownGameState } = useGame();
    
    const [profileData, setProfileData] = useState(null);
    const [gameData, setGameData] = useState(null);
    const [loading, setLoading] = useState(true);

    const [newDescription, setNewDescription] = useState('');
    const [newImageUrl, setNewImageUrl] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [message, setMessage] = useState('');

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
                    setGameData(gameDocSnap.data());
                }
            } catch (error) {
                console.error("Error fetching user data:", error);
                setMessage("Could not load profile data.");
            }
            setLoading(false);
        };

        fetchData();
    }, [viewUserId, currentUser, worldId]);

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        if (!isOwnProfile) return;

        const profileUpdateData = {
            description: newDescription,
            imageUrl: newImageUrl,
        };
        try {
            await updateUserProfile(profileUpdateData);
            setMessage('Profile updated successfully!');
            setIsEditing(false);
        } catch (error) {
            setMessage('Failed to update profile.');
            console.error(error);
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

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div className={`profile-view-container ${!isOwnProfile ? 'read-only' : ''}`} onClick={e => e.stopPropagation()}>
                <div className="profile-header">
                    <h2 className="font-title text-3xl">Profile of {displayProfile?.username}</h2>
                    <button onClick={onClose} className="close-button">&times;</button>
                </div>
                {message && <p className="message">{message}</p>}
                
                <div className="profile-content">
                    <div className="flex justify-center mb-4">
                        <img src={displayProfile?.imageUrl || 'https://placehold.co/150x150/1e3a8a/f0e68c?text=Avatar'} alt="Profile" className="w-36 h-36 rounded-full border-4 border-yellow-500 object-cover" />
                    </div>

                    <div className="profile-field">
                        <div className="display-field description-text text-center italic">
                            <p>{displayProfile?.description || 'No description provided.'}</p>
                        </div>
                    </div>
                    
                    <div className="mt-6">
                        <h3 className="font-title text-2xl mb-2 text-yellow-400">Cities</h3>
                        <div className="bg-gray-700 p-3 rounded-lg">
                            {displayGame ? (
                                <div className="flex justify-between items-center">
                                    <span className="font-bold">{displayGame.cityName}</span>
                                    {!isOwnProfile && displayGame.x !== undefined && (
                                        <button 
                                            onClick={() => onGoToCity(displayGame.x, displayGame.y)}
                                            className="btn btn-primary text-xs px-3 py-1"
                                        >
                                            Go To City
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <p className="text-gray-400">No city in this world.</p>
                            )}
                        </div>
                    </div>

                    {isOwnProfile && (
                        isEditing ? (
                            <form onSubmit={handleUpdateProfile} className="edit-form mt-4">
                                <div className="profile-field">
                                    <label>Description</label>
                                    <textarea value={newDescription} onChange={(e) => setNewDescription(e.target.value)} className="description-input" />
                                </div>
                                <div className="profile-field">
                                    <label>Image URL</label>
                                    <input type="text" value={newImageUrl} onChange={(e) => setNewImageUrl(e.target.value)} className="username-input" />
                                </div>
                                <div className="form-actions">
                                    <button type="button" onClick={() => setIsEditing(false)} className="btn btn-secondary">Cancel</button>
                                    <button type="submit" className="btn btn-confirm">Save</button>
                                </div>
                            </form>
                        ) : (
                            <button onClick={() => setIsEditing(true)} className="btn btn-primary w-full mt-6">Edit Profile</button>
                        )
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProfileView;
