import React, { useState, useEffect, createContext, useContext } from 'react';
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from '../firebase/config';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let unsubscribeProfile = () => {};

        const unsubscribeAuth = onAuthStateChanged(auth, user => {
            setCurrentUser(user);
            unsubscribeProfile(); 

            if (user) {
                const userDocRef = doc(db, "users", user.uid);
                
                // #comment Update lastLogin timestamp on authentication using setDoc for robustness.
                // This will create the document or merge the field if the doc already exists, preventing race condition errors.
                setDoc(userDocRef, { lastLogin: serverTimestamp() }, { merge: true }).catch(err => {
                    console.error("Failed to update last login time:", err);
                });

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
        };
    }, []);

    const updateUserProfile = async (profileData) => {
        if (currentUser) {
            const userDocRef = doc(db, "users", currentUser.uid);
            await setDoc(userDocRef, profileData, { merge: true });
        }
    };

    const value = { currentUser, userProfile, loading, updateUserProfile };

    return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
};
