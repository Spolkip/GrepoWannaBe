import React, { useState, useEffect, createContext, useContext } from 'react';
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot, updateDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from '../firebase/config';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let unsubscribeProfile = () => {};
        let presenceInterval = null; // To hold the interval ID

        const unsubscribeAuth = onAuthStateChanged(auth, user => {
            setCurrentUser(user);
            unsubscribeProfile(); 
            clearInterval(presenceInterval); // Clear interval on auth state change

            if (user) {
                const userDocRef = doc(db, "users", user.uid);
                
                // #comment Update lastLogin timestamp on authentication and set initial presence
                updateDoc(userDocRef, { lastLogin: serverTimestamp(), lastSeen: serverTimestamp() }).catch(err => {
                    console.error("Failed to update last login time:", err);
                });

                // #comment Set up a periodic update for the 'lastSeen' timestamp to indicate presence
                presenceInterval = setInterval(() => {
                    updateDoc(userDocRef, { lastSeen: serverTimestamp() }).catch(err => {
                        console.error("Failed to update presence:", err);
                    });
                }, 60 * 1000); // Update every 60 seconds

                setLoading(true);
                unsubscribeProfile = onSnapshot(userDocRef, (docSnap) => {
                    if (docSnap.exists()) {
                        setUserProfile(docSnap.data());
                    } else {
                        setUserProfile(null);
                    }
                    setLoading(false);
                }, (error) => {
                    console.error("Error fetching user profile:", error);
                    setUserProfile(null);
                    setLoading(false);
                });
            } else {
                setUserProfile(null);
                setLoading(false);
            }
        });

        return () => {
            unsubscribeAuth();
            unsubscribeProfile();
            clearInterval(presenceInterval); // Cleanup interval on component unmount
        };
    }, []);

    const updateUserProfile = async (profileData) => {
        if (currentUser) {
            const userDocRef = doc(db, "users", currentUser.uid);
            await updateDoc(userDocRef, profileData);
        }
    };

    const value = { currentUser, userProfile, loading, updateUserProfile };

    return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
};
