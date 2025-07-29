import React, { useState, useEffect } from 'react';

// Countdown component displays a live countdown to an arrival time.
const Countdown = ({ arrivalTime }) => {
    const [timeLeft, setTimeLeft] = useState('');

    useEffect(() => {
        const calculateTimeLeft = () => {
            // Ensure arrivalTime is a valid Firestore Timestamp object with toDate() method
            if (!arrivalTime?.toDate) {
                setTimeLeft('Invalid Date');
                return;
            }
            const now = new Date();
            const arrival = arrivalTime.toDate();
            const difference = arrival - now;

            if (difference > 0) {
                // Calculate hours, minutes, and seconds remaining
                const hours = Math.floor((difference / (1000 * 60 * 60)));
                const minutes = Math.floor((difference / 1000 / 60) % 60);
                const seconds = Math.floor((difference / 1000) % 60);
                // Format time to HH:MM:SS
                setTimeLeft(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
            } else {
                setTimeLeft('Arrived'); // Display 'Arrived' when time is up
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
