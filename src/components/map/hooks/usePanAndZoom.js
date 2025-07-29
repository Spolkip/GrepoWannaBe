import { useState, useCallback, useEffect } from 'react';

const TILE_SIZE = 32;
const OVERSCROLL_AMOUNT = 100;

export const usePanAndZoom = (viewportRef, mapContainerRef, worldState) => {
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(0.5);
    const [minZoom, setMinZoom] = useState(0.5);
    const [isPanning, setIsPanning] = useState(false);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });
    const [borderOpacity, setBorderOpacity] = useState({ top: 0, bottom: 0, left: 0, right: 0 });

    const clampPan = useCallback((newPan, currentZoom) => {
        if (!viewportRef.current || !worldState?.islands) return newPan;
        const mapWidth = worldState.width * TILE_SIZE;
        const mapHeight = worldState.height * TILE_SIZE;
        const { clientWidth: viewportWidth, clientHeight: viewportHeight } = viewportRef.current;
        
        const minX = viewportWidth - mapWidth * currentZoom;
        const minY = viewportHeight - mapHeight * currentZoom;

        setBorderOpacity({
            left: Math.max(0, Math.min(1, newPan.x / OVERSCROLL_AMOUNT)),
            right: Math.max(0, Math.min(1, (minX - newPan.x) / OVERSCROLL_AMOUNT)),
            top: Math.max(0, Math.min(1, newPan.y / OVERSCROLL_AMOUNT)),
            bottom: Math.max(0, Math.min(1, (minY - newPan.y) / OVERSCROLL_AMOUNT)),
        });

        return {
            x: Math.min(OVERSCROLL_AMOUNT, Math.max(minX - OVERSCROLL_AMOUNT, newPan.x)),
            y: Math.min(OVERSCROLL_AMOUNT, Math.max(minY - OVERSCROLL_AMOUNT, newPan.y)),
        };
    }, [worldState, viewportRef]);
    
    const goToCoordinates = useCallback((x, y) => {
        if (!viewportRef.current) return;
        const { clientWidth: viewportWidth, clientHeight: viewportHeight } = viewportRef.current;
        const targetX = -x * TILE_SIZE * zoom + (viewportWidth / 2);
        const targetY = -y * TILE_SIZE * zoom + (viewportHeight / 2);
        const newPan = clampPan({ x: targetX, y: targetY }, zoom);
        setPan(newPan);
    }, [zoom, clampPan, setPan, viewportRef]);

    // ### THIS IS THE CORRECTED FUNCTION ###
    const handleWheel = useCallback((e) => {
        if (!viewportRef.current) return;
        e.preventDefault();
        
        const scaleAmount = -e.deltaY * 0.002;
        const newZoom = Math.max(minZoom, Math.min(3, zoom + scaleAmount));

        // Get the center of the viewport instead of the mouse position
        const viewportCenterX = viewportRef.current.clientWidth / 2;
        const viewportCenterY = viewportRef.current.clientHeight / 2;
        
        // Calculate the point on the map that is currently at the center of the viewport
        const pointX = (viewportCenterX - pan.x) / zoom;
        const pointY = (viewportCenterY - pan.y) / zoom;
        
        // Calculate the new pan value to keep that point at the center
        const newPan = clampPan({
            x: viewportCenterX - pointX * newZoom,
            y: viewportCenterY - pointY * newZoom
        }, newZoom);

        setZoom(newZoom);
        setPan(newPan);
    }, [zoom, pan, clampPan, minZoom, viewportRef]);

    const handleMouseDown = useCallback((e) => {
        if (e.button !== 0) return;
        setStartPos({ x: e.clientX - pan.x, y: e.clientY - pan.y });
        setIsPanning(true);
    }, [pan]);

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isPanning) return;
            const newPan = clampPan({ x: e.clientX - startPos.x, y: e.clientY - startPos.y }, zoom);
            setPan(newPan);
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
    }, [isPanning, startPos, zoom, clampPan]);

    useEffect(() => {
        const container = mapContainerRef.current;
        if (container) {
            // The transform-origin should be the default 'center', so we don't set it.
            container.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;
        }
    }, [pan, zoom, mapContainerRef]);

    useEffect(() => {
        const viewport = viewportRef.current;
        if (viewport) {
            viewport.addEventListener('wheel', handleWheel, { passive: false });
        }
        return () => {
            if (viewport) {
                viewport.removeEventListener('wheel', handleWheel);
            }
        };
    }, [handleWheel, viewportRef]);

    return {
        pan,
        zoom,
        isPanning,
        borderOpacity,
        handleMouseDown,
        setZoom,
        setMinZoom,
        goToCoordinates,
    };
};