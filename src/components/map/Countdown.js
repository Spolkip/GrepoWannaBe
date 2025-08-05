import React, { useState, useEffect } from 'react';

// Countdown component displays a live countdown to an arrival time.
const Countdown = ({ arrivalTime }) => {
    const [timeLeft, setTimeLeft] = useState('');

    useEffect(() => {
        // #comment Safely converts Firestore Timestamps or JS Dates into a JS Date object
        const getSafeDate = (timestamp) => {
            if (!timestamp) return null;
            if (typeof timestamp.toDate === 'function') {
                return timestamp.toDate();
            }
            return new Date(timestamp);
        };

        const arrival = getSafeDate(arrivalTime);

        // #comment If the date is invalid, show 'Completed'
        if (!arrival || isNaN(arrival.getTime())) {
            setTimeLeft('Completed');
            return;
        }

        const calculateTimeLeft = () => {
            const now = new Date();
            const difference = arrival - now;

            if (difference > 0) {
                // #comment Use Math.ceil to ensure the timer doesn't show 00:00:00
                const totalSeconds = Math.ceil(difference / 1000);
                const hours = Math.floor(totalSeconds / 3600);
                const minutes = Math.floor((totalSeconds % 3600) / 60);
                const seconds = totalSeconds % 60;
                // Format time to HH:MM:SS
                setTimeLeft(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
            } else {
                setTimeLeft('Completed'); // Display 'Completed' when time is up
            }
        };

        calculateTimeLeft(); // Initial calculation
        const interval = setInterval(calculateTimeLeft, 1000); // Update every second

        // Cleanup function to clear the interval when the component unmounts
        return () => clearInterval(interval);
    }, [arrivalTime]); // Recalculate if arrivalTime changes

    return <span>{timeLeft}</span>;
};

export default Countdown;
