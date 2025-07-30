// src/components/city/CityViewContent.js
import React, { useRef, useEffect, useCallback, useLayoutEffect, useState } from 'react';
import Cityscape from './Cityscape';
import SideInfoPanel from '../SideInfoPanel';

const CITYSCAPE_SIZE = 2000;

const CityViewContent = ({ cityGameState, handlePlotClick }) => {
    // Panning Logic (moved from CityView.js)
    const viewportRef = useRef(null);
    const cityContainerRef = useRef(null);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });

    const clampPan = useCallback((newPan) => {
        if (!viewportRef.current) return { x: 0, y: 0 };
        const { clientWidth, clientHeight } = viewportRef.current;
        const minX = clientWidth - CITYSCAPE_SIZE;
        const minY = clientHeight - CITYSCAPE_SIZE;
        return {
            x: Math.max(minX, Math.min(0, newPan.x)),
            y: Math.max(minY, Math.min(0, newPan.y)),
        };
    }, []);

    useLayoutEffect(() => {
        if (!viewportRef.current) return;
        const { clientWidth, clientHeight } = viewportRef.current;
        setPan(clampPan({ x: (clientWidth - CITYSCAPE_SIZE) / 2, y: (clientHeight - CITYSCAPE_SIZE) / 2 }));
    }, [clampPan]);

    useEffect(() => {
        const container = cityContainerRef.current;
        if (container) container.style.transform = `translate(${pan.x}px, ${pan.y}px)`;
    }, [pan]);

    const handleMouseDown = useCallback((e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        setStartPos({ x: e.clientX - pan.x, y: e.clientY - pan.y });
        setIsPanning(true);
    }, [pan]);

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isPanning) return;
            setPan(clampPan({ x: e.clientX - startPos.x, y: e.clientY - startPos.y }));
        };
        const handleMouseUp = () => setIsPanning(false);
        if (isPanning) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isPanning, startPos, clampPan]);

    return (
        <main className="flex-grow w-full h-full relative overflow-hidden cursor-grab" ref={viewportRef} onMouseDown={handleMouseDown}>
            <div ref={cityContainerRef} style={{ transformOrigin: '0 0' }}>
                <Cityscape buildings={cityGameState.buildings} onBuildingClick={handlePlotClick} />
            </div>
            <SideInfoPanel gameState={cityGameState} className="absolute top-1/2 right-4 transform -translate-y-1/2 z-20" />
        </main>
    );
};

export default CityViewContent;