import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useGame } from '../../contexts/GameContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import './ProfileView.css';

const ProfileView = ({ onClose, viewUserId }) => {
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

    // #comment fetch profile and game data for the user being viewed
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

    // #comment handle updating the user's own profile
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
                    <h2 className="font-title text-3xl">Player Profile</h2>
                    <button onClick={onClose} className="close-button">&times;</button>
                </div>
                {message && <p className="message">{message}</p>}
                <div className="profile-content">
                    <div className="profile-main-info">
                        <img src={displayProfile?.imageUrl || 'https://placehold.co/100x100/2d3748/a0aec0?text=Avatar'} alt="Profile" className="profile-avatar" />
                        <div className="profile-details">
                            <div className="profile-field">
                                <label>Username</label>
                                <div className="display-field"><span>{displayProfile?.username}</span></div>
                            </div>
                            <div className="profile-field">
                                <label>City</label>
                                <div className="display-field"><span>{displayGame?.cityName}</span></div>
                            </div>
                        </div>
                    </div>

                    <div className="profile-field">
                        <label>Description</label>
                        <div className="display-field description-text">
                            <p>{displayProfile?.description || 'No description set.'}</p>
                        </div>
                    </div>
                    
                    {isOwnProfile && (
                        isEditing ? (
                            <form onSubmit={handleUpdateProfile} className="edit-form">
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
                            <button onClick={() => setIsEditing(true)} className="btn btn-primary w-full mt-4">Edit Profile</button>
                        )
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProfileView;
