import React, { useState, useEffect, createContext, useContext } from 'react';
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from '../firebase/config';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, user => {
            setCurrentUser(user);
            // Always start in a loading state when auth changes
            setLoading(true);

            if (user) {
                // Only set up the snapshot listener if a user is logged in
                const userDocRef = doc(db, "users", user.uid);
                const unsubscribeProfile = onSnapshot(userDocRef, (docSnap) => {
                    if (docSnap.exists()) {
                        // We have the profile, set it and stop loading
                        setUserProfile(docSnap.data());
                        setLoading(false);
                    } else {
                        // The user is authenticated, but the profile document doesn't exist yet.
                        // This happens during signup. We'll keep loading and wait for the
                        // document to be created, which will trigger this listener again.
                        setUserProfile(null);
                    }
                }, (error) => {
                    console.error("Error fetching user profile:", error);
                    setUserProfile(null);
                    setLoading(false); // Stop loading on error to prevent getting stuck
                });

                return () => unsubscribeProfile(); // Clean up the profile listener when auth state changes
            } else {
                // User is signed out, clear profile and stop loading
                setUserProfile(null);
                setLoading(false);
            }
        });

        return () => unsubscribeAuth(); // Clean up the auth listener when component unmounts
    }, []);

    const value = { currentUser, userProfile, loading };

    // Render children only when not in the initial loading state
    return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
};
