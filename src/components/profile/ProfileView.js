import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useGame } from '../../contexts/GameContext';

const ProfileView = ({ onClose }) => {
    const { userProfile, updateUserProfile } = useAuth();
    const { gameState } = useGame();
    const [newDescription, setNewDescription] = useState(userProfile?.description || '');
    const [newImageUrl, setNewImageUrl] = useState(userProfile?.imageUrl || '');
    const [isEditing, setIsEditing] = useState(false);
    const [message, setMessage] = useState('');

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        const profileData = {
            description: newDescription,
            imageUrl: newImageUrl,
        };
        try {
            await updateUserProfile(profileData);
            setMessage('Profile updated successfully!');
            setIsEditing(false);
        } catch (error) {
            setMessage('Failed to update profile.');
            console.error(error);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg border-2 border-gray-600 text-white" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="font-title text-3xl">Player Profile</h2>
                    <button onClick={onClose} className="text-gray-400 text-3xl leading-none hover:text-white">&times;</button>
                </div>
                {message && <p className="text-center text-green-400 mb-4">{message}</p>}
                <div className="space-y-4">
                    <div className="flex items-center gap-4 mb-4">
                        <img src={userProfile?.imageUrl || 'https://placehold.co/100x100/2d3748/a0aec0?text=Avatar'} alt="Profile" className="w-24 h-24 rounded-full border-2 border-gray-500 object-cover" />
                        <div className="flex-grow space-y-2">
                            <div className="flex flex-col">
                                <label className="text-gray-400 mb-1 text-sm font-bold">Username</label>
                                <div className="bg-gray-700 p-3 rounded-lg min-h-[40px]">
                                    <span className="text-lg">{userProfile?.username}</span>
                                </div>
                            </div>
                            <div className="flex flex-col">
                                <label className="text-gray-400 mb-1 text-sm font-bold">City</label>
                                <div className="bg-gray-700 p-3 rounded-lg min-h-[40px]">
                                    <span className="text-lg">{gameState?.cityName}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col">
                        <label className="text-gray-400 mb-1 text-sm font-bold">Description</label>
                        <div className="bg-gray-700 p-3 rounded-lg min-h-[40px]">
                            <p className="text-gray-300 text-sm whitespace-pre-wrap">{userProfile?.description || 'No description set.'}</p>
                        </div>
                    </div>
                    
                    {isEditing ? (
                        <form onSubmit={handleUpdateProfile} className="space-y-4 bg-gray-700 p-4 rounded-lg">
                            <div className="flex flex-col">
                                <label className="text-gray-400 mb-1 text-sm font-bold">Description</label>
                                <textarea value={newDescription} onChange={(e) => setNewDescription(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px]" />
                            </div>
                            <div className="flex flex-col">
                                <label className="text-gray-400 mb-1 text-sm font-bold">Image URL</label>
                                <input type="text" value={newImageUrl} onChange={(e) => setNewImageUrl(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div className="flex justify-end gap-2 mt-4">
                                <button type="button" onClick={() => setIsEditing(false)} className="btn btn-secondary">Cancel</button>
                                <button type="submit" className="btn btn-confirm">Save</button>
                            </div>
                        </form>
                    ) : (
                        <button onClick={() => setIsEditing(true)} className="btn btn-primary w-full mt-4">Edit Profile</button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProfileView;
